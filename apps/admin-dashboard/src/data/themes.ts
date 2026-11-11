// Theme data access (P1.6 section 4, THEME-09; on Postgres since P2.1-T07). Every exported function
// takes tenantId first (lint rule `data-access-tenant-first`) and runs in that tenant's database
// scope, so row-level security backs the caller's authorize() check. Drafts and revisions live in
// Postgres; the widget's static documents are a projection written after commit (materialise.ts).
import 'server-only';
import path from 'node:path';
import {
  checkContrastPolicy,
  validateTheme,
  type PolicyViolation,
  type Theme,
} from '@byteflock/theme';
import { withScope, type DbScope } from '../server/db';
import { isDevOnly } from '../server/dev-only';
import { readJson, workspaceRoot } from '../server/store/fs-store';
import { materialiseTenant } from '../server/store/materialise';

export class ThemeError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'NO_WIDGET'
      | 'NO_DRAFT'
      | 'INVALID'
      | 'POLICY'
      | 'NOT_FOUND'
      | 'EXISTS',
    readonly violations: PolicyViolation[] = [],
  ) {
    super(message);
    this.name = 'ThemeError';
  }
}

export interface PublishedTheme {
  revision: number;
  /** Untrusted until validated: the caller validates before resolving (THEME-05). */
  doc: unknown;
}

/** The data layer always narrows the database scope to the one tenant it was asked about. */
const scopeOf = (tenantId: string): DbScope => ({ scope: 'tenant', tenantId });

/**
 * Development test hook (P1.6-T09): THEME_FIXTURE_OVERRIDE="t_broken=libs/theme/fixtures/…;…"
 * serves a fixture as a tenant's published theme, so tests can store a malicious theme.
 */
function fixtureOverride(tenantId: string): string | null {
  if (!isDevOnly()) return null;
  for (const entry of (process.env.THEME_FIXTURE_OVERRIDE ?? '').split(';')) {
    const [tenant, file] = entry.split('=');
    if (tenant?.trim() === tenantId && file)
      return path.join(workspaceRoot(), file.trim());
  }
  return null;
}

/** The tenant's published theme document, or null when it has none. */
export async function getPublishedTheme(
  tenantId: string,
): Promise<PublishedTheme | null> {
  const override = fixtureOverride(tenantId);
  if (override) return { revision: 0, doc: readJson(override) };
  const row = await withScope(scopeOf(tenantId), (db) =>
    db.maybeOne<{ revision: number; doc: unknown }>(
      `SELECT r.revision, r.doc
         FROM tenants t
         JOIN theme_revisions r
           ON r.tenant_id = t.tenant_id AND r.revision = t.published_revision
        WHERE t.tenant_id = $1`,
      [tenantId],
    ),
  );
  return row ? { revision: row.revision, doc: row.doc } : null;
}

/** Published revisions, newest first, and which one the widget uses. */
export async function listRevisions(
  tenantId: string,
): Promise<{ revisions: number[]; current: number | null }> {
  return withScope(scopeOf(tenantId), async (db) => {
    const rows = await db.rows<{ revision: number }>(
      'SELECT revision FROM theme_revisions WHERE tenant_id = $1 ORDER BY revision DESC',
      [tenantId],
    );
    const tenant = await db.maybeOne<{ published_revision: number | null }>(
      'SELECT published_revision FROM tenants WHERE tenant_id = $1',
      [tenantId],
    );
    return {
      revisions: rows.map((r) => r.revision),
      current: tenant?.published_revision ?? null,
    };
  });
}

/** The tenant's draft, or null. */
export async function getDraft(tenantId: string): Promise<Theme | null> {
  const row = await withScope(scopeOf(tenantId), (db) =>
    db.maybeOne<{ doc: unknown }>(
      'SELECT doc FROM theme_drafts WHERE tenant_id = $1',
      [tenantId],
    ),
  );
  if (!row) return null;
  const result = validateTheme(row.doc);
  return result.ok ? result.value : null;
}

/** Saves a draft after full validation; contrast violations are allowed in a draft. */
export async function saveDraft(
  tenantId: string,
  doc: unknown,
  userId: string,
): Promise<Theme> {
  const result = validateTheme(doc);
  if (!result.ok)
    throw new ThemeError(
      result.errors.map((e) => `${e.path} ${e.message}`).join('; '),
      'INVALID',
    );
  try {
    await withScope(scopeOf(tenantId), (db) =>
      db.rows(
        `INSERT INTO theme_drafts (tenant_id, doc, updated_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id)
         DO UPDATE SET doc = EXCLUDED.doc, updated_at = now(), updated_by = EXCLUDED.updated_by`,
        [tenantId, JSON.stringify(result.value), userId],
      ),
    );
  } catch (error) {
    if ((error as { code?: string }).code === '23503')
      throw new ThemeError(`Unknown tenant ${tenantId}`, 'NOT_FOUND');
    throw error;
  }
  return result.value;
}

/**
 * Publishes the draft (THEME-09, P2.1 section 4.5), in one transaction: validate and check policy,
 * insert the next immutable revision, move the published pointer, commit. Only after the commit
 * are the widget's static documents written; if that fails the publish still stands and
 * `pnpm db:materialise` repairs the files (`materialised: false`). Revisions never go down.
 */
export async function publish(
  tenantId: string,
  userId: string,
): Promise<{ revision: number; materialised: boolean }> {
  const revision = await withScope(scopeOf(tenantId), async (db) => {
    const key = await db.maybeOne(
      'SELECT 1 FROM widget_keys WHERE tenant_id = $1 LIMIT 1',
      [tenantId],
    );
    if (!key) throw new ThemeError(`No widget for ${tenantId}`, 'NO_WIDGET');
    const row = await db.maybeOne<{ doc: unknown }>(
      'SELECT doc FROM theme_drafts WHERE tenant_id = $1',
      [tenantId],
    );
    const checked = row ? validateTheme(row.doc) : null;
    if (!checked?.ok)
      throw new ThemeError('Save a valid draft first.', 'NO_DRAFT');
    const draft = checked.value;
    const violations = checkContrastPolicy(draft);
    if (violations.length)
      throw new ThemeError('Contrast policy violations', 'POLICY', violations);

    // Serialise concurrent publishes of this tenant (the revision trigger takes the same lock).
    await db.rows(
      `SELECT pg_advisory_xact_lock(hashtextextended('theme_revisions:' || $1::text, 0))`,
      [tenantId],
    );
    const latest = await db.maybeOne<{ latest: number }>(
      'SELECT COALESCE(MAX(revision), 0) AS latest FROM theme_revisions WHERE tenant_id = $1',
      [tenantId],
    );
    const next = (latest?.latest ?? 0) + 1;
    const doc: Theme = { ...draft, revision: next };
    await db.rows(
      `INSERT INTO theme_revisions (tenant_id, revision, doc, schema_version, published_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, next, JSON.stringify(doc), doc.schemaVersion, userId],
    );
    await db.rows(
      'UPDATE tenants SET published_revision = $2 WHERE tenant_id = $1',
      [tenantId, next],
    );
    return next;
  });
  return { revision, materialised: await tryMaterialise(tenantId) };
}

/** Points the widget at an earlier published revision. Theme documents are untouched. */
export async function rollback(
  tenantId: string,
  revision: number,
): Promise<void> {
  await withScope(scopeOf(tenantId), async (db) => {
    const exists = Number.isInteger(revision)
      ? await db.maybeOne(
          'SELECT 1 FROM theme_revisions WHERE tenant_id = $1 AND revision = $2',
          [tenantId, revision],
        )
      : null;
    if (!exists)
      throw new ThemeError(`Revision ${revision} does not exist`, 'NOT_FOUND');
    await db.rows(
      'UPDATE tenants SET published_revision = $2 WHERE tenant_id = $1',
      [tenantId, revision],
    );
  });
  await tryMaterialise(tenantId);
}

/** The commit has happened; a file failure is reported, not thrown (section 4.5). */
async function tryMaterialise(tenantId: string): Promise<boolean> {
  try {
    await materialiseTenant(tenantId);
    return true;
  } catch (error) {
    console.error(
      `materialise ${tenantId} failed after commit; run pnpm db:materialise:`,
      (error as Error).message,
    );
    return false;
  }
}

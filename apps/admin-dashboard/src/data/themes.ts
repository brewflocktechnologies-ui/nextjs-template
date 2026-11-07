// Theme data access (P1.6 §4, THEME-09). Every exported function takes tenantId first (lint rule
// `data-access-tenant-first`). Phase 1 has no backend: drafts are JSON files under .local/drafts and
// published documents are the widget's static files (D-13, development only).
import fs from 'node:fs';
import path from 'node:path';
import {
  checkContrastPolicy,
  validateTheme,
  type PolicyViolation,
  type Theme,
} from '@byteflock/theme';
import { isDevOnly } from '../server/dev-only';
import {
  draftDir,
  publishDir,
  readJson,
  workspaceRoot,
  writeAtomic,
  writeNew,
} from '../server/store/fs-store';
import { localTenant } from '../server/tenants';

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

function widgetKeyFor(tenantId: string): string {
  const key = localTenant(tenantId)?.widgetKey;
  if (!key) throw new ThemeError(`No widget for ${tenantId}`, 'NO_WIDGET');
  return key;
}

const configFile = (key: string) =>
  path.join(publishDir(), 'config', `${key}.json`);
const themeFile = (tenantId: string, revision: number) =>
  path.join(publishDir(), 'themes', tenantId, `${revision}.json`);
const draftFile = (tenantId: string) =>
  path.join(draftDir(), `${tenantId}.json`);

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
  const key = localTenant(tenantId)?.widgetKey;
  if (!key || !fs.existsSync(configFile(key))) return null;
  const revision = (readJson(configFile(key)) as { themeRevision: number })
    .themeRevision;
  const file = themeFile(tenantId, revision);
  return fs.existsSync(file) ? { revision, doc: readJson(file) } : null;
}

/** Published revisions, newest first, and which one the widget uses. */
export async function listRevisions(
  tenantId: string,
): Promise<{ revisions: number[]; current: number | null }> {
  const dir = path.join(publishDir(), 'themes', tenantId);
  const revisions = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .map((f) => /^(\d+)\.json$/.exec(f)?.[1])
        .filter((n): n is string => !!n)
        .map(Number)
        .sort((a, b) => b - a)
    : [];
  const key = localTenant(tenantId)?.widgetKey;
  const current =
    key && fs.existsSync(configFile(key))
      ? (readJson(configFile(key)) as { themeRevision: number }).themeRevision
      : null;
  return { revisions, current };
}

/** The tenant's draft, or null. */
export async function getDraft(tenantId: string): Promise<Theme | null> {
  const file = draftFile(tenantId);
  if (!fs.existsSync(file)) return null;
  const result = validateTheme(readJson(file));
  return result.ok ? result.value : null;
}

/** Saves a draft after full validation; contrast violations are allowed in a draft. */
export async function saveDraft(
  tenantId: string,
  doc: unknown,
): Promise<Theme> {
  const result = validateTheme(doc);
  if (!result.ok)
    throw new ThemeError(
      result.errors.map((e) => `${e.path} ${e.message}`).join('; '),
      'INVALID',
    );
  writeAtomic(draftFile(tenantId), result.value);
  return result.value;
}

/**
 * Publishes the draft (THEME-09): validate and check policy, write the immutable theme document
 * at revision max + 1, then move the widget config pointer. Revisions never go down.
 */
export async function publish(tenantId: string): Promise<{ revision: number }> {
  const key = widgetKeyFor(tenantId);
  const draft = await getDraft(tenantId);
  if (!draft) throw new ThemeError('Save a valid draft first.', 'NO_DRAFT');
  const violations = checkContrastPolicy(draft);
  if (violations.length)
    throw new ThemeError('Contrast policy violations', 'POLICY', violations);

  const { revisions } = await listRevisions(tenantId);
  const revision = (revisions[0] ?? 0) + 1;
  const doc: Theme = { ...draft, revision };
  try {
    writeNew(themeFile(tenantId, revision), doc);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST')
      throw new ThemeError(`Revision ${revision} already exists`, 'EXISTS');
    throw e;
  }
  // Only now that the document exists does the pointer move.
  movePointer(key, revision);
  return { revision };
}

/** Points the widget at an earlier published revision. Theme documents are untouched. */
export async function rollback(
  tenantId: string,
  revision: number,
): Promise<void> {
  const key = widgetKeyFor(tenantId);
  if (
    !Number.isInteger(revision) ||
    !fs.existsSync(themeFile(tenantId, revision))
  )
    throw new ThemeError(`Revision ${revision} does not exist`, 'NOT_FOUND');
  movePointer(key, revision);
}

function movePointer(key: string, revision: number) {
  const config = readJson(configFile(key)) as Record<string, unknown>;
  writeAtomic(configFile(key), { ...config, themeRevision: revision });
}

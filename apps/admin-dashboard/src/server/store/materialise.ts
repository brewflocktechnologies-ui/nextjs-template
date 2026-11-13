// Materialisation (P2.1 section 4.5, D-24): the widget reads static documents, so after Postgres
// commits a publish, rollback or widget-settings change, this writes the tenant's published theme
// and each widget key's config into THEME_PUBLISH_DIR. Postgres is the source of truth; a failure
// here never undoes the commit, and `pnpm db:materialise` rebuilds every file from the database.
// Order (THEME-09): the theme document first, then the config that points at it.
import 'server-only';
import path from 'node:path';
import { withScope, type WidgetKeyRow } from '../db';
import { publishDir, writeAtomic, writeNew } from './fs-store';

interface PublishedRow {
  published_revision: number | null;
  doc: { launcher?: { position?: string } } | null;
}

/** Writes the tenant's published theme and widget configs. Returns the paths written. */
export async function materialiseTenant(tenantId: string): Promise<string[]> {
  const { published, keys } = await withScope(
    { scope: 'tenant', tenantId },
    async (db) => ({
      published: await db.maybeOne<PublishedRow>(
        `SELECT t.published_revision, r.doc
           FROM tenants t
           LEFT JOIN theme_revisions r
             ON r.tenant_id = t.tenant_id AND r.revision = t.published_revision
          WHERE t.tenant_id = $1`,
        [tenantId],
      ),
      keys: await db.rows<WidgetKeyRow>(
        'SELECT * FROM widget_keys WHERE tenant_id = $1 ORDER BY widget_key',
        [tenantId],
      ),
    }),
  );
  const revision = published?.published_revision;
  if (!published?.doc || revision == null) return [];

  const written: string[] = [];
  const themeFile = path.join(
    publishDir(),
    'themes',
    tenantId,
    `${revision}.json`,
  );
  if (writeNew(themeFile, published.doc)) written.push(themeFile);

  for (const key of keys) {
    const features = key.features as { proactive?: boolean; consent?: string };
    const file = path.join(publishDir(), 'config', `${key.widget_key}.json`);
    writeAtomic(file, {
      schemaVersion: 1,
      tenantId,
      themeRevision: revision,
      locale: { default: key.locale_default, supported: key.locales_supported },
      features: { proactive: features.proactive, consent: features.consent },
      launcher: { position: published.doc.launcher?.position },
      allowedOrigins: key.allowed_origins,
    });
    written.push(file);
  }
  return written;
}

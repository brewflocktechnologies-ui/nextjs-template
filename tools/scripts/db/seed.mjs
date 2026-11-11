// Seeds the local database from validation/tenants.json and the theme fixtures (P2.1-T04).
//
//   pnpm db:seed                          # the stack database (byteflock)
//   pnpm db:seed -- --database=byteflock_test
//
// Creates the three local tenants with their admins, widget keys, theme draft, published theme
// revision 1 and a default tenant config, plus `u_platform_admin` (super_admin) and `u_acme_agent`.
// Idempotent: every row is inserted only when missing, so re-running keeps local edits. Development
// only: refuses to run when NODE_ENV=production. The failure fixtures (t_broken, wk_broken_*) stay
// static files and are not seeded.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from './lib.mjs';
import { ownerUrl } from './migrate.mjs';

const require = createRequire(
  path.join(root, 'apps', 'admin-dashboard', 'package.json'),
);
const readJson = (rel) =>
  JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

/** The default tenant config (tenant-config v1, §4.6): every module on, the tenant's locale. */
export function defaultTenantConfig(tenant) {
  return {
    schemaVersion: 1,
    modules: { themeEditor: true, widgetSettings: true },
    defaults: { locale: tenant.locale },
    home: { title: `${tenant.name} support`, notice: '' },
  };
}

export async function seed({ databaseUrl = ownerUrl(), log = () => {} } = {}) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('refusing to seed when NODE_ENV=production');
  }
  const { Client } = require('pg');
  const file = readJson('validation/tenants.json');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    // FORCE ROW LEVEL SECURITY applies to the owner too (0001_init.sql).
    await client.query("SELECT set_config('app.scope', 'platform', true)");
    const insert = async (sql, params) =>
      (await client.query(sql, params)).rowCount;
    let rows = 0;

    const pa = file.platformAdmin;
    rows += await insert(
      `INSERT INTO users (user_id, display_name, locale, platform_role)
       VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING`,
      [pa.user, pa.displayName, pa.locale, pa.platformRole],
    );

    for (const t of file.tenants) {
      const theme = readJson(t.theme);
      const admin = t.user;
      rows += await insert(
        `INSERT INTO users (user_id, display_name, locale)
         VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING`,
        [admin, `${t.name} Admin`, t.locale],
      );
      for (const u of t.extraUsers ?? []) {
        rows += await insert(
          `INSERT INTO users (user_id, display_name, locale)
           VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING`,
          [u.user, u.displayName, t.locale],
        );
      }
      rows += await insert(
        `INSERT INTO tenants (tenant_id, name) VALUES ($1, $2)
         ON CONFLICT (tenant_id) DO NOTHING`,
        [t.tenantId, t.name],
      );
      for (const role of t.roles) {
        rows += await insert(
          `INSERT INTO tenant_memberships (user_id, tenant_id, role)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [admin, t.tenantId, role],
        );
      }
      for (const u of t.extraUsers ?? []) {
        for (const role of u.roles) {
          rows += await insert(
            `INSERT INTO tenant_memberships (user_id, tenant_id, role)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [u.user, t.tenantId, role],
          );
        }
      }
      rows += await insert(
        `INSERT INTO widget_keys
           (widget_key, tenant_id, allowed_origins, locale_default, locales_supported, features)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (widget_key) DO NOTHING`,
        [
          t.widgetKey,
          t.tenantId,
          t.allowedOrigins,
          t.locale,
          t.supportedLocales,
          JSON.stringify({ proactive: t.proactive, consent: t.consent }),
        ],
      );
      rows += await insert(
        `INSERT INTO theme_drafts (tenant_id, doc, updated_by)
         VALUES ($1, $2, $3) ON CONFLICT (tenant_id) DO NOTHING`,
        [t.tenantId, JSON.stringify(theme), admin],
      );
      // The revision trigger rejects a repeat insert, so insert only when the tenant has none.
      rows += await insert(
        `INSERT INTO theme_revisions (tenant_id, revision, doc, schema_version, published_by)
         SELECT $1::text, $2::int, $3::jsonb, $4::int, $5::text
         WHERE NOT EXISTS (SELECT 1 FROM theme_revisions WHERE tenant_id = $1)`,
        [
          t.tenantId,
          theme.revision,
          JSON.stringify(theme),
          theme.schemaVersion,
          admin,
        ],
      );
      rows += await insert(
        `UPDATE tenants SET published_revision = $2
         WHERE tenant_id = $1 AND published_revision IS NULL`,
        [t.tenantId, theme.revision],
      );
      rows += await insert(
        `INSERT INTO tenant_configs (tenant_id, doc, schema_version, updated_by)
         VALUES ($1, $2, 1, $3) ON CONFLICT (tenant_id) DO NOTHING`,
        [t.tenantId, JSON.stringify(defaultTenantConfig(t)), admin],
      );
      log(`seeded ${t.tenantId}`);
    }
    await client.query('COMMIT');
    return { rows };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const SCRIPT = 'db:seed';
  const arg = process.argv.find((a) => a.startsWith('--database='));
  const database = arg ? arg.slice('--database='.length) : 'byteflock';
  if (!/^[a-z0-9_]+$/.test(database)) {
    console.error(`${SCRIPT}: invalid database name "${database}"`);
    process.exit(1);
  }
  try {
    const { rows } = await seed({
      databaseUrl: ownerUrl(database),
      log: (m) => console.log(`${SCRIPT}: ${m}`),
    });
    console.log(
      rows === 0
        ? `${SCRIPT}: already seeded, nothing to do`
        : `${SCRIPT}: wrote ${rows} rows`,
    );
  } catch (error) {
    console.error(`${SCRIPT}: ${error.message}`);
    process.exit(1);
  }
}

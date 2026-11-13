// Rebuilds the widget's static documents from the database (P2.1-T08, section 4.5, D-24).
//
//   pnpm db:materialise                              # the stack database -> apps/widget/public/v1
//   pnpm db:materialise -- --database=byteflock_test
//   pnpm db:materialise -- --out=<dir>               # write somewhere else (tests)
//
// Postgres is the source of truth; the widget serves static files. This writes, for every tenant,
// every published theme revision (`themes/<tenantId>/<revision>.json`, so a rollback target always
// exists) and, for every widget key, its config (`config/<widgetKey>.json`, pointing at the
// published revision). Themes go first, then configs (THEME-09). It is the repair for a publish
// whose file write failed after commit. Files that are already correct are left untouched.
// Hand-written failure fixtures (t_broken, wk_broken_*) are not in the database and not touched.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalText } from './canonical.mjs';
import { root } from './lib.mjs';
import { ownerUrl } from './migrate.mjs';

const require = createRequire(
  path.join(root, 'apps', 'admin-dashboard', 'package.json'),
);

export const WIDGET_PUBLIC_V1 = path.join(
  root,
  'apps',
  'widget',
  'public',
  'v1',
);

/** Writes a file only when its content differs, through a temp file and a rename. */
function writeIfChanged(file, text) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text)
    return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
  return true;
}

/** The widget config document for one key (same shape as generate-widget-fixtures.mjs). */
export function widgetConfig({ key, tenantId, revision, theme }) {
  return {
    schemaVersion: 1,
    tenantId,
    themeRevision: revision,
    locale: { default: key.locale_default, supported: key.locales_supported },
    features: {
      proactive: key.features.proactive,
      consent: key.features.consent,
    },
    launcher: { position: theme.launcher?.position },
    allowedOrigins: key.allowed_origins,
  };
}

/** Returns { written: string[], unchanged: number }. */
export async function materialise({
  databaseUrl = ownerUrl(),
  out = WIDGET_PUBLIC_V1,
} = {}) {
  const { Client } = require('pg');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  let revisions, tenants, keys;
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.scope', 'platform', true)");
    revisions = (
      await client.query(
        'SELECT tenant_id, revision, doc FROM theme_revisions ORDER BY tenant_id, revision',
      )
    ).rows;
    tenants = (
      await client.query(
        'SELECT tenant_id, published_revision FROM tenants ORDER BY tenant_id',
      )
    ).rows;
    keys = (await client.query('SELECT * FROM widget_keys ORDER BY widget_key'))
      .rows;
    await client.query('COMMIT');
  } finally {
    await client.end();
  }

  const written = [];
  let unchanged = 0;
  const put = (rel, doc) => {
    const changed = writeIfChanged(path.join(out, rel), canonicalText(doc));
    if (changed) written.push(rel);
    else unchanged += 1;
  };
  // Themes first (THEME-09), then the configs that point at them.
  for (const r of revisions)
    put(path.join('themes', r.tenant_id, `${r.revision}.json`), r.doc);
  for (const t of tenants) {
    if (t.published_revision == null) continue;
    const published = revisions.find(
      (r) => r.tenant_id === t.tenant_id && r.revision === t.published_revision,
    );
    for (const key of keys.filter((k) => k.tenant_id === t.tenant_id)) {
      put(
        path.join('config', `${key.widget_key}.json`),
        widgetConfig({
          key,
          tenantId: t.tenant_id,
          revision: t.published_revision,
          theme: published.doc,
        }),
      );
    }
  }
  return { written, unchanged };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const SCRIPT = 'db:materialise';
  const arg = (name) =>
    process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const database = arg('database') ?? 'byteflock';
  const out = arg('out') ? path.resolve(arg('out')) : WIDGET_PUBLIC_V1;
  if (!/^[a-z0-9_]+$/.test(database)) {
    console.error(`${SCRIPT}: invalid database name "${database}"`);
    process.exit(1);
  }
  try {
    const { written, unchanged } = await materialise({
      databaseUrl: ownerUrl(database),
      out,
    });
    console.log(
      `${SCRIPT}: ${written.length} written, ${unchanged} already correct (${path.relative(root, out) || '.'})`,
    );
  } catch (error) {
    console.error(`${SCRIPT}: ${error.message}`);
    process.exit(1);
  }
}

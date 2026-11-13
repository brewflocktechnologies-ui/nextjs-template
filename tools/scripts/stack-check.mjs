// Checks the local stack (SPECS/validation/local-stack.md). Node only, so it works on Windows
// without curl.
//
//   pnpm stack:check              check once
//   pnpm stack:check --wait 120   retry for up to 120 s while the dev servers start
//
// Required endpoints fail the check; endpoints a later phase adds are reported as "not yet".
import { createRequire } from 'node:module';
import path from 'node:path';
import { FRAME_HEADERS } from '../../apps/widget/src/headers.config.ts';
import { ownerUrl, readMigrations } from './db/migrate.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
// `pg` is a dependency of the dashboard only; resolve it from there (as the db scripts do).
const requirePg = createRequire(
  path.join(root, 'apps', 'admin-dashboard', 'package.json'),
);

/**
 * The stack database (P2.1-T13): reachable, every migration file applied with a matching checksum,
 * and the seed present (the three tenants and a super admin). Returns the lines to print and
 * whether it passed.
 */
async function checkDatabase() {
  const lines = [];
  const where = new URL(ownerUrl('byteflock')).host;
  const { Client } = requirePg('pg');
  const client = new Client({
    connectionString: ownerUrl('byteflock'),
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
  } catch (error) {
    return {
      ok: false,
      lines: [
        `FAIL     Database (Postgres)              ${where}  (${error.code ?? error.message}; run \`pnpm db:up\`)`,
      ],
    };
  }
  let ok = true;
  try {
    lines.push(`OK       Database (Postgres)              ${where}`);
    const files = readMigrations();
    const applied = new Map(
      (
        await client
          .query('SELECT name, checksum FROM schema_migrations')
          .catch(() => ({ rows: [] }))
      ).rows.map((r) => [r.name, r.checksum]),
    );
    const pending = files.filter((m) => !applied.has(m.name));
    const edited = files.filter(
      (m) => applied.has(m.name) && applied.get(m.name) !== m.checksum,
    );
    const migrationsOk = pending.length === 0 && edited.length === 0;
    if (!migrationsOk) ok = false;
    lines.push(
      `         ${migrationsOk ? 'migrations ok' : 'MIGRATIONS BAD'} ${files.length} file(s)${pending.length ? `, pending: ${pending.map((m) => m.name).join(', ')} (run \`pnpm db:migrate\`)` : ''}${edited.length ? `, edited after apply: ${edited.map((m) => m.name).join(', ')}` : ''}`,
    );
    if (migrationsOk) {
      await client.query('BEGIN READ ONLY');
      await client.query("SELECT set_config('app.scope', 'platform', true)");
      const { rows } = await client.query(
        `SELECT (SELECT count(*)::int FROM tenants
                  WHERE tenant_id IN ('t_acme', 't_globex', 't_initech')) AS tenants,
                (SELECT count(*)::int FROM users WHERE platform_role = 'super_admin') AS admins`,
      );
      await client.query('COMMIT');
      const seedOk = rows[0].tenants === 3 && rows[0].admins >= 1;
      if (!seedOk) ok = false;
      lines.push(
        `         ${seedOk ? 'seed ok      ' : 'SEED MISSING '} ${rows[0].tenants} of 3 tenants, ${rows[0].admins} super admin(s)${seedOk ? '' : ' (run `pnpm db:seed`)'}`,
      );
    }
  } finally {
    await client.end();
  }
  return { ok, lines };
}

const args = process.argv.slice(2);
const waitIndex = args.indexOf('--wait');
const waitSeconds = waitIndex >= 0 ? Number(args[waitIndex + 1] ?? 120) : 0;

const endpoints = [
  {
    // `/` redirects to the tenant switcher without a session (P1.6 proxy); probe the public page.
    name: 'Admin dashboard',
    url: 'http://localhost:3000/dev/session',
    required: true,
    type: 'text/html',
  },
  {
    name: 'Widget playground',
    url: 'http://localhost:4300/',
    required: true,
    type: 'text/html',
  },
  {
    name: 'Widget frame',
    url: 'http://localhost:4400/v1/frame/',
    required: true,
    frame: true,
    type: 'text/html',
  },
  {
    name: 'Widget loader',
    url: 'http://localhost:4400/v1/loader.js',
    required: true,
    from: 'PoC-A',
    type: 'javascript',
  },
  {
    name: 'Widget config (wk_acme_demo)',
    url: 'http://localhost:4400/v1/config/wk_acme_demo.json',
    required: true,
    from: 'PoC-A',
    type: 'json',
  },
];

async function probe(url) {
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    return { status: res.status, headers: res.headers };
  } catch (error) {
    return { status: 0, error: error.cause?.code ?? error.message };
  }
}

// Up means a 2xx/3xx answer with the expected content type, so an HTML fallback page never
// counts as a JavaScript or JSON endpoint.
const isUp = (r, type) =>
  r.status >= 200 &&
  r.status < 400 &&
  (!type || (r.headers?.get('content-type') ?? '').includes(type));
const deadline = Date.now() + waitSeconds * 1000;
let results;
for (;;) {
  results = await Promise.all(
    endpoints.map(async (e) => ({ ...e, result: await probe(e.url) })),
  );
  const requiredUp = results
    .filter((r) => r.required)
    .every((r) => isUp(r.result, r.type));
  if (requiredUp || Date.now() >= deadline) break;
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

let failed = false;
for (const r of results) {
  const up = isUp(r.result, r.type);
  const label = up ? 'OK  ' : r.required ? 'FAIL' : 'not yet';
  const detail = r.result.status ? `HTTP ${r.result.status}` : r.result.error;
  console.log(
    `${label.padEnd(8)} ${r.name.padEnd(30)} ${r.url}  (${detail}${!up && !r.required ? `, arrives in ${r.from}` : ''})`,
  );
  if (r.required && !up) failed = true;

  if (r.frame && up) {
    for (const [name, value] of Object.entries(FRAME_HEADERS)) {
      const actual = r.result.headers.get(name);
      const ok = actual === value;
      if (!ok) failed = true;
      console.log(
        `         ${ok ? 'header ok ' : 'HEADER BAD'} ${name}${ok ? '' : `: got ${actual ?? '(missing)'}`}`,
      );
    }
  }
}

const database = await checkDatabase();
for (const line of database.lines) console.log(line);
if (!database.ok) failed = true;

if (failed) {
  console.error('\nstack:check failed. Is `pnpm stack` running?');
  process.exit(1);
}
console.log('\nstack:check passed');

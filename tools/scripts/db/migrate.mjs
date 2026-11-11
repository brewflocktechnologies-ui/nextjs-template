// Applies SQL migrations in order (P2.1-T03, ADR-012).
//
//   pnpm db:migrate                       # the stack database (byteflock)
//   pnpm db:migrate -- --database=byteflock_test
//
// Files: apps/admin-dashboard/db/migrations/NNNN_<name>.sql, forward-only. Each file runs in its
// own transaction and is recorded in `schema_migrations` with a SHA-256 checksum. An applied file
// that was edited (or deleted) fails the runner; an applied migration is never re-run.
// Connects as the owner role (`byteflock`); override with MIGRATE_DATABASE_URL.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOST_PORT, root } from './lib.mjs';

export const MIGRATIONS_DIR = path.join(
  root,
  'apps',
  'admin-dashboard',
  'db',
  'migrations',
);
const FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;
const LOCK_KEY = 7_265_410_001; // arbitrary constant: one migrator at a time

// `pg` is a dependency of the dashboard only; resolve it from there.
const require = createRequire(
  path.join(root, 'apps', 'admin-dashboard', 'package.json'),
);

export function ownerUrl(database = 'byteflock') {
  return (
    process.env.MIGRATE_DATABASE_URL ??
    `postgres://byteflock:byteflock@127.0.0.1:${HOST_PORT}/${database}`
  );
}

/** Checksum over LF-normalised text so a CRLF checkout does not look like an edit. */
export function checksum(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

export function readMigrations(dir = MIGRATIONS_DIR) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const migrations = [];
  files.forEach((name, index) => {
    const match = FILE_PATTERN.exec(name);
    if (!match) throw new Error(`bad migration file name: ${name}`);
    if (Number(match[1]) !== index + 1) {
      throw new Error(
        `migration numbers must run 0001, 0002, ... without gaps or duplicates; found ${name} at position ${index + 1}`,
      );
    }
    const sql = fs.readFileSync(path.join(dir, name), 'utf8');
    migrations.push({ name, sql, checksum: checksum(sql) });
  });
  return migrations;
}

/**
 * Applies pending migrations. Returns { applied: string[], total: number }.
 * Throws on a checksum mismatch, an applied migration whose file is gone, or any SQL error.
 */
export async function migrate({
  databaseUrl = ownerUrl(),
  dir = MIGRATIONS_DIR,
  log = () => {},
} = {}) {
  const { Client } = require('pg');
  const migrations = readMigrations(dir);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const applied = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        checksum   text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    const { rows } = await client.query(
      'SELECT name, checksum FROM schema_migrations ORDER BY name',
    );
    const done = new Map(rows.map((r) => [r.name, r.checksum]));

    for (const name of done.keys()) {
      if (!migrations.some((m) => m.name === name)) {
        throw new Error(
          `${name} is recorded as applied but its file is missing; migrations are forward-only`,
        );
      }
    }
    for (const m of migrations) {
      const recorded = done.get(m.name);
      if (recorded === undefined) continue;
      if (recorded !== m.checksum) {
        throw new Error(
          `${m.name} was edited after it was applied (checksum mismatch). Applied migrations are immutable: add a new migration instead.`,
        );
      }
    }
    for (const m of migrations) {
      if (done.has(m.name)) continue;
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
          [m.name, m.checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `${m.name} failed and was rolled back: ${error.message}`,
        );
      }
      applied.push(m.name);
      log(`applied ${m.name}`);
    }
  } finally {
    await client.end();
  }
  return { applied, total: migrations.length };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const SCRIPT = 'db:migrate';
  const arg = process.argv.find((a) => a.startsWith('--database='));
  const database = arg ? arg.slice('--database='.length) : 'byteflock';
  if (!/^[a-z0-9_]+$/.test(database)) {
    console.error(`${SCRIPT}: invalid database name "${database}"`);
    process.exit(1);
  }
  try {
    const { applied, total } = await migrate({
      databaseUrl: ownerUrl(database),
      log: (m) => console.log(`${SCRIPT}: ${m}`),
    });
    console.log(
      applied.length === 0
        ? `${SCRIPT}: up to date (${total} migration${total === 1 ? '' : 's'} applied)`
        : `${SCRIPT}: applied ${applied.length} of ${total}`,
    );
  } catch (error) {
    console.error(`${SCRIPT}: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.error(`${SCRIPT}: is Postgres running? Try \`pnpm db:up\`.`);
    }
    process.exit(1);
  }
}

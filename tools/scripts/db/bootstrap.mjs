// Creates the application role and the test database on a fresh Postgres server (P2.1-T14), by
// running apps/admin-dashboard/db/init/01-roles-and-databases.sql. Locally Docker Compose runs that
// file itself on an empty volume; a CI service container cannot mount it (services start before the
// checkout), so CI runs this instead. One source of truth: the same SQL file.
//
//   node tools/scripts/db/bootstrap.mjs      (uses MIGRATE_DATABASE_URL, default the local stack)
//
// Safe to repeat: when the role already exists it does nothing. Each statement runs on its own,
// because CREATE DATABASE cannot run inside the implicit transaction of a multi-statement query.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { root } from './lib.mjs';
import { ownerUrl } from './migrate.mjs';

const SCRIPT = 'db:bootstrap';
const INIT = path.join(
  root,
  'apps',
  'admin-dashboard',
  'db',
  'init',
  '01-roles-and-databases.sql',
);
const require = createRequire(
  path.join(root, 'apps', 'admin-dashboard', 'package.json'),
);

/** The init file's statements: comments removed, split on the semicolon that ends a line. */
export function statements(sql) {
  return sql
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*\n/)
    .map((s) => s.trim().replace(/;$/, ''))
    .filter(Boolean);
}

const { Client } = require('pg');
const client = new Client({ connectionString: ownerUrl('byteflock') });
try {
  await client.connect();
  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_roles WHERE rolname = 'byteflock_app'",
  );
  if (rowCount) {
    console.log(`${SCRIPT}: already bootstrapped (byteflock_app exists)`);
  } else {
    const list = statements(fs.readFileSync(INIT, 'utf8'));
    for (const sql of list) await client.query(sql);
    console.log(
      `${SCRIPT}: ran ${list.length} statements from ${path.relative(root, INIT)}`,
    );
  }
} catch (error) {
  console.error(`${SCRIPT}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

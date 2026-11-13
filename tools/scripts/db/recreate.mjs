// Drops and recreates one database on the running Postgres, then migrates and seeds it (P2.1-T07).
// Much faster than `pnpm db:reset` (no container restart), and the way to undo test publishes:
// theme_revisions is immutable, so rows cannot be deleted one by one.
//
//   pnpm db:recreate                          # the stack database (byteflock)
//   pnpm db:recreate -- --database=byteflock_test
//
// Open connections to the database are terminated (DROP ... WITH (FORCE)). Development only.
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOST_PORT, root } from './lib.mjs';
import { migrate, ownerUrl } from './migrate.mjs';
import { seed } from './seed.mjs';

const require = createRequire(
  path.join(root, 'apps', 'admin-dashboard', 'package.json'),
);

export async function recreateDatabase(database = 'byteflock') {
  if (process.env.NODE_ENV === 'production')
    throw new Error('refusing to recreate a database when NODE_ENV=production');
  if (!/^[a-z0-9_]+$/.test(database))
    throw new Error(`invalid database name "${database}"`);
  const { Client } = require('pg');
  const admin = new Client({
    connectionString:
      process.env.RECREATE_ADMIN_URL ??
      `postgres://byteflock:byteflock@127.0.0.1:${HOST_PORT}/postgres`,
  });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${database} OWNER byteflock`);
    await admin.query(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC`);
    await admin.query(`GRANT CONNECT ON DATABASE ${database} TO byteflock_app`);
  } finally {
    await admin.end();
  }
  const databaseUrl = ownerUrl(database);
  await migrate({ databaseUrl });
  await seed({ databaseUrl });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const SCRIPT = 'db:recreate';
  const arg = process.argv.find((a) => a.startsWith('--database='));
  const database = arg ? arg.slice('--database='.length) : 'byteflock';
  try {
    await recreateDatabase(database);
    console.log(`${SCRIPT}: ${database} recreated, migrated and seeded`);
  } catch (error) {
    console.error(`${SCRIPT}: ${error.message}`);
    process.exit(1);
  }
}

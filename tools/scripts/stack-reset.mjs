// Returns the local stack to the fixtures (SPECS/validation/local-stack.md, D-13, P2.1-T13):
//
//   pnpm stack:reset            files, then database: everything back to the fixtures
//   pnpm stack:reset --files    only the widget's static files (the e2e reset, which recreates the
//                               database itself with tools/scripts/db/recreate.mjs)
//
// 1. Restores the widget's publishable data from the committed fixtures: removes
//    apps/widget/public/v1/{config,themes} (so files from local publishes go too) and copies
//    validation/widget-fixtures/v1/{config,themes} back. That includes the hand-written failure
//    fixtures, which are not in the database. Other files under public/v1 are not touched.
// 2. `db:reset` wipes the Postgres volume, migrates and seeds; `db:seed` runs again (a no-op that
//    confirms the seed); `db:materialise` rewrites the tenants' documents from the database, which
//    must give the same bytes as the fixtures (P2.1-AC11, check-no-local-publish).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const source = path.join(root, 'validation', 'widget-fixtures', 'v1');
const target = path.join(root, 'apps', 'widget', 'public', 'v1');
const managed = ['config', 'themes'];
const filesOnly = process.argv.includes('--files');

let copied = 0;
for (const dir of managed) {
  const to = path.join(target, dir);
  fs.rmSync(to, { recursive: true, force: true });
  const from = path.join(source, dir);
  if (!fs.existsSync(from)) continue;
  fs.cpSync(from, to, { recursive: true });
  copied += fs.readdirSync(from, { recursive: true }).length;
}
console.log(
  `stack:reset: restored ${copied} fixture entries into apps/widget/public/v1`,
);
if (filesOnly) process.exit(0);

for (const step of ['reset.mjs', 'seed.mjs', 'materialise.mjs']) {
  const r = spawnSync(
    process.execPath,
    [path.join(root, 'tools', 'scripts', 'db', step)],
    { cwd: root, stdio: 'inherit' },
  );
  if (r.status !== 0) {
    console.error(
      `stack:reset: ${step} failed; the widget files are restored but the database is not.`,
    );
    process.exit(1);
  }
}
console.log(
  'stack:reset: done (files restored, database reset and materialised)',
);

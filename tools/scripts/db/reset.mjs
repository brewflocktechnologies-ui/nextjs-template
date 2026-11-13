// Wipes the local database and starts it fresh (P2.1-T02): removes the container and the
// byteflock-pg volume, starts Postgres again (the init script recreates roles and the test
// database), then applies migrations and the seed.
//
//   pnpm db:reset
//
// Migrations (P2.1-T03) and the seed (P2.1-T04) are run by the steps below once those scripts
// exist; until then reset stops after a healthy empty database.
import fs from 'node:fs';
import path from 'node:path';
import { compose, fail, log, requireDocker, run } from './lib.mjs';

const SCRIPT = 'db:reset';
const here = import.meta.dirname;

requireDocker(SCRIPT);
if (compose(['down', '--volumes', '--remove-orphans']).status !== 0) {
  fail(SCRIPT, 'could not remove the db container and volume.');
}
log(SCRIPT, 'removed the db container and the byteflock-pg volume');

for (const step of ['up.mjs', 'migrate.mjs', 'seed.mjs']) {
  const file = path.join(here, step);
  if (!fs.existsSync(file)) {
    log(SCRIPT, `skipped ${step} (not implemented yet)`);
    continue;
  }
  if (run(process.execPath, [file]).status !== 0)
    fail(SCRIPT, `${step} failed.`);
}
log(SCRIPT, 'done');

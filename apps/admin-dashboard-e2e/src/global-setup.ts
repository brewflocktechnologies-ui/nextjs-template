// Playwright global setup (P2.1-T15): before any test, the database the dashboard dev server uses is
// dropped, recreated, migrated and seeded, and the widget's static files are restored from the
// fixtures. The server Playwright starts uses `byteflock_test` (playwright.config.mts); a reused
// `pnpm stack` uses the stack database, so the name is read from the server itself (/healthz, dev
// only) and exported as E2E_DATABASE for the helpers that reset or edit it.
import { execFileSync } from 'node:child_process';
import { DASHBOARD, ROOT } from './helpers';

export default async function globalSetup() {
  const res = await fetch(`${DASHBOARD}/healthz`);
  const database = res.headers.get('x-byteflock-database') ?? 'byteflock_test';
  if (!/^[a-z0-9_]+$/.test(database))
    throw new Error(`global setup: unexpected database name ${database}`);
  process.env.E2E_DATABASE = database;
  console.log(`global setup: resetting database ${database}`);
  execFileSync(
    process.execPath,
    ['tools/scripts/db/recreate.mjs', `--database=${database}`],
    { cwd: ROOT, stdio: 'inherit' },
  );
  execFileSync(process.execPath, ['tools/scripts/stack-reset.mjs', '--files'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

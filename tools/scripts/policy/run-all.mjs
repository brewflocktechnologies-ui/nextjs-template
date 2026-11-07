// Runs every tools/scripts/policy/check-*.mjs and fails if any of them fails.
// Usage: npm run policy:check
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const checks = fs
  .readdirSync(here)
  .filter((f) => /^check-.*\.mjs$/.test(f))
  .sort();

const failed = [];
for (const check of checks) {
  const result = spawnSync(process.execPath, [path.join(here, check)], {
    stdio: 'inherit',
  });
  if (result.status !== 0) failed.push(check);
}

if (failed.length) {
  console.error(`\npolicy:check failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\npolicy:check passed (${checks.length} checks)`);

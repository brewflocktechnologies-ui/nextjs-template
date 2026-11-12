// Runs every tools/scripts/policy/check-*.mjs and fails if any of them fails.
// Usage: pnpm policy:check
//
// When BYTEFLOCK_REPORT_DIR is set (pnpm verify sets it, D-26), each check's result and output
// are also written to <dir>/details/policy.json for the quality report.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const checks = fs
  .readdirSync(here)
  .filter((f) => /^check-.*\.mjs$/.test(f))
  .sort();

const results = [];
for (const check of checks) {
  const start = Date.now();
  const result = spawnSync(process.execPath, [path.join(here, check)], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  results.push({
    check: check.replace(/\.mjs$/, ''),
    status: result.status === 0 ? 'pass' : 'FAIL',
    seconds: Math.round((Date.now() - start) / 1000),
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  });
}

const reportDir = process.env.BYTEFLOCK_REPORT_DIR;
if (reportDir) {
  const out = path.join(reportDir, 'details', 'policy.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ checks: results }, null, 2) + '\n');
}

const failed = results.filter((r) => r.status !== 'pass').map((r) => r.check);
if (failed.length) {
  console.error(`\npolicy:check failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\npolicy:check passed (${checks.length} checks)`);

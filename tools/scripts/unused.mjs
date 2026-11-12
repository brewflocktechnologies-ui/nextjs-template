// Unused files, dependencies and exports (D-29, P2.1-T20): knip with knip.jsonc. Run by pnpm verify.
// Prints knip's compact list and, with BYTEFLOCK_REPORT_DIR set, writes its JSON result to
// details/unused.json for the quality report. Exits with knip's status: errors (unused files,
// unused or unlisted dependencies, unlisted binaries) fail; unused exports and types are warnings.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const bin = path.join(root, 'node_modules', 'knip', 'bin', 'knip.js');
const run = (reporter) =>
  spawnSync(process.execPath, [bin, '--no-progress', '--reporter', reporter], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

const compact = run('compact');
// Drop Nx's notice about Playwright webServer commands; it is not a finding.
const lines = `${compact.stdout}${compact.stderr}`
  .split('\n')
  .filter((l) => !l.includes('could not infer an Nx task'));
process.stdout.write(lines.join('\n') + '\n');

if (process.env.BYTEFLOCK_REPORT_DIR) {
  const json = run('json');
  const start = json.stdout.indexOf('{');
  let result = null;
  try {
    result = JSON.parse(json.stdout.slice(start));
  } catch {
    // Reported below as an unreadable result.
  }
  const out = path.join(
    process.env.BYTEFLOCK_REPORT_DIR,
    'details',
    'unused.json',
  );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify({ status: compact.status, result }, null, 2) + '\n',
  );
}
console.log(
  compact.status === 0
    ? 'unused: no unused files or dependencies (exports and types are warnings)'
    : 'unused: knip found unused files or dependencies (see above)',
);
process.exit(compact.status ?? 1);

// Policy (ARCH-001 §15.3, P1.3 gate): a pull request that changes a contract file must say so with a
// `CONTRACT-CHANGE:` line in its body and add a note under docs/contract-changes/.
//
// Contract files: libs/theme/schema/** (P1.3), apps/widget/src/bridge/protocol.ts (P1.5 onwards).
// Needs a pull request: reads GITHUB_EVENT_PATH and GITHUB_BASE_REF. Locally (no CI, D-22) it skips
// with a notice, because there is no PR body to read.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const CONTRACT = [
  /^libs\/theme\/schema\//,
  /^apps\/widget\/src\/bridge\/protocol\.ts$/,
];

const eventPath = process.env.GITHUB_EVENT_PATH;
const base = process.env.GITHUB_BASE_REF;
if (!eventPath || !base || !fs.existsSync(eventPath)) {
  console.log('check-contract-change: not a pull request; skipped (D-22)');
  process.exit(0);
}

const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
const body = event.pull_request?.body ?? '';
const changed = execFileSync(
  'git',
  ['diff', '--name-only', `origin/${base}...HEAD`],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);
const contractChanges = changed.filter((f) =>
  CONTRACT.some((re) => re.test(f)),
);

if (contractChanges.length === 0) {
  console.log('check-contract-change: no contract files changed');
  process.exit(0);
}
const problems = [];
if (
  !/^CONTRACT-CHANGE:\s*\S+/m.test(body) ||
  /^CONTRACT-CHANGE:\s*none\s*$/im.test(body)
) {
  problems.push('the PR body needs a "CONTRACT-CHANGE: <description>" line');
}
if (!changed.some((f) => f.startsWith('docs/contract-changes/'))) {
  problems.push('add a migration note under docs/contract-changes/');
}
if (problems.length) {
  console.error(
    `check-contract-change: contract files changed (${contractChanges.join(', ')}):\n  ${problems.join('\n  ')}`,
  );
  process.exit(1);
}
console.log(
  `check-contract-change: ${contractChanges.length} contract file(s) changed with a CONTRACT-CHANGE note`,
);

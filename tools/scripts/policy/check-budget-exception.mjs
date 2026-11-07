// Policy (ARCH-001 §14.3, P1.5-T07): widget bundle budgets follow the documented method.
//
// Always: every budget in apps/widget/budgets.json is ceil(baseline × 1.15) or smaller, unless the
// file records a written exception for it.
// In a pull request (GITHUB_EVENT_PATH and GITHUB_BASE_REF set): if budgets.json changed and a
// budget went up, the PR body needs a `BUDGET-EXCEPTION: <reason>` line. Locally (D-22) that part is
// skipped with a notice, because there is no PR body to read.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FILE = 'apps/widget/budgets.json';
const doc = JSON.parse(fs.readFileSync(path.join(process.cwd(), FILE), 'utf8'));
const problems = [];

for (const [name, budget] of Object.entries(doc.budgets)) {
  const baseline = doc.baseline[name];
  if (typeof baseline !== 'number') {
    problems.push(`${name}: no baseline`);
    continue;
  }
  const formula = Math.ceil(baseline * 1.15);
  if (budget > formula && !doc.exceptions?.[name])
    problems.push(
      `${name}: budget ${budget} exceeds ceil(${baseline} × 1.15) = ${formula} without an entry in exceptions`,
    );
}

const eventPath = process.env.GITHUB_EVENT_PATH;
const base = process.env.GITHUB_BASE_REF;
if (eventPath && base && fs.existsSync(eventPath)) {
  const body =
    JSON.parse(fs.readFileSync(eventPath, 'utf8')).pull_request?.body ?? '';
  let before = null;
  try {
    before = JSON.parse(
      execFileSync('git', ['show', `origin/${base}:${FILE}`], {
        encoding: 'utf8',
      }),
    );
  } catch {
    // budgets.json is new in this PR: every budget counts as raised.
  }
  const raised = Object.entries(doc.budgets).filter(
    ([name, budget]) => budget > (before?.budgets?.[name] ?? 0),
  );
  if (raised.length && !/^BUDGET-EXCEPTION:\s*\S+/m.test(body))
    problems.push(
      `budgets raised (${raised.map(([n]) => n).join(', ')}): the PR body needs a "BUDGET-EXCEPTION: <reason>" line`,
    );
} else {
  console.log(
    'check-budget-exception: not a pull request; PR trailer check skipped (D-22)',
  );
}

if (problems.length) {
  console.error(`check-budget-exception:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-budget-exception: ${Object.keys(doc.budgets).length} budgets follow the method (${Object.keys(doc.exceptions ?? {}).length} recorded exception)`,
);

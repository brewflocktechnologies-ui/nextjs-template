// Policy (ARCH-001 §14.3, P1.5-T07; D-29): bundle budgets follow the documented method.
//
// Files: apps/widget/budgets.json (widget bundles) and apps/admin-dashboard/budgets.json (dashboard
// first-load JS per route, D-29).
//
// Always: every budget is ceil(baseline × 1.15) or smaller, unless the file records a written
// exception for it.
// In a pull request (GITHUB_EVENT_PATH and GITHUB_BASE_REF set): if a budgets file changed and a
// budget went up, the PR body needs a `BUDGET-EXCEPTION: <reason>` line. Locally (D-22) that part is
// skipped with a notice, because there is no PR body to read.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FILES = ['apps/widget/budgets.json', 'apps/admin-dashboard/budgets.json'];
const problems = [];
const eventPath = process.env.GITHUB_EVENT_PATH;
const base = process.env.GITHUB_BASE_REF;
const inPr = Boolean(eventPath && base && fs.existsSync(eventPath));
const body = inPr
  ? (JSON.parse(fs.readFileSync(eventPath, 'utf8')).pull_request?.body ?? '')
  : '';
let budgets = 0;
let exceptions = 0;

for (const FILE of FILES) {
  const doc = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), FILE), 'utf8'),
  );
  budgets += Object.keys(doc.budgets).length;
  exceptions += Object.keys(doc.exceptions ?? {}).length;
  for (const [name, budget] of Object.entries(doc.budgets)) {
    const baseline = doc.baseline[name];
    if (typeof baseline !== 'number') {
      problems.push(`${FILE} ${name}: no baseline`);
      continue;
    }
    const formula = Math.ceil(baseline * 1.15);
    if (budget > formula && !doc.exceptions?.[name])
      problems.push(
        `${FILE} ${name}: budget ${budget} exceeds ceil(${baseline} × 1.15) = ${formula} without an entry in exceptions`,
      );
  }
  if (!inPr) continue;
  let before = null;
  try {
    before = JSON.parse(
      execFileSync('git', ['show', `origin/${base}:${FILE}`], {
        encoding: 'utf8',
      }),
    );
  } catch {
    // The file is new in this PR: every budget counts as raised.
  }
  const raised = Object.entries(doc.budgets).filter(
    ([name, budget]) => budget > (before?.budgets?.[name] ?? 0),
  );
  if (raised.length && !/^BUDGET-EXCEPTION:\s*\S+/m.test(body))
    problems.push(
      `${FILE}: budgets raised (${raised.map(([n]) => n).join(', ')}): the PR body needs a "BUDGET-EXCEPTION: <reason>" line`,
    );
}
if (!inPr)
  console.log(
    'check-budget-exception: not a pull request; PR trailer check skipped (D-22)',
  );
if (problems.length) {
  console.error(`check-budget-exception:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-budget-exception: ${budgets} budgets in ${FILES.length} files follow the method (${exceptions} recorded exception${exceptions === 1 ? '' : 's'})`,
);

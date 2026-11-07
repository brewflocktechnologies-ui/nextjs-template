// Policy (ARCH-001 §15.3, P1.3 and P1.7-T04): a change to a contract file must be announced with a
// `CONTRACT-CHANGE:` trailer and a note under docs/contract-changes/.
//
// Contract files: libs/theme/schema/** and apps/widget/src/bridge/protocol.ts. Creating a contract
// file is its first version, not a change; modifying or deleting one is a change.
// Pull request: the trailer comes from the PR body. Locally (D-22): from the commit messages since
// main, or POLICY_TRAILERS for a check before committing.
import { changedFiles, hasTrailer, prContext } from './lib.mjs';

const CONTRACT = [
  /^libs\/theme\/schema\//,
  /^apps\/widget\/src\/bridge\/protocol\.ts$/,
];

const changed = changedFiles('ACMRD');
const contractChanges = changedFiles('MD').filter((f) =>
  CONTRACT.some((re) => re.test(f)),
);

if (contractChanges.length === 0) {
  console.log('check-contract-change: no contract files changed');
  process.exit(0);
}
const where = prContext()
  ? 'the PR body'
  : 'a commit message (or POLICY_TRAILERS)';
const problems = [];
if (!hasTrailer('CONTRACT-CHANGE'))
  problems.push(`${where} needs a "CONTRACT-CHANGE: <description>" line`);
if (
  !changed.some(
    (f) => f.startsWith('docs/contract-changes/') && !f.endsWith('README.md'),
  )
)
  problems.push('add a migration note under docs/contract-changes/');
if (problems.length) {
  console.error(
    `check-contract-change: contract files changed (${contractChanges.join(', ')}):\n  ${problems.join('\n  ')}`,
  );
  process.exit(1);
}
console.log(
  `check-contract-change: ${contractChanges.length} contract file(s) changed with a CONTRACT-CHANGE note`,
);

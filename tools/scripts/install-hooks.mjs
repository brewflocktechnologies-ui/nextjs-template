// Points git at the repository's hooks in .githooks (D-29, P2.1-T20). Run by `pnpm install`
// (the root `prepare` script); safe to run again. Skipped in CI, outside a git checkout, and when
// core.hooksPath already points somewhere else (it says so instead of overriding it).
import { execFileSync } from 'node:child_process';

const git = (...args) => {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

if (process.env.CI) process.exit(0);
if (git('rev-parse', '--is-inside-work-tree') !== 'true') process.exit(0);
const current = git('config', '--get', 'core.hooksPath');
if (current && current !== '.githooks') {
  console.log(
    `install-hooks: core.hooksPath is already "${current}"; not changing it (the pre-commit hook is in .githooks)`,
  );
  process.exit(0);
}
if (current !== '.githooks') {
  git('config', 'core.hooksPath', '.githooks');
  console.log(
    'install-hooks: git hooks now run from .githooks (pre-commit: format, secrets, lint on staged files)',
  );
}

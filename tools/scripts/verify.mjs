// Local equivalent of .github/workflows/ci.yml on main (SPECS/DECISIONS.md D-22).
// Runs every gate in order, keeps going after a failure, and prints a summary table that
// is pasted into SPECS/evidence/<phase>.md in place of a CI link.
//
//   pnpm verify             all gates
//   pnpm verify --quick     skip end-to-end tests
//
// When a phase adds a gate to ci.yml, it adds the same step here.
import { execSync, spawnSync } from 'node:child_process';

const quick = process.argv.includes('--quick');

const steps = [
  { name: 'Policy checks', cmd: 'pnpm policy:check' },
  { name: 'Format check (all files)', cmd: 'pnpm nx format:check --all' },
  { name: 'TypeScript project references in sync', cmd: 'pnpm nx sync:check' },
  // Generated files are committed; every generator exposes build:check (P1.2 onwards).
  {
    name: 'Generated files up to date',
    cmd: 'pnpm nx run-many -t build:check --output-style=static',
  },
  {
    name: 'Lint, test, typecheck, build',
    cmd: 'pnpm nx run-many -t lint test typecheck build --output-style=static',
  },
  // Stories are component specs and tests (ADR-008): render, play() and axe in Chromium (PoC-B on).
  {
    name: 'Storybook builds and story tests',
    cmd: 'pnpm nx run-many -t build-storybook test-storybook --output-style=static',
  },
  {
    name: 'End-to-end, Chromium',
    cmd: 'pnpm nx run-many -t e2e --output-style=static -- --project=chromium',
    skip: quick,
  },
];

const git = (args) => {
  try {
    return execSync(`git ${args}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
};

const results = [];
for (const step of steps) {
  if (step.skip) {
    results.push({ name: step.name, status: 'skipped', seconds: 0 });
    continue;
  }
  console.log(`\n=== ${step.name}\n$ ${step.cmd}\n`);
  const start = Date.now();
  const r = spawnSync(step.cmd, { stdio: 'inherit', shell: true });
  results.push({
    name: step.name,
    status: r.status === 0 ? 'pass' : 'FAIL',
    seconds: Math.round((Date.now() - start) / 1000),
  });
}

const dirty =
  git('status --porcelain') !== '' ? ' (uncommitted changes present)' : '';
console.log('\n## verify summary\n');
console.log(`- Date: ${new Date().toISOString()}`);
console.log(`- Commit: ${git('rev-parse --short HEAD')}${dirty}`);
console.log(`- Branch: ${git('branch --show-current')}`);
console.log(
  `- Platform: ${process.platform} ${process.arch}, Node ${process.version}`,
);
console.log(`- Mode: ${quick ? 'quick (e2e skipped)' : 'full'}\n`);
console.log('| Step | Result | Seconds |');
console.log('| --- | --- | --- |');
for (const r of results)
  console.log(`| ${r.name} | ${r.status} | ${r.seconds} |`);

const failed = results.filter((r) => r.status === 'FAIL');
if (failed.length) {
  console.error(`\nverify failed: ${failed.map((r) => r.name).join(', ')}`);
  process.exit(1);
}
console.log('\nverify passed');

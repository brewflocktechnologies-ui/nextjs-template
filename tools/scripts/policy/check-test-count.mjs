// Policy (ARCH-001 §15.3, P1.7-T04): the number of tests never goes down silently.
//
//   node tools/scripts/policy/check-test-count.mjs          compare with tools/test-count.json
//   node tools/scripts/policy/check-test-count.mjs --write  record the current counts
//
// Counted per runner, then summed:
// - Vitest unit tests: each config run once with the JSON reporter;
// - Jest (dashboard): run with --json;
// - Storybook stories: exported stories in *.stories.* files without the `!test` tag (each story
//   is one test in test-storybook);
// - Playwright: `--list --project=chromium` (tests excluded by grepInvert are not listed).
// A lower count fails unless a `TESTS-REMOVED:` trailer explains it (PR body, or commit messages
// since main locally). A higher count passes and asks for --write.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hasTrailer } from './lib.mjs';

const root = process.cwd();
const FILE = path.join(root, 'tools', 'test-count.json');
/** Runs npx with arguments through the shell as one quoted command (works on Windows too). */
const run = (args, cwd) =>
  execSync(['npx', ...args.map((a) => JSON.stringify(a))].join(' '), {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });

const VITEST = [
  'libs/design-tokens/vitest.config.mts',
  'libs/theme/vitest.config.mts',
  'libs/chat-widget/vitest.config.mts',
  'libs/ui-react/vite.config.mts',
  'apps/widget/vite.config.mts',
  'apps/widget-playground/vite.config.mts',
];
const STORYBOOK = ['libs/ui-react/src', 'libs/chat-widget/src'];
const PLAYWRIGHT = ['apps/widget-playground', 'apps/admin-dashboard-e2e'];

function vitestCount(config) {
  const out = path.join(
    os.tmpdir(),
    `byteflock-count-${process.pid}-${path.basename(path.dirname(config))}.json`,
  );
  try {
    run(
      [
        'vitest',
        'run',
        '--config',
        path.basename(config),
        '--reporter=json',
        `--outputFile=${out}`,
        '--passWithNoTests',
      ],
      path.join(root, path.dirname(config)),
    );
  } catch {
    // Failing tests still produce a report; counting is not this script's job.
  }
  const n = fs.existsSync(out)
    ? JSON.parse(fs.readFileSync(out, 'utf8')).numTotalTests
    : 0;
  fs.rmSync(out, { force: true });
  return n;
}

function jestCount() {
  const out = path.join(
    os.tmpdir(),
    `byteflock-count-${process.pid}-jest.json`,
  );
  try {
    run(
      ['jest', '--json', `--outputFile=${out}`, '--silent'],
      path.join(root, 'apps', 'admin-dashboard'),
    );
  } catch {
    // Failing tests still produce a report.
  }
  const n = fs.existsSync(out)
    ? JSON.parse(fs.readFileSync(out, 'utf8')).numTotalTests
    : 0;
  fs.rmSync(out, { force: true });
  return n;
}

function storyCount(dir) {
  let n = 0;
  for (const rel of fs.readdirSync(path.join(root, dir), { recursive: true })) {
    if (!/\.stories\.tsx?$/.test(rel)) continue;
    const src = fs.readFileSync(path.join(root, dir, rel), 'utf8');
    if (/tags:\s*\[[^\]]*'!test'/.test(src)) continue;
    n += (src.match(/^export const [A-Z]\w*\s*(?::[^=]+)?=/gm) ?? []).length;
  }
  return n;
}

function playwrightCount(dir) {
  const text = run(
    ['playwright', 'test', '--list', '--project=chromium'],
    path.join(root, dir),
  );
  return Number(/Total: (\d+) tests?/.exec(text)?.[1] ?? 0);
}

const counts = {};
for (const c of VITEST) counts[`vitest:${path.dirname(c)}`] = vitestCount(c);
counts['jest:apps/admin-dashboard'] = jestCount();
for (const d of STORYBOOK) counts[`storybook:${d}`] = storyCount(d);
for (const d of PLAYWRIGHT) counts[`playwright:${d}`] = playwrightCount(d);
const total = Object.values(counts).reduce((a, b) => a + b, 0);

if (process.argv.includes('--write')) {
  fs.writeFileSync(
    FILE,
    JSON.stringify(
      {
        $comment:
          'Written by check-test-count.mjs --write. Never lower without a TESTS-REMOVED: trailer.',
        total,
        counts,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`check-test-count: recorded ${total} tests`);
  process.exit(0);
}

const recorded = fs.existsSync(FILE)
  ? JSON.parse(fs.readFileSync(FILE, 'utf8'))
  : { total: 0, counts: {} };
const lower = Object.entries(recorded.counts)
  .filter(([k, n]) => (counts[k] ?? 0) < n)
  .map(([k, n]) => `${k}: ${counts[k] ?? 0} < ${n}`);
if (lower.length && !hasTrailer('TESTS-REMOVED')) {
  console.error(
    `check-test-count: fewer tests than recorded, and no TESTS-REMOVED: trailer:\n  ${lower.join('\n  ')}`,
  );
  process.exit(1);
}
if (lower.length)
  console.log(
    `check-test-count: fewer tests, explained by TESTS-REMOVED: ${lower.join('; ')}`,
  );
const note =
  total > recorded.total
    ? ` (recorded ${recorded.total}; run with --write to raise the floor)`
    : '';
console.log(`check-test-count: ${total} tests${note}`);

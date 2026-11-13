// The one gate runner, locally and in CI (SPECS/DECISIONS.md D-22, D-26).
// Runs the gates of a profile in order, keeps going after a failure, collects every gate's
// machine-readable results into reports/, writes reports/quality-report.md, and prints the summary
// table that goes into SPECS/evidence/<phase>.md.
//
//   pnpm verify                          profile "full": every merge gate
//   pnpm verify --quick                  profile "quick": the same without end-to-end tests
//   pnpm verify --profile=<name>         one of the profiles below (CI jobs use them)
//   pnpm verify --affected --base=<ref>  only affected projects (pull requests); --head defaults to HEAD
//   pnpm verify --browser=firefox        the browser for end-to-end steps (default chromium)
//
// A new gate is added here once; ci.yml and nightly.yml only choose a profile.
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const profile = flag('quick') ? 'quick' : arg('profile', 'full');
const affected = flag('affected');
const base = arg('base', 'origin/main');
const head = arg('head', 'HEAD');
const browser = arg('browser', 'chromium');
const reportDir = path.resolve(root, arg('report-dir', 'reports'));
const inCI = process.env.GITHUB_ACTIONS === 'true';

const nx = (targets, extra = '') =>
  affected
    ? `pnpm nx affected -t ${targets} --base=${base} --head=${head} --output-style=static ${extra}`.trim()
    : `pnpm nx run-many -t ${targets} --output-style=static ${extra}`.trim();

// `targets`: the Nx targets whose test-output/reports/<dir> the step fills (see nx.json).
const STEPS = {
  database: {
    name: 'Database up and migrated',
    // CI runs Postgres as a service container, which cannot mount the init script, so roles and
    // the test database come from db:bootstrap there (P2.1-T14).
    cmd: inCI
      ? 'node tools/scripts/db/bootstrap.mjs && node tools/scripts/db/migrate.mjs && node tools/scripts/db/seed.mjs'
      : 'node tools/scripts/db/up.mjs && node tools/scripts/db/migrate.mjs',
    database: true,
  },
  policy: { name: 'Policy checks', cmd: 'pnpm policy:check' },
  format: {
    name: affected
      ? 'Format check (changed files)'
      : 'Format check (all files)',
    cmd: affected
      ? `pnpm nx format:check --base=${base} --head=${head}`
      : 'pnpm nx format:check --all',
  },
  sync: {
    name: 'TypeScript project references in sync',
    cmd: 'pnpm nx sync:check',
  },
  // Generated files are committed; every generator exposes build:check (P1.2 onwards).
  generated: {
    name: 'Generated files up to date',
    cmd: nx('build:check'),
  },
  // D-29: unused files and dependencies fail; unused exports and types are warnings (knip.jsonc).
  unused: {
    name: 'Unused code and dependencies',
    cmd: 'node tools/scripts/unused.mjs',
  },
  ltb: {
    name: 'Lint, test, typecheck, build',
    // D-29: `budgets` (dashboard route JS) runs after the dashboard build in the same Nx run.
    cmd: nx('lint test typecheck build budgets'),
    targets: { lint: 'lint', test: 'test', build: 'build', budgets: 'budgets' },
  },
  // Stories are component specs and tests (ADR-008): render, play() and axe in Chromium.
  storybook: {
    name: 'Storybook builds and story tests',
    cmd: nx('build-storybook test-storybook'),
    targets: { 'test-storybook': 'storybook' },
  },
  // One suite at a time: the dashboard suite edits the widget's static files that the playground
  // suite reads (P1.6 publish and allowlist flows).
  e2e: {
    name: `End-to-end, ${browser}`,
    cmd: nx('e2e', `--parallel=1 -- --project=${browser}`),
    targets: { e2e: 'e2e' },
  },
  'widget-build': {
    name: 'Widget build and bundle assertions',
    cmd: 'pnpm nx run @byteflock/widget:build --output-style=static',
    targets: { build: 'build' },
    projects: ['@byteflock/widget'],
  },
  smoke: {
    name: 'Playground smoke test',
    cmd: 'pnpm nx run @byteflock/widget-playground:e2e --output-style=static -- --project=chromium --grep @smoke',
    targets: { e2e: 'e2e' },
    projects: ['@byteflock/widget-playground'],
  },
  // P1.7-T03: snapshots are *-linux.png; run in the pinned Playwright image (CI, `pnpm visual`).
  visual: {
    name: 'Visual snapshots (playground and dashboard)',
    cmd: 'pnpm exec playwright test -c apps/widget-playground/playwright.config.mts --project=chromium --grep @visual && pnpm exec playwright test -c apps/admin-dashboard-e2e/playwright.config.mts --project=chromium --grep @visual',
    env: { VISUAL: '1' },
    targets: { e2e: 'e2e' },
    projects: [
      '@byteflock/widget-playground',
      '@byteflock/admin-dashboard-e2e',
    ],
  },
  // Baselines are an artifact, never committed (P1.7-T02). MEASURE is not part of the e2e hash,
  // so the cache is skipped.
  measure: {
    name: '@measure baselines',
    cmd: 'pnpm nx run @byteflock/widget-playground:e2e --skip-nx-cache --output-style=static -- --project=chromium --grep @measure',
    env: { MEASURE: '1' },
    targets: { e2e: 'e2e' },
    projects: ['@byteflock/widget-playground'],
  },
  // Budgets warn first (P1.7-T02); see lighthouserc.json.
  lighthouse: {
    name: 'Lighthouse on /settings/theme',
    cmd: 'pnpm dlx @lhci/cli@0.16.0 autorun --config=lighthouserc.json',
    lighthouse: true,
  },
};

const PROFILES = {
  full: [
    'database',
    'policy',
    'format',
    'sync',
    'generated',
    'unused',
    'ltb',
    'storybook',
    'e2e',
  ],
  quick: [
    'database',
    'policy',
    'format',
    'sync',
    'generated',
    'unused',
    'ltb',
    'storybook',
  ],
  windows: ['widget-build', 'smoke'],
  visual: ['database', 'visual'],
  browsers: ['database', 'e2e'],
  measure: ['widget-build', 'measure'],
  lighthouse: ['database', 'lighthouse'],
};
if (!PROFILES[profile]) {
  console.error(
    `verify: unknown profile "${profile}". Profiles: ${Object.keys(PROFILES).join(', ')}`,
  );
  process.exit(2);
}

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
const slug = (name) => name.replace(/^@/, '').replace(/[^\w.-]+/g, '-');
// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => s.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '');

/** Project name → root, from the Nx graph; with --affected, only the affected projects. */
function projectRoots() {
  const file = path.join(os.tmpdir(), `byteflock-graph-${process.pid}.json`);
  execSync(`pnpm nx graph --file=${JSON.stringify(file)}`, { stdio: 'ignore' });
  const nodes = JSON.parse(fs.readFileSync(file, 'utf8')).graph.nodes;
  fs.rmSync(file, { force: true });
  let names = Object.keys(nodes);
  if (affected) {
    names = JSON.parse(
      execSync(
        `pnpm nx show projects --affected --base=${base} --head=${head} --json`,
        { encoding: 'utf8' },
      ),
    );
  }
  return Object.fromEntries(names.map((n) => [n, nodes[n].data.root]));
}

/** Runs one shell command, echoing its output and keeping a copy in the step's log. */
function run(cmd, env, logFile) {
  return new Promise((resolve) => {
    const log = fs.createWriteStream(logFile);
    log.write(`$ ${cmd}\n\n`);
    const child = spawn(cmd, {
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, ...env, BYTEFLOCK_REPORT_DIR: reportDir },
    });
    const tee = (target) => (chunk) => {
      target.write(chunk);
      log.write(stripAnsi(chunk.toString()));
    };
    child.stdout.on('data', tee(process.stdout));
    child.stderr.on('data', tee(process.stderr));
    child.on('close', (code) => log.end(() => resolve(code ?? 1)));
  });
}

const steps = PROFILES[profile].map((id) => ({ id, ...STEPS[id] }));
const roots = projectRoots();
const scopeOf = (step) =>
  Object.entries(roots).filter(
    ([name]) => !step.projects || step.projects.includes(name),
  );
const reportsOf = (projectRoot, dir) =>
  path.join(root, projectRoot, 'test-output', 'reports', dir);

// Results of an earlier run must never look like this run's: clear the result folders this run
// fills. Nx restores them from its cache for tasks that do not run again.
// D-28: keep the metrics of the run this folder held, for the report's trend section.
let previousMetrics = null;
try {
  previousMetrics = fs.readFileSync(
    path.join(reportDir, 'metrics.json'),
    'utf8',
  );
} catch {
  // First run in this folder.
}
// Clear only what a run writes: the folder may hold other runs' folders (reports/linux, reports/visual).
for (const entry of [
  'details',
  'logs',
  'run.json',
  'metrics.json',
  'previous-metrics.json',
  'quality-report.md',
])
  fs.rmSync(path.join(reportDir, entry), { recursive: true, force: true });
fs.mkdirSync(path.join(reportDir, 'logs'), { recursive: true });
if (previousMetrics)
  fs.writeFileSync(
    path.join(reportDir, 'previous-metrics.json'),
    previousMetrics,
  );
for (const step of steps)
  for (const [, projectRoot] of scopeOf(step))
    for (const dir of Object.values(step.targets ?? {}))
      fs.rmSync(reportsOf(projectRoot, dir), { recursive: true, force: true });

const startedAt = new Date();
const results = [];
for (const step of steps) {
  console.log(`\n=== ${step.name}\n$ ${step.cmd}\n`);
  const start = Date.now();
  const code = await run(
    step.cmd,
    step.env ?? {},
    path.join(reportDir, 'logs', `${step.id}.log`),
  );
  results.push({
    id: step.id,
    name: step.name,
    cmd: step.cmd,
    status: code === 0 ? 'pass' : 'FAIL',
    seconds: Math.round((Date.now() - start) / 1000),
    log: `logs/${step.id}.log`,
    database: Boolean(step.database),
  });
}

// Collect: details/projects/<project>/<dir>/*.json, and Lighthouse's own output.
for (const step of steps) {
  for (const [name, projectRoot] of scopeOf(step)) {
    for (const dir of Object.values(step.targets ?? {})) {
      const from = reportsOf(projectRoot, dir);
      if (!fs.existsSync(from)) continue;
      fs.cpSync(
        from,
        path.join(reportDir, 'details', 'projects', slug(name), dir),
        {
          recursive: true,
        },
      );
    }
  }
  if (step.lighthouse) {
    const lhci = path.join(root, '.lighthouseci');
    if (fs.existsSync(lhci))
      fs.cpSync(lhci, path.join(reportDir, 'details', 'lighthouse'), {
        recursive: true,
      });
  }
}

const dirty = git('status --porcelain') !== '';
const run_ = {
  profile,
  label: process.env.BYTEFLOCK_RUN_LABEL || `${profile} · ${process.platform}`,
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  commit: git('rev-parse --short HEAD'),
  dirty,
  branch:
    git('branch --show-current') || process.env.GITHUB_HEAD_REF || 'unknown',
  platform: `${process.platform} ${process.arch}`,
  node: process.version,
  ci: inCI
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null,
  affected: affected ? { base, head } : null,
  browser,
  projects: Object.fromEntries(Object.keys(roots).map((n) => [n, slug(n)])),
  steps: results,
};
fs.writeFileSync(
  path.join(reportDir, 'run.json'),
  JSON.stringify(run_, null, 2) + '\n',
);

const report = await run(
  `node tools/scripts/report.mjs ${JSON.stringify(reportDir)} --out=${JSON.stringify(path.join(reportDir, 'quality-report.md'))}`,
  {},
  path.join(reportDir, 'logs', 'report.log'),
);

console.log('\n## verify summary\n');
console.log(`- Date: ${run_.finishedAt}`);
console.log(
  `- Commit: ${run_.commit}${dirty ? ' (uncommitted changes present)' : ''}`,
);
console.log(`- Branch: ${run_.branch}`);
console.log(`- Platform: ${run_.platform}, Node ${run_.node}`);
console.log(
  `- Profile: ${profile}${affected ? ` (affected, ${base}...${head})` : ''}${profile === 'quick' ? ' (e2e skipped)' : ''}`,
);
console.log(
  `- Report: ${path.relative(root, path.join(reportDir, 'quality-report.md'))}${report === 0 ? '' : ' (could not be written, see reports/logs/report.log)'}\n`,
);
console.log('| Step | Result | Seconds |');
console.log('| --- | --- | --- |');
for (const r of results)
  console.log(`| ${r.name} | ${r.status} | ${r.seconds} |`);

const failed = results.filter((r) => r.status === 'FAIL');
if (failed.length) {
  if (failed.some((r) => r.database))
    console.error(
      '\nThe database did not start, so the dashboard tests and e2e could not pass. Start Docker Desktop (Windows: WSL2 backend), then run `pnpm db:up` and `pnpm verify` again.',
    );
  console.error(`\nverify failed: ${failed.map((r) => r.name).join(', ')}`);
  process.exit(1);
}
if (report !== 0) process.exit(1);
console.log('\nverify passed');

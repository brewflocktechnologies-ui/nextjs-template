// Visual regression in the pinned Linux Playwright image (P1.7-T03).
//
//   pnpm visual             compare with the committed *-linux.png snapshots
//   pnpm visual --update    regenerate them (review the images before committing)
//   --report-dir=<dir>      where the run's results go (default reports/visual), D-28
//
// The repository is copied into the container without node_modules and installed there, so the
// host's Windows or macOS node_modules never mix with Linux binaries. A named volume keeps the pnpm
// store between runs. Snapshots are copied back; on failure, the diff images are copied to
// test-output/visual/. Never commit snapshots made outside this image.
//
// Like `pnpm verify`, it writes a run folder (run.json, the Playwright JSON of each suite, the log)
// and a quality report in it, so tools/scripts/report.mjs can merge it with the other runs (D-28).
import { execSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const IMAGE =
  'mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e';
const update = process.argv.includes('--update') ? '--update-snapshots' : '';

const SUITES = [
  [
    'apps/widget-playground',
    'src/tests/visual.spec.ts-snapshots',
    '@byteflock/widget-playground',
  ],
  [
    'apps/admin-dashboard-e2e',
    'src/visual.spec.ts-snapshots',
    '@byteflock/admin-dashboard-e2e',
  ],
];

// The run folder lives inside the repository, so the container sees it under /src.
const root = process.cwd();
const reportArg = process.argv.find((a) => a.startsWith('--report-dir='));
const reportDir = path.resolve(
  root,
  reportArg
    ? reportArg.slice('--report-dir='.length)
    : path.join('reports', 'visual'),
);
const reportRel = path.relative(root, reportDir).split(path.sep).join('/');
if (reportRel.startsWith('..') || path.isAbsolute(reportRel)) {
  console.error(
    'visual: --report-dir must be inside the repository (the container mounts only that)',
  );
  process.exit(2);
}
const slug = (name) => name.replace(/^@/, '').replace(/[^\w.-]+/g, '-');
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

const script = `
set -u
mkdir -p /work
cd /src
tar --exclude=./.git --exclude='node_modules' --exclude=./.nx --exclude='.next*' \\
    --exclude='dist' --exclude='storybook-static' --exclude='test-output' --exclude='out-tsc' \\
    --exclude=./reports \\
    -cf - . | tar -xf - -C /work
cd /work
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1 VISUAL=1
corepack enable >/dev/null
pnpm config set store-dir /pnpm-store >/dev/null
pnpm install --frozen-lockfile --reporter=silent || exit 2
status=0
${SUITES.map(
  ([project, snaps, name]) => `
PLAYWRIGHT_JSON_OUTPUT_FILE=/src/${reportRel}/details/projects/${slug(name)}/e2e/playwright.json \\
  pnpm exec playwright test -c ${project}/playwright.config.mts --project=chromium --grep @visual ${update} --reporter=line,json || status=1
mkdir -p /src/${project}/${snaps}
cp -r ${project}/${snaps}/. /src/${project}/${snaps}/ 2>/dev/null || true
if [ -d ${project}/test-output/playwright/output ]; then
  mkdir -p /src/test-output/visual/${project}
  cp -r ${project}/test-output/playwright/output/. /src/test-output/visual/${project}/ 2>/dev/null || true
fi`,
).join('\n')}
exit $status
`;

// P2.1-T14: the dashboard needs Postgres. The container reaches the host's database through
// host.docker.internal, on its own freshly seeded database (byteflock_visual), so local publishes
// in the stack database never change the screenshots.
const VISUAL_DB = 'byteflock_visual';
for (const [step, ...args] of [
  ['up.mjs'],
  ['recreate.mjs', `--database=${VISUAL_DB}`],
]) {
  const r = spawnSync(
    process.execPath,
    [path.join(root, 'tools', 'scripts', 'db', step), ...args],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) {
    console.error(`visual: ${step} failed; is Docker running?`);
    process.exit(1);
  }
}
const HOST_DB = 'host.docker.internal:5440';
const dbEnv = [
  `DATABASE_URL=postgres://byteflock_app:byteflock_app@${HOST_DB}/${VISUAL_DB}`,
  `MIGRATE_DATABASE_URL=postgres://byteflock:byteflock@${HOST_DB}/${VISUAL_DB}`,
  `RECREATE_ADMIN_URL=postgres://byteflock:byteflock@${HOST_DB}/postgres`,
].flatMap((e) => ['-e', e]);

// Run the container, echoing its output and keeping a copy in the run folder's log.
const started = new Date();
const log = fs.createWriteStream(path.join(reportDir, 'logs', 'visual.log'));
const result = await new Promise((resolve) => {
  const child = spawn(
    'docker',
    [
      'run',
      '--rm',
      '--ipc=host',
      '--add-host=host.docker.internal:host-gateway',
      ...dbEnv,
      '-v',
      `${root}:/src`,
      '-v',
      'byteflock-pnpm-store:/pnpm-store',
      IMAGE,
      'bash',
      '-c',
      script,
    ],
    { stdio: ['inherit', 'pipe', 'pipe'] },
  );
  const tee = (target) => (chunk) => {
    target.write(chunk);
    log.write(chunk);
  };
  child.stdout.on('data', tee(process.stdout));
  child.stderr.on('data', tee(process.stderr));
  child.on('error', (error) => log.end(() => resolve({ status: null, error })));
  child.on('close', (status) => log.end(() => resolve({ status })));
});
if (result.error) {
  console.error(`visual: could not run docker (${result.error.message})`);
  process.exit(1);
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
fs.writeFileSync(
  path.join(reportDir, 'run.json'),
  JSON.stringify(
    {
      profile: 'visual',
      label: process.env.BYTEFLOCK_RUN_LABEL || 'Visual (Linux container)',
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString(),
      commit: git('rev-parse --short HEAD'),
      dirty: git('status --porcelain') !== '',
      branch: git('branch --show-current'),
      platform: `linux container (${IMAGE.split('@')[0]})`,
      node: 'container',
      ci: null,
      affected: null,
      browser: 'chromium',
      projects: Object.fromEntries(
        SUITES.map(([, , name]) => [name, slug(name)]),
      ),
      steps: [
        {
          id: 'visual',
          name: update ? 'Visual snapshots (updated)' : 'Visual snapshots',
          cmd: `pnpm visual${update ? ' --update' : ''}`,
          status: result.status === 0 ? 'pass' : 'FAIL',
          seconds: Math.round((Date.now() - started.getTime()) / 1000),
          log: 'logs/visual.log',
          database: false,
        },
      ],
    },
    null,
    2,
  ) + '\n',
);
spawnSync(
  process.execPath,
  [path.join(root, 'tools', 'scripts', 'report.mjs'), reportDir],
  { stdio: 'inherit' },
);

console.log(
  result.status === 0
    ? `visual: ${update ? 'snapshots updated' : 'all snapshots match'}; report in ${reportRel}/quality-report.md`
    : `visual: failed; diffs are in test-output/visual/, report in ${reportRel}/quality-report.md`,
);
process.exit(result.status ?? 1);

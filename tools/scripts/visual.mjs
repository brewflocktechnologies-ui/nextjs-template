// Visual regression in the pinned Linux Playwright image (P1.7-T03).
//
//   pnpm visual             compare with the committed *-linux.png snapshots
//   pnpm visual --update    regenerate them (review the images before committing)
//
// The repository is copied into the container without node_modules and installed there, so the
// host's Windows or macOS node_modules never mix with Linux binaries. A named volume keeps the pnpm
// store between runs. Snapshots are copied back; on failure, the diff images are copied to
// test-output/visual/. Never commit snapshots made outside this image.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const IMAGE =
  'mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e';
const update = process.argv.includes('--update') ? '--update-snapshots' : '';

const SUITES = [
  ['apps/widget-playground', 'src/tests/visual.spec.ts-snapshots'],
  ['apps/admin-dashboard-e2e', 'src/visual.spec.ts-snapshots'],
];

const script = `
set -u
mkdir -p /work
cd /src
tar --exclude=./.git --exclude='node_modules' --exclude=./.nx --exclude='.next*' \\
    --exclude='dist' --exclude='storybook-static' --exclude='test-output' --exclude='out-tsc' \\
    -cf - . | tar -xf - -C /work
cd /work
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1 VISUAL=1
corepack enable >/dev/null
pnpm config set store-dir /pnpm-store >/dev/null
pnpm install --frozen-lockfile --reporter=silent || exit 2
status=0
${SUITES.map(
  ([project, snaps]) => `
pnpm exec playwright test -c ${project}/playwright.config.mts --project=chromium --grep @visual ${update} --reporter=line || status=1
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
    [path.join(process.cwd(), 'tools', 'scripts', 'db', step), ...args],
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

const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--ipc=host',
    '--add-host=host.docker.internal:host-gateway',
    ...dbEnv,
    '-v',
    `${process.cwd()}:/src`,
    '-v',
    'byteflock-pnpm-store:/pnpm-store',
    IMAGE,
    'bash',
    '-c',
    script,
  ],
  { stdio: 'inherit' },
);
if (result.error) {
  console.error(`visual: could not run docker (${result.error.message})`);
  process.exit(1);
}
console.log(
  result.status === 0
    ? `visual: ${update ? 'snapshots updated' : 'all snapshots match'}`
    : 'visual: failed; diffs are in test-output/visual/',
);
process.exit(result.status ?? 1);

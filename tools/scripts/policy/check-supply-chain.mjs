// Policy (P1.1-T09, ADR-011, T-09): the pnpm supply-chain settings are present and strict.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const problems = [];

const ws = fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))
  ? read('pnpm-workspace.yaml')
  : '';
if (!ws) problems.push('pnpm-workspace.yaml is missing');

const age = ws.match(/^minimumReleaseAge:\s*(\d+)\s*$/m);
if (!age || Number(age[1]) < 10080) {
  problems.push(
    `pnpm-workspace.yaml: minimumReleaseAge must be >= 10080 (7 days), found ${age ? age[1] : 'none'}`,
  );
}
if (!/^strictDepBuilds:\s*true\s*$/m.test(ws)) {
  problems.push('pnpm-workspace.yaml: strictDepBuilds must be true');
}
const allow = ws.match(/^allowBuilds:\s*\n((?:[ \t]+\S.*\n?)+)/m);
if (!allow)
  problems.push('pnpm-workspace.yaml: an explicit allowBuilds map is required');
if (/^dangerouslyAllowAllBuilds:\s*true/m.test(ws)) {
  problems.push('pnpm-workspace.yaml: dangerouslyAllowAllBuilds is forbidden');
}

const pkg = JSON.parse(read('package.json'));
if (!/^pnpm@\d+\.\d+\.\d+$/.test(pkg.packageManager ?? '')) {
  problems.push(
    `package.json: packageManager must pin an exact pnpm version, found ${pkg.packageManager ?? 'none'}`,
  );
}
if (pkg.workspaces)
  problems.push(
    'package.json: remove "workspaces"; pnpm-workspace.yaml defines them',
  );

for (const lock of ['package-lock.json', 'yarn.lock', 'npm-shrinkwrap.json']) {
  if (fs.existsSync(path.join(root, lock)))
    problems.push(`${lock} must not exist (pnpm only)`);
}
if (!fs.existsSync(path.join(root, 'pnpm-lock.yaml')))
  problems.push('pnpm-lock.yaml is missing');

const renovate = fs.existsSync(path.join(root, 'renovate.json'))
  ? JSON.parse(read('renovate.json'))
  : {};
if (!renovate.minimumReleaseAge)
  problems.push('renovate.json: minimumReleaseAge is required');

if (problems.length) {
  console.error(`check-supply-chain:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-supply-chain: pnpm ${pkg.packageManager.split('@')[1]}, 7-day release age, strict builds`,
);

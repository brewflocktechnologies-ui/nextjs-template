// Policy (ARCH-001 §15.3, ADR-011, P1.7-T04): every added dependency is explained and licensed.
//
// "Added" means a direct dependency in any package.json that the base ref does not have.
// - Explanation: in a pull request, the body names each added package; locally (D-22), some
//   SPECS/evidence/*.md names it (each phase records one sentence per new dependency).
// - Licence: MIT, BSD, Apache-2.0, ISC or 0BSD (and their MIT-0/CC0 equivalents). Anything else
//   needs a LICENSE-EXCEPTION: trailer, or an entry with a reason in tools/license-exceptions.json.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { atBase, git, hasTrailer, prContext } from './lib.mjs';

const root = process.cwd();
const ALLOWED = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  '0BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'CC0-1.0',
]);

const manifests = git('ls-files', '--', 'package.json', '*/package.json')
  .split('\n')
  .filter((f) => f && !f.includes('node_modules'));
const deps = (text) => {
  if (!text) return new Set();
  const p = JSON.parse(text);
  return new Set(
    [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ].flatMap((k) => Object.keys(p[k] ?? {})),
  );
};

const added = new Map(); // name → manifest
for (const file of manifests) {
  const before = deps(atBase(file));
  for (const name of deps(fs.readFileSync(path.join(root, file), 'utf8')))
    if (!before.has(name) && !name.startsWith('@byteflock/'))
      added.set(name, file);
}

if (added.size === 0) {
  console.log('check-dependency-diff: no dependencies added');
  process.exit(0);
}

// Licences of everything installed, by package name.
const licences = new Map();
try {
  const list = JSON.parse(
    execSync('pnpm licenses list --json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
  for (const [licence, pkgs] of Object.entries(list))
    for (const p of pkgs) licences.set(p.name, licence);
} catch {
  console.warn(
    'check-dependency-diff: could not list licences (pnpm licenses list failed)',
  );
}
const readLicence = (name) => {
  if (licences.has(name)) return licences.get(name);
  // Not in the list (some packages are omitted): read the installed manifest.
  for (const dir of [
    root,
    ...manifests.map((m) => path.join(root, path.dirname(m))),
  ]) {
    const pkg = path.join(dir, 'node_modules', name, 'package.json');
    if (fs.existsSync(pkg))
      return JSON.parse(fs.readFileSync(pkg, 'utf8')).license ?? 'Unknown';
  }
  return 'Unknown';
};
const exceptionsFile = path.join(root, 'tools', 'license-exceptions.json');
const exceptions = fs.existsSync(exceptionsFile)
  ? JSON.parse(fs.readFileSync(exceptionsFile, 'utf8')).exceptions
  : {};

const pr = prContext();
const explanation = pr
  ? pr.body
  : fs
      .readdirSync(path.join(root, 'SPECS', 'evidence'))
      .filter((f) => f.endsWith('.md'))
      .map((f) =>
        fs.readFileSync(path.join(root, 'SPECS', 'evidence', f), 'utf8'),
      )
      .join('\n');

const problems = [];
const report = [];
for (const [name, manifest] of [...added].sort()) {
  const licence = readLicence(name);
  const ok =
    ALLOWED.has(licence) ||
    /^\((MIT|ISC|Apache-2\.0|BSD-[23]-Clause)( OR [\w.-]+)+\)$/.test(licence);
  report.push(`${name} (${licence}) in ${manifest}`);
  if (!explanation.includes(name))
    problems.push(
      `${name}: not explained (${pr ? 'name it in the PR body' : 'add a sentence to the phase evidence file'})`,
    );
  if (!ok && !exceptions[name] && !hasTrailer('LICENSE-EXCEPTION'))
    problems.push(
      `${name}: licence ${licence} needs LICENSE-EXCEPTION: or an entry in tools/license-exceptions.json`,
    );
}

console.log(
  `check-dependency-diff: ${added.size} added since the base:\n  ${report.join('\n  ')}`,
);
if (problems.length) {
  console.error(`check-dependency-diff:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  'check-dependency-diff: every added dependency is explained and licensed',
);

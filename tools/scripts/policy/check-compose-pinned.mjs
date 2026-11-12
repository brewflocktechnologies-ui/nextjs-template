// Policy (P2.1-T14, AC14; ARCH-001 §13 T-09): every container image in compose.yaml is pinned by tag
// AND digest (`name:tag@sha256:<64 hex>`), and every Postgres image in a GitHub workflow is exactly
// the one in compose.yaml, so CI tests against the same database the developer runs.
//
// The check proves itself first: it runs its own negative cases (a tag-only image, a digest-only
// image, a short digest, a CI image that differs from compose) and fails if any of them passes.
import fs from 'node:fs';
import path from 'node:path';

const PINNED = /^[a-z0-9][a-z0-9./_-]*:[\w][\w.-]{0,127}@sha256:[0-9a-f]{64}$/;

/** `image:` values in a YAML text, with their line numbers. */
export function images(text) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^\s*-?\s*image:\s*['"]?([^'"#\s]+)['"]?\s*(?:#.*)?$/);
    if (m) out.push({ image: m[1], line: i + 1 });
  });
  return out;
}

/** Problems in compose.yaml text: no images, or an image without tag and digest. */
export function composeProblems(text, file = 'compose.yaml') {
  const found = images(text);
  if (found.length === 0) return [`${file}: no image found`];
  return found
    .filter((i) => !PINNED.test(i.image))
    .map(
      (i) =>
        `${file}:${i.line}: image is not pinned by tag and digest: ${i.image}`,
    );
}

/** Problems in a workflow: a Postgres image that is not exactly compose's. */
export function workflowProblems(text, composeImages, file) {
  const allowed = new Set(composeImages.map((i) => i.image));
  return images(text)
    .filter((i) => /(^|\/)postgres[:@]/.test(i.image) && !allowed.has(i.image))
    .map(
      (i) =>
        `${file}:${i.line}: Postgres image differs from compose.yaml: ${i.image}`,
    );
}

// --- Self-test: the negative cases must be refused. ---
const DIGEST = `sha256:${'a'.repeat(64)}`;
const GOOD = `postgres:17.11-alpine@${DIGEST}`;
const selfTest = [
  [
    'tag-only image',
    composeProblems(`services:\n  db:\n    image: postgres:17.11-alpine\n`),
  ],
  [
    'digest-only image',
    composeProblems(`services:\n  db:\n    image: postgres@${DIGEST}\n`),
  ],
  [
    'latest tag only',
    composeProblems(`services:\n  db:\n    image: postgres:latest\n`),
  ],
  [
    'short digest',
    composeProblems(`services:\n  db:\n    image: postgres:17@sha256:abc123\n`),
  ],
  ['no image at all', composeProblems(`services:\n  db:\n    build: .\n`)],
  [
    'CI Postgres image differs from compose',
    workflowProblems(
      `services:\n  db:\n    image: postgres:17.11-alpine\n`,
      images(`image: ${GOOD}`),
      'ci.yml',
    ),
  ],
];
const wronglyPassed = selfTest.filter(([, problems]) => problems.length === 0);
const positive = composeProblems(`services:\n  db:\n    image: '${GOOD}'\n`);
if (wronglyPassed.length || positive.length) {
  console.error(
    `check-compose-pinned: self-test failed: ${[
      ...wronglyPassed.map(([name]) => `${name} was accepted`),
      ...positive,
    ].join('; ')}`,
  );
  process.exit(1);
}

// --- The real files. ---
const root = process.cwd();
const composeFile = path.join(root, 'compose.yaml');
const problems = [];
let composeImages = [];
if (!fs.existsSync(composeFile)) {
  problems.push('compose.yaml: missing');
} else {
  const text = fs.readFileSync(composeFile, 'utf8');
  composeImages = images(text);
  problems.push(...composeProblems(text));
}
const dir = path.join(root, '.github', 'workflows');
const workflows = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))
  : [];
let ciPostgres = 0;
for (const file of workflows) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  ciPostgres += images(text).filter((i) =>
    /(^|\/)postgres[:@]/.test(i.image),
  ).length;
  problems.push(
    ...workflowProblems(text, composeImages, `.github/workflows/${file}`),
  );
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(
  `check-compose-pinned: ${composeImages.length} compose image(s) pinned by digest, ${ciPostgres} CI Postgres image(s) match; self-test ${selfTest.length} negative cases refused`,
);

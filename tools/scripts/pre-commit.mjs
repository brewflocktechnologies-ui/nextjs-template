// Pre-commit checks on the staged files (D-29, P2.1-T20), run by .githooks/pre-commit. Seconds, not
// minutes: `pnpm verify` stays the gate; this only catches the cheap problems before a commit.
//
// 1. Prettier --check on the staged files it understands.
// 2. The secret scan of check-secrets on the STAGED content (what the commit would contain), plus
//    its file-name rules (.env files, key files).
// 3. ESLint on staged JS/TS files, run in each project with that project's config. Files outside
//    a project (apps/<x>, libs/<x>) are not linted here, as in `pnpm verify`.
//
// Prettier and ESLint read the working tree, so for a partially staged file they check the
// working-tree version. Skip the hook once with `git commit --no-verify`.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileProblem, scanText } from './policy/check-secrets.mjs';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const git = (...args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
const staged = git(
  'diff',
  '--cached',
  '--name-only',
  '--diff-filter=ACMR',
  '-z',
)
  .split('\0')
  .filter(Boolean);
if (!staged.length) process.exit(0);

const problems = [];
const started = Date.now();
// Windows limits a command line to about 32k characters; pass files in batches.
const batches = (files, size = 80) =>
  Array.from({ length: Math.ceil(files.length / size) }, (_, i) =>
    files.slice(i * size, (i + 1) * size),
  );
const node = (script, args, cwd) =>
  spawnSync(process.execPath, [script, ...args], { cwd, stdio: 'inherit' })
    .status;

// 1. Formatting.
const prettier = path.join(
  root,
  'node_modules',
  'prettier',
  'bin',
  'prettier.cjs',
);
for (const batch of batches(
  staged.filter((f) => fs.existsSync(path.join(root, f))),
))
  if (
    node(
      prettier,
      ['--check', '--ignore-unknown', '--log-level=warn', ...batch],
      root,
    ) !== 0
  )
    problems.push(
      'formatting: run `pnpm nx format:write`, then stage the result',
    );

// 2. Secrets in what is about to be committed.
const BINARY =
  /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|mp4|webm)$/i;
const secrets = [];
for (const file of staged) {
  const named = fileProblem(file);
  if (named) secrets.push(`${file}: ${named}`);
  if (BINARY.test(file) || path.posix.basename(file) === 'pnpm-lock.yaml')
    continue;
  let text;
  try {
    text = git('show', `:${file}`);
  } catch {
    continue;
  }
  for (const f of scanText(file, text))
    secrets.push(`${f.file}:${f.line}: ${f.rule}`);
}
if (secrets.length) {
  console.error(
    `pre-commit: possible secrets in staged content:\n  ${secrets.join('\n  ')}`,
  );
  problems.push(
    'secrets: remove them, or mark a test fixture with `secret-scan: allow <reason>`',
  );
}

// 3. Lint, per project.
const eslint = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
const byProject = new Map();
for (const file of staged) {
  if (!/\.(m?[jt]sx?|cjs|cts|mts)$/.test(file)) continue;
  const m = /^((?:apps|libs)\/[^/]+)\/(.+)$/.exec(file);
  if (
    !m ||
    !fs.existsSync(path.join(root, m[1], 'eslint.config.mjs')) ||
    !fs.existsSync(path.join(root, file))
  )
    continue;
  byProject.set(m[1], [...(byProject.get(m[1]) ?? []), m[2]]);
}
for (const [project, files] of byProject)
  for (const batch of batches(files))
    if (
      node(
        eslint,
        ['--no-warn-ignored', ...batch],
        path.join(root, project),
      ) !== 0
    )
      problems.push(`lint: ${project}`);

const seconds = ((Date.now() - started) / 1000).toFixed(1);
if (problems.length) {
  console.error(
    `\npre-commit: commit stopped (${seconds} s):\n  ${[...new Set(problems)].join('\n  ')}\nSkip once with \`git commit --no-verify\`; \`pnpm verify\` still runs every gate.`,
  );
  process.exit(1);
}
console.log(
  `pre-commit: ${staged.length} staged file(s) formatted, no secrets, lint clean (${seconds} s)`,
);

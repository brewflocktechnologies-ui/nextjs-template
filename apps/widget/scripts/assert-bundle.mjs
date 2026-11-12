// Bundle assertions for the widget build (BOUND-05, T-10). Runs at the end of scripts/build.mjs and
// on its own: `node scripts/assert-bundle.mjs`.
//
// Fails when:
//   - any file under dist/v1 contains React or Next.js code;
//   - the loader contains a static `import` or more than one dynamic import;
//   - a gzip size exceeds its budget in budgets.json (P1.5-T07);
//   - an absolute URL in dist/v1 does not start with /v1/, or the loader lacks the versioned
//     element name (P1.5-T08).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const v1 = path.join(root, 'dist', 'v1');
const problems = [];

const files = fs
  .readdirSync(v1, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && /\.(js|html|css)$/.test(e.name))
  .map((e) => path.join(e.parentPath, e.name));

const LEAKS = [
  /react\.production/,
  /react-dom/,
  /__next/,
  /next\/dist/,
  /React\.createElement/,
  /__REACT_DEVTOOLS/,
];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const leak of LEAKS) {
    if (leak.test(text))
      problems.push(`${path.relative(root, file)}: contains ${leak}`);
  }
}

const loaderPath = path.join(v1, 'loader.js');
const loader = fs.readFileSync(loaderPath, 'utf8');
if (/(^|[;\s])import\s*[\w{*"']/.test(loader))
  problems.push('dist/v1/loader.js: contains a static import');
const dynamicImports = loader.match(/\bimport\(/g) ?? [];
if (dynamicImports.length !== 1)
  problems.push(
    `dist/v1/loader.js: expected 1 dynamic import, found ${dynamicImports.length}`,
  );
if (!/\/v1\/launcher\.[a-f0-9]+\.js/.test(loader))
  problems.push('dist/v1/loader.js: launcher path is not hashed');

const launcher = fs
  .readdirSync(v1)
  .find((f) => /^launcher\.[a-f0-9]+\.js$/.test(f));
if (!launcher) problems.push('dist/v1: no hashed launcher');

const frameAssets = path.join(v1, 'frame', 'assets');
const frameFiles = fs.existsSync(frameAssets)
  ? fs.readdirSync(frameAssets)
  : [];

const sizeOf = (files) => {
  const buf = Buffer.concat(files.map((f) => fs.readFileSync(f)));
  return {
    raw: buf.length,
    gzip: gzipSync(buf, { level: 9 }).length,
    brotli: brotliCompressSync(buf).length,
  };
};
const sizes = {
  loader: sizeOf([loaderPath]),
  launcher: launcher ? sizeOf([path.join(v1, launcher)]) : null,
  'frame JS': sizeOf(
    frameFiles
      .filter((f) => f.endsWith('.js'))
      .map((f) => path.join(frameAssets, f)),
  ),
  'frame CSS': sizeOf(
    frameFiles
      .filter((f) => f.endsWith('.css'))
      .map((f) => path.join(frameAssets, f)),
  ),
};

const budgetsFile = path.join(root, 'budgets.json');
const budgets = JSON.parse(fs.readFileSync(budgetsFile, 'utf8')).budgets;
console.log('\nwidget bundle sizes (bytes)');
for (const [name, s] of Object.entries(sizes)) {
  if (!s) continue;
  const budget = budgets[name];
  const over = budget !== undefined && s.gzip > budget;
  if (over)
    problems.push(
      `${name}: ${s.gzip} B gzip exceeds the budget of ${budget} B`,
    );
  console.log(
    `  ${name.padEnd(10)} raw ${String(s.raw).padStart(7)}  gzip ${String(s.gzip).padStart(6)}  brotli ${String(s.brotli).padStart(6)}${budget !== undefined ? `  budget ${budget}${over ? '  OVER' : ''}` : ''}`,
  );
}

console.log('\nwidget budgets (gzip bytes, actual / budget)');
for (const [name, s] of Object.entries(sizes)) {
  if (!s) continue;
  console.log(`  ${name}: ${s.gzip} / ${budgets[name] ?? 'none'}`);
  if (budgets[name] === undefined)
    problems.push(`${name}: no budget in budgets.json`);
}

// Versioned paths (P1.5-T08): every absolute URL the widget references lives under /v1/.
const ABSOLUTE = /["'`](\/[a-z0-9][\w.${}-]*(?:\/[\w.${}-]*)+)/gi;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [, url] of text.matchAll(ABSOLUTE)) {
    if (!url.startsWith('/v1/'))
      problems.push(
        `${path.relative(root, file)}: absolute URL ${url} is not under /v1/`,
      );
  }
}
if (!loader.includes('byteflock-chat-v1'))
  problems.push(
    'dist/v1/loader.js: the versioned element name byteflock-chat-v1 is missing',
  );

// D-26: sizes against budgets for the quality report (cached with the build, see package.json).
const reportFile = path.join(
  root,
  'test-output',
  'reports',
  'build',
  'budgets.json',
);
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(
  reportFile,
  JSON.stringify(
    {
      sizes: Object.fromEntries(
        Object.entries(sizes)
          .filter(([, s]) => s)
          .map(([name, s]) => [name, { ...s, budget: budgets[name] ?? null }]),
      ),
      problems,
    },
    null,
    2,
  ) + '\n',
);

if (problems.length) {
  console.error(`\nassert-bundle failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  'assert-bundle: no React/Next code, one dynamic import in the loader, all URLs under /v1/, budgets met\n',
);

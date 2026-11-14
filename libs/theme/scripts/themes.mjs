// Theme generation for repository themes (P2.4-T08, ADR-016). File work only; the generator itself
// is the platform-neutral module @byteflock/theme/generate, loaded through jiti.
//
//   node scripts/themes.mjs validate [--themeId=<id>]   G1–G7 without writing artifacts
//   node scripts/themes.mjs generate [--themeId=<id>]   write generated/themes/<id>/<version>/
//   node scripts/themes.mjs compare  [--themeId=<id>]   G8: committed artifacts equal a fresh run
//
// Themes are folders under themes/ holding theme.manifest.json. platform-default runs first: its
// artifact supplies optional tokens other themes do not map (SEM-03). A theme whose inputs (manifest,
// sources, generator version, contract, fallback) hash the same as its committed report is skipped.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libs = path.resolve(root, '..');
const themesDir = path.join(root, 'themes');
const outDir = path.join(root, 'generated', 'themes');
const reportsDir = path.join(root, 'test-output', 'reports', 'themes');

const jiti = createJiti(import.meta.url);
const gen = await jiti.import(path.join(root, 'src', 'generate-entry.ts'));

const [command = 'validate', ...args] = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--themeId='))?.slice(10);
if (!['validate', 'generate', 'compare'].includes(command)) {
  console.error(
    `themes: unknown command "${command}" (validate, generate, compare)`,
  );
  process.exit(2);
}

const sortDeep = (v) =>
  Array.isArray(v)
    ? v.map(sortDeep)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sortDeep(v[k])]),
        )
      : v;
const json = (v) => `${JSON.stringify(sortDeep(v), null, 2)}\n`;
const sha = (s) => createHash('sha256').update(s).digest('hex');
const posix = (p) => p.split(path.sep).join('/');

const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );

const ids = fs
  .readdirSync(themesDir, { withFileTypes: true })
  .filter(
    (e) =>
      e.isDirectory() &&
      fs.existsSync(path.join(themesDir, e.name, 'theme.manifest.json')),
  )
  .map((e) => e.name)
  .sort((a, b) =>
    a === 'platform-default'
      ? -1
      : b === 'platform-default'
        ? 1
        : a < b
          ? -1
          : 1,
  );
if (only && !ids.includes(only)) {
  console.error(`themes: no theme "${only}" (registered: ${ids.join(', ')})`);
  process.exit(2);
}

function load(id) {
  const dir = path.join(themesDir, id);
  const manifestText = fs.readFileSync(
    path.join(dir, 'theme.manifest.json'),
    'utf8',
  );
  const manifest = JSON.parse(manifestText);
  const files = {};
  for (const rel of Array.isArray(manifest?.source?.files)
    ? manifest.source.files
    : []) {
    const abs = path.resolve(dir, rel);
    // Sources stay inside libs/; a manifest cannot read the rest of the machine.
    if (!abs.startsWith(libs + path.sep))
      throw new Error(`${id}: ${rel} is outside libs/`);
    if (fs.existsSync(abs)) files[rel] = fs.readFileSync(abs, 'utf8');
  }
  const presentFiles = walk(dir)
    .filter(
      (f) => f.endsWith('.json') && path.basename(f) !== 'theme.manifest.json',
    )
    .map((f) => posix(path.relative(dir, f)));
  return { manifest, manifestText, files, presentFiles };
}

const contractHash = sha(json(gen.CONTRACT));
let fallback;
let failed = false;
const summary = [];

for (const id of ids) {
  const { manifest, manifestText, files, presentFiles } = load(id);
  const result = gen.generateTheme({
    manifest,
    files,
    presentFiles,
    fallback: id === 'platform-default' ? undefined : fallback,
  });
  if (id === 'platform-default') fallback = result.artifact ?? undefined;
  if (only && id !== only) continue;

  const inputs = {
    contract: contractHash,
    fallback:
      id === 'platform-default' || !fallback ? null : sha(json(fallback)),
    generator: gen.GENERATOR_VERSION,
    manifest: sha(manifestText),
    sources: Object.fromEntries(
      Object.keys(files)
        .sort()
        .map((f) => [f, sha(files[f])]),
    ),
  };
  const outputs = result.ok
    ? {
        'artifact.json': json(result.artifact),
        'preview.css': result.previewCss,
        'report.json': json({ inputs, report: result.report }),
        'report.md': result.reportMarkdown,
      }
    : null;
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportsDir, `${id}.json`),
    json({ command, ok: result.ok, report: result.report }),
  );

  const line = `${id} ${manifest?.version ?? '?'}: ${result.report.errors} errors, ${result.report.approvalsRequired} approvals needed`;
  if (!result.ok) {
    failed = true;
    summary.push(`✗ ${line}`);
    for (const f of result.report.findings.filter(
      (x) => x.severity === 'error',
    ))
      console.error(
        `  ${f.gate} ${f.path ?? ''} ${f.mode ?? ''} ${f.message}`.replace(
          /\s+/g,
          ' ',
        ),
      );
    continue;
  }
  const target = path.join(outDir, id, manifest.version);
  if (command === 'validate') {
    summary.push(`✓ ${line}`);
  } else if (command === 'compare') {
    const diff = Object.entries(outputs).filter(([name, text]) => {
      const p = path.join(target, name);
      return !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text;
    });
    if (diff.length) {
      failed = true;
      summary.push(
        `✗ ${line}; stale: ${diff.map(([n]) => n).join(', ')} (run "pnpm nx run @byteflock/theme:themes-generate")`,
      );
    } else summary.push(`✓ ${line}; committed artifacts match`);
  } else {
    const reportPath = path.join(target, 'report.json');
    const previous = fs.existsSync(reportPath)
      ? JSON.parse(fs.readFileSync(reportPath, 'utf8')).inputs
      : null;
    if (
      previous &&
      json(previous) === json(inputs) &&
      Object.keys(outputs).every((n) => fs.existsSync(path.join(target, n)))
    ) {
      summary.push(`= ${line}; unchanged`);
      continue;
    }
    fs.mkdirSync(target, { recursive: true });
    for (const [name, text] of Object.entries(outputs))
      fs.writeFileSync(path.join(target, name), text);
    summary.push(`✓ ${line}; written`);
  }
}

console.log(`themes ${command}:\n  ${summary.join('\n  ')}`);
process.exit(failed ? 1 : 0);

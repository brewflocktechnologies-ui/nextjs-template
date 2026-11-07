// Builds the design tokens (P1.2-T02/T03). Run from libs/design-tokens (the Nx targets do).
//
//   node scripts/build.mjs                 write outputs to src/generated/
//   node scripts/build.mjs --out <dir>     write outputs to <dir> (used by the determinism test)
//   node scripts/build.mjs --check         build to a temp dir and fail if src/generated is stale
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import StyleDictionary from 'style-dictionary';
import { createConfig } from '../style-dictionary.config.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const committed = path.join(projectRoot, 'src', 'generated');
const args = process.argv.slice(2);
const check = args.includes('--check');
const outArg = args.includes('--out')
  ? args[args.indexOf('--out') + 1]
  : undefined;

async function build(outDir) {
  process.chdir(projectRoot);
  fs.rmSync(outDir, { recursive: true, force: true });
  const sd = new StyleDictionary(
    createConfig(outDir.split(path.sep).join('/') + '/'),
  );
  await sd.buildAllPlatforms();
}

const listFiles = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) =>
          path
            .relative(dir, path.join(e.parentPath, e.name))
            .split(path.sep)
            .join('/'),
        )
        .sort()
    : [];

if (check) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'design-tokens-'));
  await build(tmp);
  const fresh = listFiles(tmp);
  const current = listFiles(committed);
  const stale = [...new Set([...fresh, ...current])].filter((f) => {
    const a = path.join(tmp, f);
    const b = path.join(committed, f);
    return (
      !fs.existsSync(a) ||
      !fs.existsSync(b) ||
      !fs.readFileSync(a).equals(fs.readFileSync(b))
    );
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (stale.length) {
    console.error(
      `design-tokens: generated files are stale. Run "pnpm nx run @byteflock/design-tokens:build" and commit:\n  ${stale.join('\n  ')}`,
    );
    process.exit(1);
  }
  console.log(`design-tokens: ${fresh.length} generated files are up to date`);
} else if (outArg) {
  const outDir = path.resolve(outArg);
  await build(outDir);
  console.log(
    `design-tokens: wrote ${listFiles(outDir).length} files to ${outDir}`,
  );
} else {
  // Never delete the committed outputs in place: other tasks (typecheck, tests) may read them
  // concurrently. Build to a temp dir, then copy over only what changed and drop what vanished.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'design-tokens-'));
  await build(tmp);
  const fresh = listFiles(tmp);
  let changed = 0;
  for (const f of fresh) {
    const from = path.join(tmp, f);
    const to = path.join(committed, f);
    if (fs.existsSync(to) && fs.readFileSync(from).equals(fs.readFileSync(to)))
      continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    changed++;
  }
  for (const f of listFiles(committed).filter((f) => !fresh.includes(f))) {
    fs.rmSync(path.join(committed, f));
    changed++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(
    `design-tokens: ${fresh.length} files in src/generated, ${changed} changed`,
  );
}

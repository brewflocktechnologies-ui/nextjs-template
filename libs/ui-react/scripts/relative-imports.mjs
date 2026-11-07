// Rewrites shadcn's self-referencing imports (`@byteflock/ui-react/...`) to relative paths.
//
// Why: shadcn writes imports through the aliases in components.json. Inside this project Nx's
// module-boundary rule forbids importing the project by its own name, and relative paths need no
// alias support from consumers that compile this library from source (Next.js, Vite).
//
//   node scripts/relative-imports.mjs          rewrite in place
//   node scripts/relative-imports.mjs --check  fail if any self-import is left (used in lint)
//
// Run it after every `pnpm dlx shadcn@<version> add …` in libs/ui-react.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const SELF = /(from\s+["'])@byteflock\/ui-react\/([^"']+)(["'])/g;
const check = process.argv.includes('--check');

const files = fs
  .readdirSync(src, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name))
  .map((e) => path.join(e.parentPath, e.name));

const offenders = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (!SELF.test(text)) continue;
  SELF.lastIndex = 0;
  offenders.push(path.relative(root, file));
  if (check) continue;
  const next = text.replace(SELF, (_m, open, target, close) => {
    let rel = path
      .relative(path.dirname(file), path.join(src, target))
      .split(path.sep)
      .join('/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return `${open}${rel}${close}`;
  });
  fs.writeFileSync(file, next);
}

if (check && offenders.length) {
  console.error(
    `self-imports of @byteflock/ui-react found; run node scripts/relative-imports.mjs:\n  ${offenders.join('\n  ')}`,
  );
  process.exit(1);
}
console.log(
  check
    ? 'ui-react: no self-imports'
    : `ui-react: rewrote self-imports in ${offenders.length} files`,
);

// Policy (P1.6-T08, D-13): the dashboard's development publish stub writes into
// apps/widget/public/v1. Those writes must never be committed: the widget's config and theme files
// must equal validation/widget-fixtures/v1. Undo a local publish with `pnpm stack:reset`.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fixtures = path.join(root, 'validation', 'widget-fixtures', 'v1');
const served = path.join(root, 'apps', 'widget', 'public', 'v1');

const list = (base) =>
  ['config', 'themes'].flatMap((dir) => {
    const abs = path.join(base, dir);
    return fs.existsSync(abs)
      ? fs
          .readdirSync(abs, { recursive: true, withFileTypes: true })
          .filter((e) => e.isFile())
          .map((e) => path.relative(base, path.join(e.parentPath, e.name)))
      : [];
  });

const expected = new Set(list(fixtures));
const actual = new Set(list(served));
const problems = [];
for (const rel of actual)
  if (!expected.has(rel)) problems.push(`extra: ${rel}`);
for (const rel of expected) {
  if (!actual.has(rel)) problems.push(`missing: ${rel}`);
  else if (
    !fs
      .readFileSync(path.join(fixtures, rel))
      .equals(fs.readFileSync(path.join(served, rel)))
  )
    problems.push(`changed: ${rel}`);
}

if (problems.length) {
  console.error(
    `check-no-local-publish: apps/widget/public/v1 differs from validation/widget-fixtures/v1 (a local publish?). Run "pnpm stack:reset":\n  ${problems.join('\n  ')}`,
  );
  process.exit(1);
}
console.log(
  `check-no-local-publish: ${actual.size} widget fixture files match`,
);

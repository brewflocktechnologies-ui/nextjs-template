// Policy (P1.1-AC06, BOUND-01): every workspace project carries exactly one tag from each
// dimension: type:*, scope:* and platform:*. Reads nx.tags from each project's package.json.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dimensions = ['type', 'scope', 'platform'];
const allowed = {
  type: ['app', 'lib'],
  scope: ['dashboard', 'widget', 'shared'],
  platform: ['react', 'lit', 'neutral'],
};

const projectDirs = ['apps', 'libs']
  .filter((d) => fs.existsSync(path.join(root, d)))
  .flatMap((d) =>
    fs
      .readdirSync(path.join(root, d), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(d, e.name)),
  )
  .filter((d) => fs.existsSync(path.join(root, d, 'package.json')));

const problems = [];
for (const dir of projectDirs) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, dir, 'package.json'), 'utf8'),
  );
  const tags = pkg.nx?.tags ?? [];
  for (const dim of dimensions) {
    const values = tags
      .filter((t) => t.startsWith(`${dim}:`))
      .map((t) => t.slice(dim.length + 1));
    if (values.length !== 1) {
      problems.push(
        `${pkg.name}: needs exactly one ${dim}:* tag, has ${values.length}`,
      );
    } else if (!allowed[dim].includes(values[0])) {
      problems.push(`${pkg.name}: unknown tag ${dim}:${values[0]}`);
    }
  }
  const unknown = tags.filter(
    (t) => !dimensions.some((d) => t.startsWith(`${d}:`)),
  );
  if (unknown.length)
    problems.push(`${pkg.name}: unknown tags ${unknown.join(', ')}`);
}

if (problems.length) {
  console.error(`check-tags:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-tags: ${projectDirs.length} projects tagged correctly`);

// Policy (P1.0-T05): .github/CODEOWNERS exists, assigns an owner to every protected path,
// and no longer contains the @OWNER placeholder.
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), '.github', 'CODEOWNERS');
const required = [
  '/docs/adr/',
  '/docs/architecture/',
  '/SPECS/',
  '/libs/theme/schema/',
  '/apps/widget/src/bridge/',
  '/.github/',
];

if (!fs.existsSync(file)) {
  console.error('.github/CODEOWNERS is missing');
  process.exit(1);
}
const rules = fs
  .readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split(/\s+/));

const problems = [];
for (const p of required) {
  const rule = rules.find(([pattern]) => pattern === p);
  if (!rule || rule.length < 2)
    problems.push(`.github/CODEOWNERS: no owner for ${p}`);
}
if (rules.some((r) => r.slice(1).includes('@OWNER'))) {
  problems.push(
    ".github/CODEOWNERS: replace the @OWNER placeholder with the architecture owner's GitHub handle",
  );
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`check-codeowners: ${required.length} protected paths have owners`);

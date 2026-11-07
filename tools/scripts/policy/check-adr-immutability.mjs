// Policy (ARCH-001 §15.3, ADR-010): an ADR whose status at the base ref is "Accepted" may only
// change its status line, add a "Superseded by" line, or edit inside its
// <!-- verification --> … <!-- /verification --> block. Accepted ADRs may not be deleted.
//
// Base ref: origin/$GITHUB_BASE_REF on pull requests, otherwise origin/main, falling back to main.
// The current side is the working tree, so uncommitted edits are checked too.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const git = (...args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
const refExists = (ref) => {
  try {
    git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
    return true;
  } catch {
    return false;
  }
};

const candidates = [
  process.env.GITHUB_BASE_REF && `origin/${process.env.GITHUB_BASE_REF}`,
  'origin/main',
  'main',
].filter(Boolean);
const base = candidates.find(refExists);
if (!base) {
  console.log('check-adr-immutability: no base ref found; skipped');
  process.exit(0);
}

let baseFiles = [];
try {
  baseFiles = git('ls-tree', '-r', '--name-only', base, '--', 'docs/adr')
    .split('\n')
    .filter((f) => /^docs\/adr\/ADR-\d+.*\.md$/.test(f));
} catch {
  baseFiles = [];
}

const statusOf = (text) => {
  const m =
    text.match(/^\|\s*Status\s*\|\s*([^|\n]+?)\s*\|/m) ||
    text.match(/^Status:\s*(.+)$/m);
  return m ? m[1].trim() : '';
};
const normalise = (text) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(
      /<!-- verification -->[\s\S]*?<!-- \/verification -->/g,
      '<!-- verification -->',
    )
    .split('\n')
    .filter((l) => !/^\|\s*Status\s*\|/.test(l) && !/^Status:/.test(l))
    .filter((l) => !/^\s*-?\s*\**Superseded by/i.test(l))
    .join('\n')
    .trim();

const problems = [];
let checked = 0;
for (const file of baseFiles) {
  const before = git('show', `${base}:${file}`);
  if (!/^Accepted\b/.test(statusOf(before))) continue;
  checked++;
  const abs = path.join(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    problems.push(`${file}: Accepted ADR was deleted; supersede it instead`);
    continue;
  }
  if (normalise(before) !== normalise(fs.readFileSync(abs, 'utf8'))) {
    problems.push(
      `${file}: Accepted ADR changed outside its status line, a "Superseded by" line or the verification block`,
    );
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(
  `check-adr-immutability: base ${base}, ${checked} Accepted ADR(s) unchanged`,
);

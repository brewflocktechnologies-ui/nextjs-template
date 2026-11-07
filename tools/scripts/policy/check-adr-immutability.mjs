// Policy (ARCH-001 §15.3, ADR-010): an ADR whose status is "Accepted" at a base ref may only
// change its status line, add a "Superseded by" line, or edit inside its
// <!-- verification --> … <!-- /verification --> block. Accepted ADRs may not be deleted.
//
// Bases: the PR base (origin/$GITHUB_BASE_REF), otherwise origin/main, falling back to main; and
// always HEAD. HEAD matters while CI is deferred (D-22): branches are stacked locally, so main may
// predate the ADRs entirely. The current side is the working tree, so uncommitted edits count.
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
const bases = [
  ...new Set(
    [candidates.find(refExists), refExists('HEAD') && 'HEAD'].filter(Boolean),
  ),
];
if (!bases.length) {
  console.log('check-adr-immutability: no base ref found; skipped');
  process.exit(0);
}

const adrFilesAt = (ref) => {
  try {
    return git('ls-tree', '-r', '--name-only', ref, '--', 'docs/adr')
      .split('\n')
      .filter((f) => /^docs\/adr\/ADR-\d+.*\.md$/.test(f));
  } catch {
    return [];
  }
};

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

const problems = new Set();
const checked = new Set();
for (const base of bases) {
  for (const file of adrFilesAt(base)) {
    const before = git('show', `${base}:${file}`);
    if (!/^Accepted\b/.test(statusOf(before))) continue;
    checked.add(file);
    const abs = path.join(process.cwd(), file);
    if (!fs.existsSync(abs)) {
      problems.add(`${file}: Accepted ADR was deleted; supersede it instead`);
      continue;
    }
    if (normalise(before) !== normalise(fs.readFileSync(abs, 'utf8'))) {
      problems.add(
        `${file}: Accepted ADR changed outside its status line, a "Superseded by" line or the verification block (compared with ${base})`,
      );
    }
  }
}

if (problems.size) {
  console.error([...problems].join('\n'));
  process.exit(1);
}
console.log(
  `check-adr-immutability: compared with ${bases.join(' and ')}; ${checked.size} Accepted ADR(s) unchanged`,
);

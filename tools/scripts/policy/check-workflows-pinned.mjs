// Policy (ARCH-001 §13 T-09, ADR-011): every `uses:` in a GitHub workflow is pinned to a
// 40-character commit SHA followed by a version comment, e.g.
//   uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
// Local actions (`./…`) and `docker://` images are exempt.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), '.github', 'workflows');
const files = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))
  : [];
const pinned = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+#\s*v\S+/;
const problems = [];

for (const file of files) {
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = line.match(/^\s*-?\s*uses:\s*(.+?)\s*$/);
    if (!m) return;
    const ref = m[1].replace(/^['"]|['"](?=\s|$)/g, '');
    if (ref.startsWith('./') || ref.startsWith('docker://')) return;
    if (!pinned.test(ref)) {
      problems.push(
        `.github/workflows/${file}:${i + 1}: not SHA-pinned with a version comment: ${ref}`,
      );
    }
  });
}

if (files.length === 0) {
  console.log('check-workflows-pinned: no workflow files found');
} else if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
} else {
  console.log(
    `check-workflows-pinned: ${files.length} workflow file(s), all actions pinned`,
  );
}

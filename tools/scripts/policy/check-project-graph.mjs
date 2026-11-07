// Policy (P1.1-AC01, P1.1-AC07, D-16): the workspace contains exactly the expected Nx projects,
// and their direct dependency edges match tools/scripts/policy/expected-graph.json.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const expected = JSON.parse(
  fs.readFileSync(path.join(here, 'expected-graph.json'), 'utf8'),
);
const out = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'nx-graph-')),
  'graph.json',
);

const r = spawnSync(`pnpm nx graph --file="${out}"`, {
  shell: true,
  encoding: 'utf8',
});
if (r.status !== 0 || !fs.existsSync(out)) {
  console.error(
    `check-project-graph: "nx graph" failed\n${r.stdout ?? ''}${r.stderr ?? ''}`,
  );
  process.exit(1);
}
const { graph } = JSON.parse(fs.readFileSync(out, 'utf8'));
fs.rmSync(path.dirname(out), { recursive: true, force: true });

const problems = [];
const actualProjects = Object.keys(graph.nodes).sort();
const expectedProjects = [...expected.projects].sort();
const missing = expectedProjects.filter((p) => !actualProjects.includes(p));
const extra = actualProjects.filter((p) => !expectedProjects.includes(p));
if (missing.length) problems.push(`missing projects: ${missing.join(', ')}`);
if (extra.length) problems.push(`unexpected projects: ${extra.join(', ')}`);

for (const project of expectedProjects) {
  if (!graph.dependencies[project]) continue;
  const actual = [
    ...new Set(
      graph.dependencies[project]
        .map((d) => d.target)
        .filter((t) => !t.startsWith('npm:')),
    ),
  ].sort();
  const want = [...(expected.edges[project] ?? [])].sort();
  if (actual.join() !== want.join()) {
    problems.push(
      `${project}: depends on [${actual.join(', ')}], expected [${want.join(', ')}]`,
    );
  }
}

if (problems.length) {
  console.error(`check-project-graph:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-project-graph: ${actualProjects.length} projects and their edges match`,
);

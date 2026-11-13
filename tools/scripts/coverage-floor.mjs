// Coverage floors (D-27, P2.1-T18).
//
//   node tools/scripts/coverage-floor.mjs --write   set tools/coverage-floor.json from the last
//                                                   unit-test run (rounded down to whole percent)
//   node tools/scripts/coverage-floor.mjs           print the measured values against the floors
//
// The floors only go up: --write refuses to lower one unless --allow-lower is passed, and
// check-coverage-floor then needs a COVERAGE-LOWERED: trailer for the lowered value. Run
// `pnpm nx run-many -t test --skip-nx-cache` first so the summaries are fresh.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const FILE = path.join(root, 'tools', 'coverage-floor.json');
export const METRICS = ['lines', 'statements', 'functions', 'branches'];

export function readSummary(project) {
  const file = path.join(
    root,
    project,
    'test-output',
    'reports',
    'test',
    'coverage',
    'coverage-summary.json',
  );
  if (!fs.existsSync(file)) return null;
  const total = JSON.parse(fs.readFileSync(file, 'utf8')).total;
  // A metric with nothing to measure reports 100%; as a floor that would fail the first time code
  // is added, so it counts as 0.
  return Object.fromEntries(
    METRICS.map((m) => [m, total[m].total === 0 ? 0 : total[m].pct]),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const floor = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const write = process.argv.includes('--write');
  const allowLower = process.argv.includes('--allow-lower');
  const problems = [];

  console.log(
    'project'.padEnd(28) + METRICS.map((m) => m.padStart(12)).join(''),
  );
  for (const [project, current] of Object.entries(floor.projects)) {
    const measured = readSummary(project);
    if (!measured) {
      problems.push(
        `${project}: no coverage-summary.json; run the unit tests first`,
      );
      continue;
    }
    console.log(
      project.padEnd(28) +
        METRICS.map((m) => `${measured[m]}/${current[m]}`.padStart(12)).join(
          '',
        ),
    );
    if (!write) continue;
    for (const m of METRICS) {
      const next = Math.floor(measured[m]);
      if (next < current[m] && !allowLower)
        problems.push(
          `${project} ${m}: measured ${measured[m]} is below the floor ${current[m]}; not lowering (pass --allow-lower and add COVERAGE-LOWERED:)`,
        );
      else floor.projects[project][m] = next;
    }
  }
  console.log('(measured / floor, percent)');
  if (problems.length) {
    console.error(`coverage-floor:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  if (write) {
    fs.writeFileSync(FILE, JSON.stringify(floor, null, 2) + '\n');
    console.log('coverage-floor: tools/coverage-floor.json written');
  }
}

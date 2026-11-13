// Policy (D-27, P2.1-T18): coverage floors are complete and only go up.
//
// - Every unit-test config that reads tools/coverage-floor.json names a project that has a floor
//   with all four numbers, and every floor belongs to such a config (a config that cannot find its
//   floor would silently enforce nothing).
// - A floor that is lower than at the base ref needs a `COVERAGE-LOWERED:` trailer (PR body, or the
//   commit messages since main locally), like `TESTS-REMOVED:` for the test count.
//
// With BYTEFLOCK_REPORT_DIR set, the floors are copied to details/coverage-floor.json for the report.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atBase, hasTrailer } from './lib.mjs';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
const FILE = 'tools/coverage-floor.json';
const METRICS = ['lines', 'statements', 'functions', 'branches'];

/** Pure: problems in a floor file, given the project keys the configs read. */
export function floorProblems(floor, configKeys) {
  const problems = [];
  const projects = floor?.projects ?? {};
  for (const key of configKeys)
    if (!projects[key])
      problems.push(
        `${key}: a config reads this floor but ${FILE} has none (the test run would enforce nothing)`,
      );
  for (const [key, floors] of Object.entries(projects)) {
    if (!configKeys.includes(key))
      problems.push(`${key}: has a floor but no unit-test config reads it`);
    for (const m of METRICS)
      if (!Number.isFinite(floors[m]) || floors[m] < 0 || floors[m] > 100)
        problems.push(`${key}.${m}: must be a number from 0 to 100`);
  }
  return problems;
}

/** Pure: the floors that are lower than at the base. */
export function loweredFloors(now, before) {
  const lowered = [];
  for (const [key, floors] of Object.entries(before?.projects ?? {}))
    for (const m of METRICS) {
      const current = now?.projects?.[key]?.[m];
      if (current === undefined || current < floors[m])
        lowered.push(`${key}.${m}: ${current ?? 'removed'} < ${floors[m]}`);
    }
  return lowered;
}

/** Negative cases; returns the ones that did not behave. */
export function selfTest() {
  const f = (n) => ({
    projects: {
      'libs/a': { lines: n, statements: n, functions: n, branches: n },
    },
  });
  const cases = [
    [
      'config without a floor',
      () => floorProblems(f(1), ['libs/a', 'libs/b']).length > 0,
    ],
    ['floor without a config', () => floorProblems(f(1), []).length > 0],
    ['a floor above 100', () => floorProblems(f(101), ['libs/a']).length > 0],
    [
      'a missing metric',
      () =>
        floorProblems({ projects: { 'libs/a': { lines: 1 } } }, ['libs/a'])
          .length > 0,
    ],
    ['a lowered floor', () => loweredFloors(f(50), f(60)).length === 4],
    [
      'a removed project',
      () => loweredFloors({ projects: {} }, f(60)).length === 4,
    ],
    ['a raised floor passes', () => loweredFloors(f(70), f(60)).length === 0],
    [
      'a complete file passes',
      () => floorProblems(f(10), ['libs/a']).length === 0,
    ],
  ];
  return cases.filter(([, ok]) => !ok()).map(([name]) => name);
}

function configKeys() {
  const keys = [];
  for (const top of ['apps', 'libs'])
    for (const project of fs.readdirSync(path.join(root, top), {
      withFileTypes: true,
    })) {
      if (!project.isDirectory()) continue;
      for (const file of fs.readdirSync(path.join(root, top, project.name))) {
        if (!/^(vite|vitest|jest)\.config\.(mts|cts|ts|js)$/.test(file))
          continue;
        const text = fs.readFileSync(
          path.join(root, top, project.name, file),
          'utf8',
        );
        if (!text.includes('coverage-floor.json')) continue;
        const key = /projects\[\s*['"]([^'"]+)['"]\s*\]/.exec(text)?.[1];
        keys.push(key ?? `${top}/${project.name} (no key found in ${file})`);
      }
    }
  return keys;
}

const broken = selfTest();
if (broken.length) {
  console.error(
    `check-coverage-floor: self-test failed, the check does not catch: ${broken.join('; ')}`,
  );
  process.exit(1);
}

const floor = JSON.parse(fs.readFileSync(path.join(root, FILE), 'utf8'));
const problems = floorProblems(floor, configKeys());
const before = atBase(FILE);
const lowered = before ? loweredFloors(floor, JSON.parse(before)) : [];

if (process.env.BYTEFLOCK_REPORT_DIR) {
  const out = path.join(
    process.env.BYTEFLOCK_REPORT_DIR,
    'details',
    'coverage-floor.json',
  );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify({ floors: floor.projects, lowered }, null, 2) + '\n',
  );
}

if (problems.length) {
  console.error(`check-coverage-floor:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
if (lowered.length && !hasTrailer('COVERAGE-LOWERED')) {
  console.error(
    `check-coverage-floor: floors are lower than at the base, and no COVERAGE-LOWERED: trailer explains it:\n  ${lowered.join('\n  ')}`,
  );
  process.exit(1);
}
console.log(
  `check-coverage-floor: ${Object.keys(floor.projects).length} projects have a complete floor${lowered.length ? `; lowered, explained by COVERAGE-LOWERED: ${lowered.join('; ')}` : '; none lowered'}`,
);

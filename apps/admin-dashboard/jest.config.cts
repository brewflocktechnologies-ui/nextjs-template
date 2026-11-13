const nextJest = require('next/jest.js');

// D-27: this project's coverage floor (tools/coverage-floor.json); raise it with
// `node tools/scripts/coverage-floor.mjs --write`.
const floor = require('../../tools/coverage-floor.json').projects[
  'apps/admin-dashboard'
];
const toJestThreshold = (f) => ({
  statements: f.statements,
  branches: f.branches,
  functions: f.functions,
  lines: f.lines,
});

const createJestConfig = nextJest({
  // __dirname, not './': the config then loads from any working directory (knip, D-29).
  dir: __dirname,
});

const config = {
  displayName: '@byteflock/admin-dashboard',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // D-27: coverage is collected on every run and must stay at or above the floor.
  coverageProvider: 'v8',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/generated/**',
  ],
  coverageDirectory: 'test-output/reports/test/coverage',
  coverageReporters: ['json-summary', 'text-summary'],
  coverageThreshold: { global: toJestThreshold(floor) },
  testEnvironment: 'jsdom',
  // D-26: test-output/reports/jest.json feeds the quality report; Nx caches it with the test task.
  reporters: ['default', '<rootDir>/../../tools/reporters/jest-json.cjs'],
};

const jestConfig = createJestConfig(config);

module.exports = async () => {
  const resolved = await jestConfig();
  // Disable SWC path alias resolution — handled by Nx jest resolver.
  for (const value of Object.values(resolved.transform)) {
    if (Array.isArray(value) && value[1]?.resolvedBaseUrl) {
      value[1] = { ...value[1], resolvedBaseUrl: undefined };
    }
  }
  return resolved;
};

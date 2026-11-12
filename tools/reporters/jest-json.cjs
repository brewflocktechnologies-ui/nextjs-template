// Jest reporter for the dashboard (D-26, P2.1-T17). Writes the run's results to
// <rootDir>/test-output/reports/test/jest.json in the same shape as Vitest's JSON reporter, so the
// quality report reads both the same way. Nx caches the file with the test task.
const fs = require('node:fs');
const path = require('node:path');

class JsonReporter {
  constructor(globalConfig) {
    this.rootDir = globalConfig.rootDir;
  }

  onRunComplete(_contexts, results) {
    const out = path.join(
      this.rootDir,
      'test-output',
      'reports',
      'test',
      'jest.json',
    );
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const report = {
      numTotalTests: results.numTotalTests,
      numPassedTests: results.numPassedTests,
      numFailedTests: results.numFailedTests,
      numPendingTests: results.numPendingTests + results.numTodoTests,
      success: results.success,
      testResults: results.testResults.map((file) => ({
        name: path
          .relative(this.rootDir, file.testFilePath)
          .split(path.sep)
          .join('/'),
        message: file.failureMessage ?? '',
        assertionResults: file.testResults.map((t) => ({
          fullName: t.fullName,
          title: t.title,
          status: t.status,
          duration: t.duration ?? 0,
          failureMessages: t.failureMessages,
        })),
      })),
    };
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  }
}

module.exports = JsonReporter;

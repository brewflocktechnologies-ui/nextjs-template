// ESLint formatter for every lint target (D-26, P2.1-T17; set in nx.json targetDefaults.lint).
// Prints the usual `stylish` output and also writes a compact JSON copy to
// <project>/test-output/reports/lint/eslint.json, which Nx caches with the lint task and
// tools/scripts/verify.mjs collects for the quality report.
import fs from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';

export default async function format(results, context) {
  const cwd = context?.cwd ?? process.cwd();
  const files = results
    .filter((r) => r.messages.length)
    .map((r) => ({
      file: path.relative(cwd, r.filePath).split(path.sep).join('/'),
      messages: r.messages.map((m) => ({
        ruleId: m.ruleId ?? null,
        severity: m.severity === 2 ? 'error' : 'warning',
        line: m.line ?? 0,
        message: m.message,
      })),
    }));
  const sum = (key) => results.reduce((n, r) => n + r[key], 0);
  const eslint = new ESLint({ cwd });
  // D-29: which JSX files the jsx-a11y rules actually check, so the report states real coverage.
  const jsx = results.filter((r) => /.(tsx|jsx)$/.test(r.filePath));
  let jsxA11yRules = 0;
  if (jsx.length) {
    const config = await eslint.calculateConfigForFile(jsx[0].filePath);
    jsxA11yRules = Object.entries(config?.rules ?? {}).filter(
      ([rule, setting]) =>
        rule.startsWith('jsx-a11y/') &&
        ![0, 'off'].includes(Array.isArray(setting) ? setting[0] : setting),
    ).length;
  }
  const out = path.join(cwd, 'test-output', 'reports', 'lint', 'eslint.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        filesLinted: results.length,
        errors: sum('errorCount'),
        warnings: sum('warningCount'),
        jsxFiles: jsx.length,
        jsxA11yRules,
        files,
      },
      null,
      2,
    ) + '\n',
  );
  const stylish = await eslint.loadFormatter('stylish');
  return stylish.format(results, context);
}

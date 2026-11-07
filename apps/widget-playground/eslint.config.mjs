import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  // Playwright rules apply to the Playwright specs only; Vitest specs live beside the source.
  { ...playwright.configs['flat/recommended'], files: ['src/tests/**/*.ts'] },
  ...baseConfig,
  {
    ignores: ['**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.js'],
    // Override or add rules here
    rules: {},
  },
];

import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';
import { tagRestrictions } from '../../tools/eslint/tag-restrictions.mjs';

export default [
  // Playwright rules apply to the Playwright specs only; Vitest specs live beside the source.
  { ...playwright.configs['flat/recommended'], files: ['src/tests/**/*.ts'] },
  ...baseConfig,
  {
    // public/ holds static host-page fixtures written like customer pages (and vendored rrweb).
    ignores: ['**/out-tsc', 'public/**'],
  },
  {
    files: ['**/*.ts', '**/*.js'],
    // Override or add rules here
    rules: {},
  },
  tagRestrictions(import.meta.dirname),
];

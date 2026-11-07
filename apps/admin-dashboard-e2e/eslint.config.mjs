import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';
import { tagRestrictions } from '../../tools/eslint/tag-restrictions.mjs';

export default [
  playwright.configs['flat/recommended'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    // Override or add rules here
    rules: {},
  },
  tagRestrictions(import.meta.dirname),
];

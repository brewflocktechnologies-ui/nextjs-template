import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';
import { tagRestrictions } from '../../tools/eslint/tag-restrictions.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    ignores: ['**/out-tsc'],
  },
  tagRestrictions(import.meta.dirname),
];

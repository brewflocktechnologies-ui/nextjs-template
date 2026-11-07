import baseConfig from '../../eslint.config.mjs';
import { tagRestrictions } from '../../tools/eslint/tag-restrictions.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/out-tsc'],
  },
  tagRestrictions(import.meta.dirname),
];

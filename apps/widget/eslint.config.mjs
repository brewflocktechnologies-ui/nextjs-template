import baseConfig from '../../eslint.config.mjs';
import { storageRestrictions } from '../../tools/eslint/storage-restrictions.mjs';
import { tagRestrictions } from '../../tools/eslint/tag-restrictions.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/out-tsc'],
  },
  tagRestrictions(import.meta.dirname),
  storageRestrictions(['src/frame/**/*.ts']),
];

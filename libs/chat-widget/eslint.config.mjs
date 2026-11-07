import baseConfig from '../../eslint.config.mjs';
import { storageRestrictions } from '../../tools/eslint/storage-restrictions.mjs';
import { tagRestrictions } from '../../tools/eslint/tag-restrictions.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/out-tsc', '**/storybook-static'],
  },
  tagRestrictions(import.meta.dirname),
  storageRestrictions(['src/**/*.ts']),
];

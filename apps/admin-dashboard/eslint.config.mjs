import nextEslintPluginNext from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';
import { tagRestrictions } from '../../tools/eslint/tag-restrictions.mjs';

export default [
  { plugins: { '@next/next': nextEslintPluginNext } },
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  {
    ignores: ['.next/**/*', '**/out-tsc'],
  },
  tagRestrictions(import.meta.dirname),
];

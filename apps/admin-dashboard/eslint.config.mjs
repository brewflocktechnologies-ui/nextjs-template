import nextEslintPluginNext from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';
import react from 'eslint-plugin-react';
import baseConfig from '../../eslint.config.mjs';
import byteflock from '../../tools/eslint-byteflock/index.mjs';
import { tagRestrictions } from '../../tools/eslint/tag-restrictions.mjs';

export default [
  { plugins: { '@next/next': nextEslintPluginNext } },
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  {
    ignores: ['.next/**/*', '.next-e2e-prod/**/*', '**/out-tsc'],
  },
  tagRestrictions(import.meta.dirname),
  // P1.6 rules (AC08): caching safety, tenant-scoped query keys, proxy imports, data access.
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: { byteflock },
    rules: {
      'byteflock/no-request-apis-in-cached-scope': 'error',
      'byteflock/qk-only': 'error',
      'byteflock/proxy-allowlist': 'error',
      'byteflock/data-access-tenant-first': 'error',
    },
  },
  // P1.6-AC10: pages use ui-react components, not raw form controls.
  {
    files: ['src/app/**/*.tsx'],
    plugins: { react },
    rules: {
      'react/forbid-elements': [
        'error',
        {
          forbid: ['button', 'input', 'select', 'textarea'].map((element) => ({
            element,
            message: 'use the @byteflock/ui-react component instead',
          })),
        },
      ],
    },
  },
];

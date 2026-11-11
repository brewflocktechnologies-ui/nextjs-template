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
  // P2.1-T05: `pg` is imported only inside src/server/db (ADR-012). Everything else goes through
  // withScope. Merged into the tag restrictions: a second no-restricted-imports entry would replace them.
  tagRestrictions(import.meta.dirname, {
    paths: [
      {
        name: 'pg',
        message:
          'import pg only inside src/server/db; use withScope from @/server/db (ADR-012).',
      },
    ],
  }),
  // ...except inside the database layer itself, which keeps the tag restrictions and may use pg.
  {
    ...tagRestrictions(import.meta.dirname),
    // Specs may use pg to arrange and clean up test data as the owner role.
    files: ['src/server/db/**/*.ts', 'specs/**/*.ts'],
  },
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

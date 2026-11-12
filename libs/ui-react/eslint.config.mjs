import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';
import { tagRestrictions } from '../../tools/eslint/tag-restrictions.mjs';
import { a11yAsErrors } from '../../tools/eslint/a11y-errors.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  // D-29: jsx-a11y rules fail lint instead of warning.
  a11yAsErrors(nx.configs['flat/react-jsx']),
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {},
  },
  {
    ignores: ['**/out-tsc', '**/storybook-static', 'src/generated/**'],
  },
  // P1.4-T09: the library never reads request APIs, and never ships the theme validator (TypeBox)
  // to the browser. Theme types and RESOLVED_KEYS come from @byteflock/theme/guard.
  tagRestrictions(import.meta.dirname, {
    paths: [
      {
        name: 'next/headers',
        message: 'ui-react must not read request APIs (P1.4-T09).',
      },
      {
        name: 'next/cache',
        message: 'ui-react must not read request APIs (P1.4-T09).',
      },
      {
        name: '@byteflock/theme',
        message:
          'Import from @byteflock/theme/guard (types, RESOLVED_KEYS); the root entry ships the validator (P1.4-T09).',
      },
    ],
  }),
];

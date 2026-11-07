// Restricted imports by project tag (SPECS/contracts/boundary-rules.md, BOUND-03).
// Each project's eslint.config.mjs calls tagRestrictions(import.meta.dirname); the helper reads
// that project's package.json nx.tags and returns one flat-config entry. Module-boundary
// constraints between workspace projects (BOUND-02) live in the root eslint.config.mjs.
import fs from 'node:fs';
import path from 'node:path';

const RULES = [
  {
    when: (tags) => tags.includes('platform:lit'),
    group: [
      'react',
      'react/*',
      'react-dom',
      'react-dom/*',
      'next',
      'next/*',
      '@byteflock/ui-react',
      '@byteflock/ui-react/*',
    ],
    message: 'React/Next must not enter widget bundles (BOUND-03, T-10).',
  },
  {
    when: (tags) => tags.includes('platform:react'),
    group: [
      'lit',
      'lit/*',
      'lit-html',
      'lit-html/*',
      'lit-element',
      'lit-element/*',
      '@lit/*',
      '@byteflock/chat-widget',
      '@byteflock/chat-widget/*',
    ],
    message: 'Lit must not enter React bundles (BOUND-03).',
  },
  {
    when: () => true,
    group: ['@radix-ui/*'],
    message:
      '@radix-ui/* is forbidden unless ADR-006 selects Radix (BOUND-03).',
  },
  {
    when: (tags) => tags.includes('type:lib'),
    group: [
      '@byteflock/admin-dashboard',
      '@byteflock/admin-dashboard/*',
      '@byteflock/admin-dashboard-e2e',
      '@byteflock/widget',
      '@byteflock/widget/*',
      '@byteflock/widget-playground',
      '**/apps/*',
    ],
    message: 'Libraries never import apps (BOUND-03).',
  },
];

export function tagRestrictions(projectDir) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'),
  );
  const tags = pkg.nx?.tags ?? [];
  const patterns = RULES.filter((r) => r.when(tags)).map(
    ({ group, message }) => ({ group, message }),
  );
  return {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.mts',
      '**/*.cts',
      '**/*.mjs',
      '**/*.cjs',
    ],
    rules: { 'no-restricted-imports': ['error', { patterns }] },
  };
}

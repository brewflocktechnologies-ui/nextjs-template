// Policy (P1.6-AC08): the custom ESLint rules in tools/eslint-byteflock pass their unit tests.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
const r = spawnSync(
  process.execPath,
  [
    '--test',
    '--test-reporter=dot',
    path.join(root, 'tools', 'eslint-byteflock', 'rules.test.mjs'),
  ],
  { stdio: 'inherit', cwd: root },
);
if (r.status === 0) console.log('check-eslint-rules: custom rule tests pass');
process.exit(r.status ?? 1);

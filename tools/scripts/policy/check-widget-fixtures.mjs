// Policy (P1.3-T12): the widget's tenant config and theme documents in validation/widget-fixtures are
// what tools/scripts/generate-widget-fixtures.mjs produces from validation/tenants.json and the theme
// fixtures. Edit the sources, regenerate, commit both.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const generator = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'generate-widget-fixtures.mjs',
);
const r = spawnSync(process.execPath, [generator, '--check'], {
  stdio: 'inherit',
});
process.exit(r.status ?? 1);

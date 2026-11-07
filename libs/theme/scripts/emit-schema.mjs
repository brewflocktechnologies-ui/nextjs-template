// Emits libs/theme/schema/theme.v1.json from src/schema/theme.v1.ts (P1.3-T04, THEME contract).
//
//   node scripts/emit-schema.mjs           write the schema
//   node scripts/emit-schema.mjs --check   fail if the committed schema differs from a fresh emit
//
// Node 24 runs the TypeScript schema directly (type stripping); it imports only TypeBox.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'schema', 'theme.v1.json');
const { ThemeV1 } = await import(
  pathToFileURL(path.join(root, 'src', 'schema', 'theme.v1.ts')).href
);

// JSON.stringify drops TypeBox's symbol keys; put $schema and $id first for readability.
const { $id, ...rest } = JSON.parse(JSON.stringify(ThemeV1));
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id,
  ...rest,
};
const text = JSON.stringify(schema, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const committed = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (committed !== text) {
    console.error(
      'theme: schema/theme.v1.json is stale. Run "pnpm nx run @byteflock/theme:build" and commit it (CONTRACT-CHANGE: trailer required).',
    );
    process.exit(1);
  }
  console.log('theme: schema/theme.v1.json is up to date');
} else {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const changed = !fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== text;
  if (changed) fs.writeFileSync(out, text);
  console.log(
    `theme: schema/theme.v1.json ${changed ? 'written' : 'unchanged'}`,
  );
}

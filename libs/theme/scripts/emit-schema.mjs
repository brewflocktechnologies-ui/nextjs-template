// Emits the theme library's JSON documents from their TypeScript sources (P1.3-T04, P2.4-T01):
//   schema/theme.v1.json             tenant theme contract v1 (THEME)
//   schema/theme-manifest.v1.json    theme manifest (D-30)
//   schema/theme-artifact.v1.json    theme artifact (ADR-014, ADR-016)
//   schema/platform-semantic.v1.json platform semantic contract as data (SEM)
//
//   node scripts/emit-schema.mjs           write them
//   node scripts/emit-schema.mjs --check   fail if a committed file differs from a fresh emit
//
// Node 24 runs the TypeScript sources directly (type stripping); they import only TypeBox.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => import(pathToFileURL(path.join(root, 'src', rel)).href);

// JSON.stringify drops TypeBox's symbol keys; put $schema and $id first for readability.
const asSchema = (typebox) => {
  const { $id, ...rest } = JSON.parse(JSON.stringify(typebox));
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id,
    ...rest,
  };
};

const { ThemeV1 } = await load('schema/theme.v1.ts');
const { ThemeManifestV1 } = await load('schema/theme-manifest.v1.ts');
const { ThemeArtifactV1 } = await load('schema/theme-artifact.v1.ts');
const contract = await load('contract/contract.ts');

const documents = {
  'theme.v1.json': asSchema(ThemeV1),
  'theme-manifest.v1.json': asSchema(ThemeManifestV1),
  'theme-artifact.v1.json': asSchema(ThemeArtifactV1),
  'platform-semantic.v1.json': {
    $comment:
      'Generated from libs/theme/src/contract/contract.ts. Contract: SPECS/contracts/platform-semantic-v1.md. Do not edit.',
    contract: contract.CONTRACT_ID,
    tokens: contract.CONTRACT,
    contrast: contract.CONTRAST_PAIRS,
    extensionName: contract.EXTENSION_NAME.source,
  },
};

const check = process.argv.includes('--check');
const stale = [];
for (const [name, doc] of Object.entries(documents)) {
  const out = path.join(root, 'schema', name);
  const text = JSON.stringify(doc, null, 2) + '\n';
  const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (check) {
    if (current !== text) stale.push(name);
    continue;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (current !== text) fs.writeFileSync(out, text);
  console.log(
    `theme: schema/${name} ${current !== text ? 'written' : 'unchanged'}`,
  );
}
if (check) {
  if (stale.length) {
    console.error(
      `theme: ${stale.map((n) => `schema/${n}`).join(', ')} stale. Run "pnpm nx run @byteflock/theme:build" and commit (CONTRACT-CHANGE: trailer required).`,
    );
    process.exit(1);
  }
  console.log(
    `theme: ${Object.keys(documents).length} schema files up to date`,
  );
}

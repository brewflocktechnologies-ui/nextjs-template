// Copies the curated fonts' Latin 400 and 600 woff2 files and licences from the @fontsource dev
// dependencies into public/v1/fonts/<family>/ (P1.5-T05). The frame CSP allows only
// `font-src 'self'`, so the fonts are served from the widget origin. Run after changing a version:
//
//   node scripts/vendor-fonts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Theme enum value → @fontsource package. `system` ships no files.
const FAMILIES = {
  inter: 'inter',
  roboto: 'roboto',
  'source-sans': 'source-sans-3',
  'noto-sans': 'noto-sans',
};

for (const [family, pkg] of Object.entries(FAMILIES)) {
  const from = path.join(root, 'node_modules', '@fontsource', pkg);
  const to = path.join(root, 'public', 'v1', 'fonts', family);
  fs.mkdirSync(to, { recursive: true });
  for (const weight of [400, 600]) {
    const file = `${pkg}-latin-${weight}-normal.woff2`;
    fs.copyFileSync(path.join(from, 'files', file), path.join(to, file));
  }
  fs.copyFileSync(path.join(from, 'LICENSE'), path.join(to, 'LICENSE'));
  console.log(`fonts: ${family} from @fontsource/${pkg}`);
}

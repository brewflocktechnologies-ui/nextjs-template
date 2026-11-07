// Copies the curated font files the widget vendors (apps/widget/scripts/vendor-fonts.mjs) into the
// dashboard's public/fonts, so the dashboard chrome uses the tenant's font too (P1.6-T04, D-20).
// One source for the files; global.css declares the @font-face rules. Run after the widget's script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(app, '..', 'widget', 'public', 'v1', 'fonts');
const to = path.join(app, 'public', 'fonts');
fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
console.log(`fonts: copied ${from} to ${to}`);

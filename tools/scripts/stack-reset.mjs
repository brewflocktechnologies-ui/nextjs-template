// Restores the widget's publishable data (config and themes) from the committed fixtures, undoing
// any local publish from the dashboard (SPECS/validation/local-stack.md, D-13).
//
//   pnpm stack:reset
//
// Source: validation/widget-fixtures/v1/{config,themes}   Target: apps/widget/public/v1/{config,themes}
// Other files under apps/widget/public/v1 (the frame placeholder, fonts) are not touched.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'validation', 'widget-fixtures', 'v1');
const target = path.join(root, 'apps', 'widget', 'public', 'v1');
const managed = ['config', 'themes'];

let copied = 0;
for (const dir of managed) {
  const to = path.join(target, dir);
  fs.rmSync(to, { recursive: true, force: true });
  const from = path.join(source, dir);
  if (!fs.existsSync(from)) continue;
  fs.cpSync(from, to, { recursive: true });
  copied += fs.readdirSync(from, { recursive: true }).length;
}

console.log(
  copied
    ? `stack:reset: restored ${copied} fixture entries into apps/widget/public/v1`
    : 'stack:reset: no fixtures yet (they arrive in PoC-A and P1.3); config/ and themes/ cleared',
);

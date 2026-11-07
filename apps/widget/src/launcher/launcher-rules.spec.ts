// @vitest-environment node
// PoC-A-AC12, T-06, T-10: the code that runs on the customer's page never uses network, storage,
// innerHTML or window.parent, and never imports React or Next.js. Checked on source, not on bundles,
// so the message names the file to fix.
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve(import.meta.dirname, '..');
const hostPageFiles = [
  path.join(src, 'loader.ts'),
  ...fs
    .readdirSync(path.join(src, 'launcher'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .map((f) => path.join(src, 'launcher', f)),
];

const FORBIDDEN: [string, RegExp][] = [
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['sendBeacon', /\bsendBeacon\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['innerHTML', /\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML/],
  ['document.write', /document\.write/],
  ['localStorage', /\blocalStorage\b/],
  ['sessionStorage', /\bsessionStorage\b/],
  ['indexedDB', /\bindexedDB\b/],
  ['document.cookie', /document\.cookie/],
  ['window.parent', /window\.parent\b|\bparent\.postMessage/],
  ['eval', /\beval\s*\(|new Function\s*\(/],
  ['react or next', /from\s+['"](react|react-dom|next)(\/[^'"]*)?['"]/],
];

describe('host-page code rules (loader and launcher)', () => {
  it('covers the loader and every launcher module', () => {
    expect(hostPageFiles.length).toBeGreaterThanOrEqual(3);
  });

  for (const file of hostPageFiles) {
    it(`PoC-A-AC12 ${path.relative(src, file)} uses no network, storage, innerHTML or window.parent`, () => {
      const code = fs
        .readFileSync(file, 'utf8')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      const hits = FORBIDDEN.filter(([, re]) => re.test(code)).map(([name]) => name);
      expect(hits).toEqual([]);
    });
  }

  it('the loader has no static imports', () => {
    const code = fs.readFileSync(path.join(src, 'loader.ts'), 'utf8');
    expect(code).not.toMatch(/^\s*import\s/m);
  });
});

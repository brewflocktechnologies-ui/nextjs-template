import fs from 'node:fs';
import path from 'node:path';
import { SEMANTIC_VARIABLE_NAMES } from '@byteflock/design-tokens';
import map from './shadcn-map.json';

const src = path.join(import.meta.dirname, '..');
const readDir = (dir: string) =>
  fs
    .readdirSync(path.join(src, dir))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => fs.readFileSync(path.join(src, dir, f), 'utf8'))
    .join('\n');

// The full shadcn theme vocabulary; a utility using any of these needs a mapping.
const SHADCN_COLORS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
];
const UTILITY =
  /(?<![\w-])(?:[a-z0-9-]+:)*(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|placeholder|caret|accent|decoration|divide|from|via|to|shadow)-([a-z0-9-]+)/g;
// Variables Base UI sets on elements at runtime.
const RUNTIME_VARS = new Set([
  '--anchor-width',
  '--available-height',
  '--transform-origin',
]);

describe('shadcn bridge (P1.4-T01)', () => {
  const ui = readDir('components/ui');

  it('P1.4-AC02 every mapped target is a design-token semantic variable', () => {
    const targets = [
      ...Object.values(map.colors),
      map.radius,
      map.fontSans,
      map.shadow,
      map.densityFactor,
      map.typeScale,
    ];
    for (const t of targets) expect(SEMANTIC_VARIABLE_NAMES).toContain(t);
  });

  it('P1.4-AC02 every shadcn colour used by a component utility is mapped', () => {
    const used = new Set<string>();
    for (const m of ui.matchAll(UTILITY)) {
      const name = m[1].replace(/\/\d+$/, '');
      if (SHADCN_COLORS.includes(name)) used.add(name);
    }
    expect(used.size).toBeGreaterThan(10);
    expect([...used].filter((n) => !(n in map.colors))).toEqual([]);
  });

  it('P1.4-AC02 every var(--…) a component reads is defined by the bridge or set at runtime', () => {
    const bridge = fs.readFileSync(
      path.join(src, 'generated', 'shadcn-bridge.css'),
      'utf8',
    );
    const defined = new Set(
      [...bridge.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]),
    );
    const read = new Set(
      [...ui.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]),
    );
    expect(
      [...read].filter((v) => !defined.has(v) && !RUNTIME_VARS.has(v)),
    ).toEqual([]);
  });
});

describe('bridge scope (P2.1-T11)', () => {
  it('declares the shadcn names on :root and inside a tenant preview container', () => {
    const css = fs.readFileSync(
      path.join(src, 'generated', 'shadcn-bridge.css'),
      'utf8',
    );
    expect(css).toMatch(/^:root,\n\[data-tenant-preview\] \{/m);
    expect(css).toContain('--primary: var(--sem-color-primary);');
  });
});

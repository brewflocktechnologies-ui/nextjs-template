import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCALES,
  SEMANTIC_DEFAULTS_DARK,
  SEMANTIC_DEFAULTS_LIGHT,
  SEMANTIC_VARIABLE_NAMES,
} from './generated/ts/tokens';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const generated = path.join(projectRoot, 'src', 'generated');
const css = fs.readFileSync(
  path.join(generated, 'css', 'semantic.css'),
  'utf8',
);

/** The 13 colour roles of the tenant theme contract (THEME-02), in CSS form. */
const THEME_ROLES = [
  'primary',
  'on-primary',
  'surface',
  'on-surface',
  'surface-variant',
  'on-surface-variant',
  'outline',
  'accent',
  'on-accent',
  'success',
  'warning',
  'danger',
  'focus-ring',
];

const buildInto = (dir: string) => {
  const r = spawnSync(process.execPath, ['scripts/build.mjs', '--out', dir], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  expect(r.status, r.stderr).toBe(0);
};
const readTree = (dir: string) =>
  Object.fromEntries(
    fs
      .readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => {
        const full = path.join(e.parentPath, e.name);
        return [path.relative(dir, full), fs.readFileSync(full, 'utf8')];
      }),
  );

describe('design-tokens build', () => {
  it('P1.2-AC01 is deterministic: two builds are byte-identical and match the committed outputs', () => {
    const a = fs.mkdtempSync(path.join(os.tmpdir(), 'tokens-a-'));
    const b = fs.mkdtempSync(path.join(os.tmpdir(), 'tokens-b-'));
    try {
      buildInto(a);
      buildInto(b);
      const treeA = readTree(a);
      expect(Object.keys(treeA).length).toBe(5);
      expect(treeA).toEqual(readTree(b));
      expect(treeA).toEqual(readTree(generated));
    } finally {
      fs.rmSync(a, { recursive: true, force: true });
      fs.rmSync(b, { recursive: true, force: true });
    }
    // Two full builds: about 1.5 s alone, over the 5 s default when every task runs cold in
    // parallel (seen in P2.1-T17, after nx.json changed every hash).
  }, 30_000);

  it('P1.2-AC03 emits no primitive token names in semantic.css', () => {
    expect(css).not.toMatch(
      /--(primitive|neutral|blue|teal|amber|violet|cyan|red|green|white|black)-/,
    );
    const names = css.match(/--[a-z0-9-]+(?=:)/g) ?? [];
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name.startsWith('--sem-')).toBe(true);
  });

  it('P1.2-AC04 defines every THEME-02 colour role in both appearances', () => {
    const [lightBlock, darkBlock] = css.split(
      /\[data-appearance="dark"\]\s*\{/,
    );
    for (const role of THEME_ROLES) {
      expect(lightBlock).toContain(`--sem-color-${role}:`);
      expect(darkBlock).toContain(`--sem-color-${role}:`);
      expect(SEMANTIC_DEFAULTS_LIGHT).toHaveProperty(`--sem-color-${role}`);
      expect(SEMANTIC_DEFAULTS_DARK).toHaveProperty(`--sem-color-${role}`);
    }
    expect(SEMANTIC_DEFAULTS_DARK['--sem-color-surface']).not.toBe(
      SEMANTIC_DEFAULTS_LIGHT['--sem-color-surface'],
    );
  });

  it('SEMANTIC_VARIABLE_NAMES equals the set of --sem- names in semantic.css', () => {
    const inCss = new Set(css.match(/--sem-[a-z0-9-]+(?=:)/g));
    expect(new Set(SEMANTIC_VARIABLE_NAMES)).toEqual(inCss);
  });

  it('P1.2-AC05 SCALES covers every THEME-02 enum value', () => {
    expect(Object.keys(SCALES.radius).sort()).toEqual(
      ['full', 'lg', 'md', 'none', 'sm'].sort(),
    );
    expect(Object.keys(SCALES.density).sort()).toEqual(
      ['comfortable', 'compact', 'spacious'].sort(),
    );
    expect(Object.keys(SCALES.typeScale).sort()).toEqual(['lg', 'md', 'sm']);
    expect(Object.keys(SCALES.elevation).sort()).toEqual([
      'flat',
      'low',
      'medium',
    ]);
    expect(Object.keys(SCALES.fontStacks).sort()).toEqual(
      ['inter', 'noto-sans', 'roboto', 'source-sans', 'system'].sort(),
    );
  });
});

describe('token sources (DTCG 2025.10 subset, ADR-003)', () => {
  const TOKEN_KEYS = new Set([
    '$value',
    '$type',
    '$description',
    '$deprecated',
    '$extensions',
  ]);
  const GROUP_META = new Set([
    '$description',
    '$type',
    '$deprecated',
    '$extensions',
  ]);
  const tokensDir = path.join(projectRoot, 'tokens');
  const files = fs
    .readdirSync(tokensDir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.tokens.json'))
    .map((e) => path.join(e.parentPath, e.name));

  type Node = Record<string, unknown>;
  const tokens = new Map<string, Node>();
  const problems: string[] = [];

  const walk = (node: Node, trail: string[], file: string) => {
    if ('$value' in node) {
      for (const key of Object.keys(node)) {
        if (!TOKEN_KEYS.has(key))
          problems.push(`${file}: ${trail.join('.')} has key ${key}`);
      }
      if (!('$type' in node))
        problems.push(`${file}: ${trail.join('.')} has no $type`);
      tokens.set(trail.join('.'), node);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) {
        if (!GROUP_META.has(key))
          problems.push(`${file}: group ${trail.join('.')} has key ${key}`);
        continue;
      }
      walk(child as Node, [...trail, key], file);
    }
  };
  for (const file of files) {
    walk(
      JSON.parse(fs.readFileSync(file, 'utf8')),
      [],
      path.relative(projectRoot, file),
    );
  }

  it('uses only $value, $type, $description, $deprecated and $extensions, and every token has a $type', () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
    expect(problems).toEqual([]);
  });

  it('resolves every alias', () => {
    const unresolved = [...tokens.entries()]
      .filter(([, t]) => typeof t.$value === 'string')
      .map(([name, t]) => [name, /^\{(.+)\}$/.exec(t.$value as string)?.[1]])
      .filter(([, target]) => target && !tokens.has(target))
      .map(([name, target]) => `${name} -> ${target}`);
    expect(unresolved).toEqual([]);
  });
});

describe('package (P1.2-AC06)', () => {
  it('has no runtime dependencies', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
    );
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
  });
});

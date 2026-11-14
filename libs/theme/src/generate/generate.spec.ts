// P2.4 tests: fixture matrix (T10), platform-default equivalence (AC01), determinism (AC02), output
// safety (AC03, property test), lossy reporting (AC05), extensions (AC06), contract data (T01).
import fs from 'node:fs';
import path from 'node:path';
import fc from 'fast-check';
import {
  SEMANTIC_DEFAULTS_DARK,
  SEMANTIC_DEFAULTS_LIGHT,
} from '@byteflock/design-tokens';
import {
  CONTRACT,
  generateTheme,
  type GenerateInput,
  type ThemeArtifact,
} from '../generate-entry';
import { RESOLVED_KEYS } from '../resolved-keys';
import { UNSAFE, num, serialise } from './values';
import { flattenDtcg, overlay, resolveToken } from './tokens';
import type { Finding } from './report';

const LIB = path.join(import.meta.dirname, '..', '..');
const CASES = path.join(LIB, 'fixtures', 'generate');

const walk = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );

/** Reads a theme folder the way scripts/themes.mjs does. */
function loadTheme(dir: string, fallback?: ThemeArtifact): GenerateInput {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dir, 'theme.manifest.json'), 'utf8'),
  );
  const files: Record<string, string> = {};
  for (const rel of manifest.source.files as string[]) {
    const abs = path.resolve(dir, rel);
    if (fs.existsSync(abs)) files[rel] = fs.readFileSync(abs, 'utf8');
  }
  const presentFiles = walk(dir)
    .filter(
      (f) =>
        f.endsWith('.json') &&
        !['theme.manifest.json', 'expected.json'].includes(path.basename(f)),
    )
    .map((f) => path.relative(dir, f).split(path.sep).join('/'));
  return { manifest, files, presentFiles, fallback };
}

const platform = generateTheme(
  loadTheme(path.join(LIB, 'themes', 'platform-default')),
);
const fallback = platform.artifact!;
const codes = (findings: Finding[], severity: Finding['severity']) =>
  [
    ...new Set(
      findings.filter((f) => f.severity === severity).map((f) => f.code),
    ),
  ].sort();

describe('platform-default (P2.4-AC01)', () => {
  it('regenerates every --sem-* value of semantic.css exactly, in both modes', () => {
    expect(platform.ok).toBe(true);
    expect(fallback.modes.light).toEqual(SEMANTIC_DEFAULTS_LIGHT);
    expect(fallback.modes.dark).toEqual({
      ...SEMANTIC_DEFAULTS_LIGHT,
      ...SEMANTIC_DEFAULTS_DARK,
    });
    expect(
      platform.report.findings.filter((f) => f.severity !== 'info'),
    ).toEqual([]);
  });

  it('matches the committed artifact', () => {
    const committed = JSON.parse(
      fs.readFileSync(
        path.join(
          LIB,
          'generated',
          'themes',
          'platform-default',
          '1.0.0',
          'artifact.json',
        ),
        'utf8',
      ),
    );
    expect(committed).toEqual(fallback);
  });
});

const caseNames = fs.readdirSync(CASES).sort();

describe('fixture matrix (P2.4-T10)', () => {
  it('covers the cases the spec lists', () => {
    expect(caseNames).toEqual(
      expect.arrayContaining([
        'valid-dtk-overlay',
        'malicious-values',
        'malicious-manifest',
        'cycle',
        'bad-pointer',
        'alpha-on-opaque',
        'out-of-gamut',
        'unknown-font',
        'extensions',
        'extension-namespace',
        'unresolved-reference',
        'missing-required',
        'contrast',
        'mode-dependent',
      ]),
    );
    for (const name of caseNames)
      expect(fs.existsSync(path.join(CASES, name, 'expected.json'))).toBe(true);
  });

  it.each(caseNames)('%s gives its expected outcome', (name) => {
    const expected = JSON.parse(
      fs.readFileSync(path.join(CASES, name, 'expected.json'), 'utf8'),
    );
    const r = generateTheme(loadTheme(path.join(CASES, name), fallback));
    expect({
      ok: r.ok,
      errors: codes(r.report.findings, 'error'),
      warnings: codes(r.report.findings, 'warning'),
    }).toEqual(expected);
    if (r.ok) {
      for (const mode of ['light', 'dark'] as const)
        for (const t of CONTRACT)
          expect(
            r.artifact!.modes[mode][t.variable],
            `${name} ${mode} ${t.variable}`,
          ).toBeDefined();
    } else {
      expect(r.artifact).toBeNull();
      expect(r.previewCss).toBeNull();
    }
  });
});

describe('a Design Token Kit-shaped theme', () => {
  const r = generateTheme(
    loadTheme(path.join(CASES, 'valid-dtk-overlay'), fallback),
  );
  const a = r.artifact!;

  it('overlays the dark file on the base file and reports each override', () => {
    expect(a.modes.light['--sem-color-surface']).toBe('#ffffff');
    expect(a.modes.dark['--sem-color-surface']).toBe('#0f172a');
    expect(
      r.report.findings.filter((f) => f.code === 'mode-override').length,
    ).toBeGreaterThan(5);
  });

  it('resolves $ref pointers and {path} references; converts OKLCH with a note', () => {
    expect(a.modes.light['--sem-color-primary']).toBe('#1d4ed8');
    expect(a.modes.light['--sem-color-on-primary']).toBe('#ffffff');
    expect(r.report.findings).toContainEqual(
      expect.objectContaining({
        code: 'converted-to-srgb',
        path: 'color.accent',
        mode: 'light',
      }),
    );
  });

  it('serialises fonts from the registry, shadows with alpha, and falls back for optional tokens', () => {
    expect(a.modes.light['--sem-font-family-sans']).toBe(
      'Inter, system-ui, sans-serif',
    );
    expect(a.modes.light['--sem-elevation-surface']).toBe(
      '0px 2px 6px 0px #0f172a26',
    );
    expect(a.modes.light['--sem-radius-md']).toBe('12px');
    expect(a.modes.light['--sem-space-4']).toBe(
      fallback.modes.light['--sem-space-4'],
    );
  });
});

describe('lossy conversions and extensions (P2.4-AC05, AC06)', () => {
  it('reports an out-of-gamut colour with original and result, as needing approval', () => {
    const r = generateTheme(
      loadTheme(path.join(CASES, 'out-of-gamut'), fallback),
    );
    const f = r.report.findings.find((x) => x.code === 'out-of-gamut')!;
    expect(f).toMatchObject({
      severity: 'warning',
      path: 'color.accent',
      mode: 'light',
      result: expect.stringMatching(/^#[0-9a-f]{6}$/),
    });
    expect(f.original).toEqual({
      colorSpace: 'display-p3',
      components: [0.42, 0, 0.75],
    });
    expect(r.report.approvalsRequired).toBe(1);
    expect(r.reportMarkdown).toContain('## Needs approval');
  });

  it('honours a hex fallback instead of converting', () => {
    const r = generateTheme(
      loadTheme(path.join(CASES, 'hex-fallback'), fallback),
    );
    expect(r.artifact!.modes.light['--sem-color-accent']).toBe('#6d28d9');
    expect(r.report.findings).toContainEqual(
      expect.objectContaining({ code: 'hex-fallback-used' }),
    );
  });

  it('emits extensions only in the theme namespace', () => {
    const r = generateTheme(
      loadTheme(path.join(CASES, 'extensions'), fallback),
    );
    expect(r.artifact!.extensions.light).toEqual({
      '--ext-fx-extensions-brand-glow': '#f97316',
    });
    expect(r.previewCss).toContain('--ext-fx-extensions-brand-glow: #f97316;');
  });
});

describe('determinism and safety (P2.4-AC02, AC03)', () => {
  it('gives identical output twice and with source files in another order', () => {
    const input = loadTheme(path.join(CASES, 'valid-dtk-overlay'), fallback);
    const reversed = {
      ...input,
      files: Object.fromEntries(Object.entries(input.files).reverse()),
    };
    const a = generateTheme(input);
    expect(JSON.stringify(generateTheme(input))).toBe(JSON.stringify(a));
    expect(JSON.stringify(generateTheme(reversed))).toBe(JSON.stringify(a));
  });

  it('never emits an unsafe value, for any string a source puts in a colour, font or dimension', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 40 }),
        fc.constantFrom(
          'color',
          'fontFamily',
          'dimension',
          'shadow',
          'number',
          'cubicBezier',
          'duration',
          'fontWeight',
        ) as fc.Arbitrary<Parameters<typeof serialise>[0]>,
        (s, type) => {
          const r = serialise(
            type,
            type === 'dimension' ? { value: 1, unit: s } : s,
          );
          return !r.ok || !UNSAFE.test(r.css);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('keeps every artifact value of every fixture free of forbidden sequences', () => {
    for (const name of caseNames) {
      const r = generateTheme(loadTheme(path.join(CASES, name), fallback));
      for (const vars of r.artifact
        ? [
            r.artifact.modes.light,
            r.artifact.modes.dark,
            r.artifact.extensions.light,
          ]
        : [])
        for (const v of Object.values(vars))
          expect(UNSAFE.test(v), `${name}: ${v}`).toBe(false);
    }
  });
});

describe('contract data (P2.4-T01)', () => {
  it('has 58 tokens with unique paths and variables; required ones equal the resolver allow-list', () => {
    expect(CONTRACT).toHaveLength(58);
    expect(new Set(CONTRACT.map((t) => t.path)).size).toBe(58);
    expect(new Set(CONTRACT.map((t) => t.variable)).size).toBe(58);
    expect(
      CONTRACT.filter((t) => t.required)
        .map((t) => t.variable)
        .sort(),
    ).toEqual([...RESOLVED_KEYS].sort());
  });

  it('names exactly the variables the platform tokens generate', () => {
    expect(CONTRACT.map((t) => t.variable).sort()).toEqual(
      Object.keys(SEMANTIC_DEFAULTS_LIGHT).sort(),
    );
  });
});

describe('values', () => {
  it.each([
    ['color', '#ABC', '#aabbcc'],
    ['color', { colorSpace: 'srgb', components: [1, 0, 0] }, '#ff0000'],
    ['color', { colorSpace: 'hsl', components: [0, 100, 50] }, '#ff0000'],
    ['dimension', { value: 1.5, unit: 'rem' }, '1.5rem'],
    ['duration', { value: 200, unit: 'ms' }, '200ms'],
    ['fontWeight', 'semi-bold', '600'],
    ['cubicBezier', [0.2, 0, 0, 1], 'cubic-bezier(0.2, 0, 0, 1)'],
    [
      'shadow',
      [
        {
          color: '#000000',
          offsetX: { value: 0, unit: 'px' },
          offsetY: { value: 1, unit: 'px' },
          blur: { value: 2, unit: 'px' },
          spread: { value: 0, unit: 'px' },
          inset: true,
        },
      ],
      'inset 0px 1px 2px 0px #000000',
    ],
  ] as const)('%s %j → %s', (type, value, css) => {
    const r = serialise(type, value, { alpha: true });
    expect(r.ok && r.css).toBe(css);
  });

  it.each([
    ['color', 'red'],
    ['color', { colorSpace: 'cmyk', components: [0, 0, 0] }],
    ['color', { colorSpace: 'srgb', components: [2, 0, 0] }],
    ['dimension', { value: 4, unit: 'em' }],
    ['dimension', '4px'],
    ['number', '1'],
    ['cubicBezier', [2, 0, 0, 1]],
    ['shadow', []],
    ['fontWeight', 2000],
  ] as const)('%s %j is refused', (type, value) => {
    expect(serialise(type, value).ok).toBe(false);
  });

  it('writes numbers without exponents', () => {
    expect(num(1e-7)).toBe('0.0000001');
    expect(num(1.25e-8)).toBe('0.0000000125');
    expect(num(1.5e21)).toBe('1500000000000000000000');
    expect(num(-2e-7)).toBe('-0.0000002');
    expect(num(-0)).toBe('0');
    expect(num(0.85)).toBe('0.85');
  });
});

describe('tokens', () => {
  it('reads $root as its group, inherits group types, and resolves pointers into composite properties', () => {
    const findings: Finding[] = [];
    const map = flattenDtcg(
      {
        size: {
          $type: 'dimension',
          $root: { $value: { value: 8, unit: 'px' } },
        },
        shadow: {
          $type: 'shadow',
          $value: { color: '#000000', offsetX: { value: 1, unit: 'px' } },
        },
        x: { $type: 'color', $value: { $ref: '#/shadow/$value/color' } },
      },
      'f.json',
      findings,
    );
    expect([...map.keys()]).toEqual(['size', 'shadow', 'x']);
    expect(map.get('size')!.type).toBe('dimension');
    expect(resolveToken(map, 'x')).toMatchObject({
      ok: true,
      value: '#000000',
    });
    expect(findings).toEqual([]);
  });

  it('later files override earlier ones in a mode', () => {
    const findings: Finding[] = [];
    const a = flattenDtcg(
      { c: { $type: 'color', $value: '#000000' } },
      'a',
      findings,
    );
    const b = flattenDtcg(
      { c: { $type: 'color', $value: '#ffffff' } },
      'b',
      findings,
    );
    const map = overlay(
      ['a', 'b'],
      new Map([
        ['a', a],
        ['b', b],
      ]),
      'dark',
      findings,
    );
    expect(map.get('c')!.value).toBe('#ffffff');
    expect(findings).toContainEqual(
      expect.objectContaining({ code: 'mode-override', severity: 'info' }),
    );
  });
});

describe('error paths', () => {
  const findings = (): Finding[] => [];

  it.each([
    [
      'alpha out of range',
      { colorSpace: 'srgb', components: [0, 0, 0], alpha: 2 },
    ],
    ['two components', { colorSpace: 'srgb', components: [0, 0] }],
    ['text component', { colorSpace: 'srgb', components: [0, 'x', 0] }],
    [
      'bad hex fallback',
      { colorSpace: 'display-p3', components: [1, 0, 0], hex: '#12' },
    ],
    ['not a colour', 42],
  ])('colour: %s is refused', (_, value) => {
    expect(serialise('color', value).ok).toBe(false);
  });

  it('colour: "none" components, 8-digit hex alpha and rounding to 8 bits', () => {
    expect(
      serialise('color', { colorSpace: 'oklch', components: [0.5, 0, 'none'] }),
    ).toMatchObject({ ok: true });
    expect(serialise('color', '#11223380', { alpha: true })).toMatchObject({
      ok: true,
      css: '#11223380',
    });
    const r = serialise('color', {
      colorSpace: 'srgb',
      components: [0.5, 0, 0],
    });
    expect(r.ok && r.notes[0].code).toBe('rounded-to-8-bit');
  });

  it.each([
    ['shadow', [1, 2, 3, 4].map(() => ({}))],
    ['shadow', ['not an object']],
    [
      'shadow',
      {
        color: '#000000',
        offsetX: { value: 0, unit: 'px' },
        offsetY: { value: 0, unit: 'px' },
        blur: { value: -1, unit: 'px' },
        spread: { value: 0, unit: 'px' },
      },
    ],
    [
      'shadow',
      {
        color: 'nope',
        offsetX: { value: 0, unit: 'px' },
        offsetY: { value: 0, unit: 'px' },
        blur: { value: 1, unit: 'px' },
        spread: { value: 0, unit: 'px' },
      },
    ],
    ['shadow', { color: '#000000' }],
    ['fontFamily', 7],
    ['fontFamily', []],
    ['duration', { value: -1, unit: 'ms' }],
    ['duration', '200ms'],
    ['number', Number.NaN],
    ['fontWeight', 'chunky'],
  ] as const)('%s %j is refused', (type, value) => {
    expect(serialise(type, value).ok).toBe(false);
  });

  it('tokens: non-object files, deep nesting, $extends and bad pointers are findings', () => {
    const f = findings();
    expect(flattenDtcg([], 'a.json', f).size).toBe(0);
    let deep: Record<string, unknown> = {
      leaf: { $type: 'number', $value: 1 },
    };
    for (let i = 0; i < 40; i++) deep = { g: deep };
    flattenDtcg(deep, 'deep.json', f);
    flattenDtcg(
      { g: { $extends: '{x}', t: { $type: 'number', $value: 1 } } },
      'ext.json',
      f,
    );
    expect(f.map((x) => x.code)).toEqual([
      'not-an-object',
      'too-deep',
      'extends-unsupported',
    ]);

    const map = flattenDtcg(
      {
        a: { $type: 'color', $value: { $ref: 'a/b' } },
        b: { $type: 'color', $value: { $ref: '#/a' } },
        c: { $type: 'color', $value: { $ref: '#/n/$value/x' } },
        n: { $type: 'number', $value: 5 },
        d: { $type: 'shadow', $value: { $ref: '#/s/$value/missing' } },
        s: { $type: 'shadow', $value: { color: '#000000' } },
        list: { $type: 'cubicBezier', $value: ['{n}', 0, 1, 1] },
        typed: { $value: '{n}' },
      },
      'r.json',
      f,
    );
    expect(resolveToken(map, 'a')).toMatchObject({
      ok: false,
      message: expect.stringContaining('must start with #/'),
    });
    expect(resolveToken(map, 'b')).toMatchObject({
      ok: false,
      message: expect.stringContaining("token's $value"),
    });
    expect(resolveToken(map, 'c')).toMatchObject({
      ok: false,
      message: expect.stringContaining('no property'),
    });
    expect(resolveToken(map, 'd')).toMatchObject({
      ok: false,
      message: expect.stringContaining('no property'),
    });
    expect(resolveToken(map, 'list')).toMatchObject({
      ok: true,
      value: [5, 0, 1, 1],
    });
    expect(resolveToken(map, 'typed')).toMatchObject({
      ok: true,
      type: 'number',
      chain: ['n'],
    });
    expect(resolveToken(map, 'missing')).toMatchObject({ ok: false });
  });

  it('tokens: a reference chain longer than 32 fails', () => {
    const doc: Record<string, unknown> = { t0: { $type: 'number', $value: 1 } };
    for (let i = 1; i <= 40; i++)
      doc[`t${i}`] = { $type: 'number', $value: `{t${i - 1}}` };
    const map = flattenDtcg(doc, 'chain.json', []);
    expect(resolveToken(map, 't40')).toMatchObject({
      ok: false,
      message: expect.stringContaining('longer than'),
    });
  });

  const base = () => loadTheme(path.join(CASES, 'valid-dtk-overlay'), fallback);

  it('generate: a mode file outside source.files, and an unknown font id, fail G1/G5', () => {
    const input = base();
    const manifest = JSON.parse(JSON.stringify(input.manifest));
    manifest.modes.dark.push('tokens/other.json');
    manifest.fonts = ['comic-sans'];
    const r = generateTheme({ ...input, manifest });
    expect(codes(r.report.findings, 'error')).toEqual([
      'font-unknown',
      'mode-file-undeclared',
    ]);
  });

  it('generate: an extension of an unsupported type is noted, not emitted', () => {
    const input = base();
    const manifest = JSON.parse(JSON.stringify(input.manifest));
    manifest.extensions = {
      namespace: manifest.themeId,
      tokens: { body: 'semantic.font.body', gone: 'semantic.nothing' },
    };
    const files = { ...input.files };
    const doc = JSON.parse(files['tokens/tokens.json']);
    doc.semantic.typo = {
      $type: 'typography',
      $value: { fontFamily: 'Inter' },
    };
    manifest.extensions.tokens.typo = 'semantic.typo';
    files['tokens/tokens.json'] = JSON.stringify(doc);
    const r = generateTheme({ ...input, manifest, files });
    expect(codes(r.report.findings, 'info')).toContain(
      'extension-type-unsupported',
    );
    expect(codes(r.report.findings, 'error')).toEqual(['reference']);
  });

  it('generate: without a fallback, unmapped optional tokens are simply absent', () => {
    const r = generateTheme({ ...base(), fallback: undefined });
    expect(r.ok).toBe(true);
    expect(r.artifact!.modes.light['--sem-space-4']).toBeUndefined();
    expect(Object.keys(r.artifact!.modes.light)).toHaveLength(18);
  });
});

describe('limits', () => {
  it('a file with more than 10,000 tokens is an error, never truncated silently', () => {
    const doc = Object.fromEntries(
      Array.from({ length: 10_001 }, (_, i) => [
        `t${i}`,
        { $type: 'number', $value: i },
      ]),
    );
    const f: Finding[] = [];
    flattenDtcg(doc, 'big.json', f);
    expect(f).toEqual([
      expect.objectContaining({ code: 'too-many-tokens', severity: 'error' }),
    ]);
  });
});

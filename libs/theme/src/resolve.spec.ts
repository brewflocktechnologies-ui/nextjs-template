import fc from 'fast-check';
import { SEMANTIC_VARIABLE_NAMES } from '@byteflock/design-tokens';
import { RESOLVED_KEYS } from './resolved-keys';
import { appearanceOf, resolveTheme } from './resolve';
import {
  APPEARANCE_MODES,
  COLOR_ROLES,
  DENSITIES,
  ELEVATIONS,
  FONT_FAMILIES,
  LAUNCHER_ICONS,
  LAUNCHER_POSITIONS,
  LAUNCHER_SHAPES,
  RADII,
  TYPE_SCALES,
  type Theme,
} from './schema/theme.v1';
import { validateTheme } from './validate';
import { fixture, fixtures } from './test-helpers';

const FORBIDDEN = /url\(|expression\(|[;{}<>\r\n]/i;

describe('resolver (THEME-03)', () => {
  it('every resolved key is a design-token semantic variable', () => {
    for (const key of RESOLVED_KEYS)
      expect(SEMANTIC_VARIABLE_NAMES).toContain(key);
  });

  for (const { name, doc } of fixtures('valid')) {
    for (const appearance of ['light', 'dark'] as const) {
      it(`P1.3-AC04 valid/${name} (${appearance}) emits exactly RESOLVED_KEYS and no forbidden characters`, () => {
        const vars = resolveTheme(doc as Theme, { appearance });
        expect(Object.keys(vars).sort()).toEqual([...RESOLVED_KEYS].sort());
        for (const value of Object.values(vars))
          expect(value).not.toMatch(FORBIDDEN);
      });
    }
  }

  for (const name of ['acme-light', 'globex-dark', 'initech-compact']) {
    for (const appearance of ['light', 'dark'] as const) {
      it(`P1.3-AC05 snapshot: ${name} (${appearance})`, () => {
        expect(
          resolveTheme(fixture('valid', name) as Theme, { appearance }),
        ).toMatchSnapshot();
      });
    }
  }

  it('maps enums through the token scales, never through tenant strings', () => {
    const vars = resolveTheme(fixture('valid', 'initech-compact') as Theme, {
      appearance: 'light',
    });
    expect(vars['--sem-radius-md']).toBe('9999px');
    expect(vars['--sem-density-factor']).toBe('0.85');
    expect(vars['--sem-type-scale']).toBe('0.875');
    expect(vars['--sem-elevation-surface']).toBe('0px 0px 0px 0px #00000000');
    expect(vars['--sem-font-family-sans']).toBe(
      '"Source Sans 3", system-ui, sans-serif',
    );
  });

  it('resolves system appearance from the viewer preference', () => {
    const theme = fixture('valid', 'all-enums-max') as Theme;
    expect(appearanceOf(theme, true)).toBe('dark');
    expect(appearanceOf(theme, false)).toBe('light');
    expect(appearanceOf(fixture('valid', 'globex-dark') as Theme, false)).toBe(
      'dark',
    );
  });

  it('property: any valid theme resolves to the allowed keys with safe values, deterministically', () => {
    const color = fc
      .integer({ min: 0, max: 0xffffff })
      .map((n) => `#${n.toString(16).padStart(6, '0')}`);
    const colorSet = fc.record(
      Object.fromEntries(COLOR_ROLES.map((r) => [r, color])) as Record<
        string,
        fc.Arbitrary<string>
      >,
    );
    const pick = <T extends readonly string[]>(values: T) =>
      fc.constantFrom(...values);
    const theme = fc.record({
      schemaVersion: fc.constant(1 as const),
      revision: fc.integer({ min: 1, max: 1_000_000 }),
      appearance: fc.record({ mode: pick(APPEARANCE_MODES) }),
      color: fc.record({ light: colorSet, dark: colorSet }),
      typography: fc.record({
        fontFamily: pick(FONT_FAMILIES),
        scale: pick(TYPE_SCALES),
      }),
      shape: fc.record({ radius: pick(RADII) }),
      elevation: pick(ELEVATIONS),
      density: pick(DENSITIES),
      brand: fc.record({
        name: fc
          .string({ minLength: 1, maxLength: 60 })
          // eslint-disable-next-line no-control-regex -- generates names without control characters
          .filter((s) => !/[\u0000-\u001f\u007f]/.test(s)),
      }),
      launcher: fc.record({
        position: pick(LAUNCHER_POSITIONS),
        shape: pick(LAUNCHER_SHAPES),
        icon: pick(LAUNCHER_ICONS),
      }),
    });
    fc.assert(
      fc.property(
        theme,
        fc.constantFrom('light' as const, 'dark' as const),
        (t, appearance) => {
          expect(validateTheme(t).ok).toBe(true);
          const vars = resolveTheme(t as Theme, { appearance });
          expect(Object.keys(vars).sort()).toEqual([...RESOLVED_KEYS].sort());
          for (const v of Object.values(vars)) expect(v).not.toMatch(FORBIDDEN);
          expect(resolveTheme(t as Theme, { appearance })).toEqual(vars);
        },
      ),
      { numRuns: 300 },
    );
  });
});

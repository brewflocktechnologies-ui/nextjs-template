import { isSupportedTheme, SUPPORTED_SCHEMA_VERSIONS } from './guard';
import { migrate, missingMigrations, ThemeMigrationError } from './migrate';
import { checkContrastPolicy, contrastRatio } from './policy';
import type { Theme } from './schema/theme.v1';
import { fixture, fixtures } from './test-helpers';

describe('shape guard (THEME-04)', () => {
  for (const { name, doc } of fixtures('valid')) {
    it(`P1.3-AC06 accepts valid/${name}`, () =>
      expect(isSupportedTheme(doc)).toBe(true));
  }
  for (const { name, doc } of fixtures('malicious')) {
    it(`P1.3-AC06 rejects malicious/${name}`, () =>
      expect(isSupportedTheme(doc)).toBe(false));
  }

  it('documents which invalid fixtures it lets through (bounds and extra keys only)', () => {
    const accepted = fixtures('invalid')
      .filter(({ doc }) => isSupportedTheme(doc))
      .map(({ name }) => name);
    // The guard checks shape and every value the resolver reads; it does not enforce the revision
    // bounds or additionalProperties. Those are the publish step's job (full schema).
    expect(accepted).toEqual([
      'extra-colour-key',
      'extra-root-key',
      'revision-fraction',
      'revision-zero',
    ]);
  });

  it('rejects unsupported schema versions and non-objects', () => {
    expect(
      isSupportedTheme({
        ...(fixture('valid', 'minimal') as object),
        schemaVersion: 99,
      }),
    ).toBe(false);
    expect(isSupportedTheme(null)).toBe(false);
    expect(isSupportedTheme('{"schemaVersion":1}')).toBe(false);
    expect(isSupportedTheme([])).toBe(false);
  });
});

describe('contrast policy (THEME-06, D-20)', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
  });

  for (const name of [
    'acme-light',
    'globex-dark',
    'initech-compact',
    'minimal',
  ]) {
    it(`P1.3-AC07 ${name} passes every rule in both appearances`, () => {
      expect(checkContrastPolicy(fixture('valid', name) as Theme)).toEqual([]);
    });
  }

  it('P1.3-AC07 the broken-contrast fixture fails on onPrimary/primary', () => {
    const broken = structuredClone(fixture('valid', 'acme-light')) as Theme;
    broken.color.light.onPrimary = broken.color.light.primary;
    const violations = checkContrastPolicy(broken);
    expect(violations.map((v) => `${v.appearance} ${v.pair}`)).toEqual([
      'light onPrimary/primary',
    ]);
    expect(violations[0].ratio).toBe(1);
  });
});

describe('migrations (THEME-07)', () => {
  it('returns an equal document for v1', () => {
    expect(migrate(fixture('migrated', 'v1-from-v1'))).toEqual(
      fixture('migrated', 'v1-from-v1'),
    );
  });

  it('refuses unsupported versions with a specific code', () => {
    const doc = {
      ...(fixture('valid', 'minimal') as object),
      schemaVersion: 99,
    };
    expect(() => migrate(doc)).toThrowError(ThemeMigrationError);
    try {
      migrate(doc);
    } catch (e) {
      expect((e as ThemeMigrationError).code).toBe('UNSUPPORTED_VERSION');
    }
  });

  it('refuses a v1 document that fails validation', () => {
    expect(() => migrate(fixture('invalid', 'unknown-font'))).toThrowError(
      ThemeMigrationError,
    );
  });

  it('every supported older version has a migration step', () => {
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual([1]);
    expect(missingMigrations()).toEqual([]);
  });
});

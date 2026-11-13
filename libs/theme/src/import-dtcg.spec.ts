import { COLOR_ROLES } from './schema/constants';
import { importDtcg, toHexColor } from './import-dtcg';
import { fixture } from './test-helpers';
import type { Theme } from './schema/theme.v1';

const token = (value: unknown) => ({ $type: 'color', $value: value });

/** A DTCG file for a valid theme: every role in both appearances. */
const fullFile = () => {
  const set = (hex: string) =>
    Object.fromEntries(COLOR_ROLES.map((r) => [r, token(hex)]));
  return { color: { light: set('#112233'), dark: set('#445566') } };
};

describe('DTCG importer', () => {
  it('imports a full colour set and fills presets', () => {
    const r = importDtcg({
      ...fullFile(),
      shape: { radius: { $value: 'lg' } },
      brand: { name: { $value: 'Acme' } },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.theme.color.light.primary).toBe('#112233');
    expect(r.theme.color.dark.focusRing).toBe('#445566');
    expect(r.theme.shape.radius).toBe('lg');
    expect(r.theme.brand.name).toBe('Acme');
  });

  it('round-trips an existing valid theme exported as DTCG', () => {
    const theme = fixture('valid', 'acme-light') as Theme;
    const wrap = (o: Record<string, string>) =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, token(v)]));
    const r = importDtcg({
      color: { light: wrap(theme.color.light), dark: wrap(theme.color.dark) },
      appearance: { mode: { $value: theme.appearance.mode } },
      typography: {
        fontFamily: { $value: theme.typography.fontFamily },
        scale: { $value: theme.typography.scale },
      },
      shape: { radius: { $value: theme.shape.radius } },
      elevation: { $value: theme.elevation },
      density: { $value: theme.density },
      brand: { name: { $value: theme.brand.name } },
      launcher: {
        position: { $value: theme.launcher.position },
        shape: { $value: theme.launcher.shape },
        icon: { $value: theme.launcher.icon },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.theme.color).toEqual(theme.color);
  });

  it('accepts kebab-case role names, group $type and aliases', () => {
    const r = importDtcg({
      color: {
        $type: 'color',
        light: {
          'on-primary': { $value: '#ffffff' },
          primary: { $value: '{color.light.on-primary}' },
        },
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.theme.color.light.onPrimary).toBe('#ffffff');
    expect(r.theme.color.light.primary).toBe('#ffffff');
  });

  it('uses platform defaults for missing roles and says so', () => {
    const r = importDtcg({ color: { light: { primary: token('#abcdef') } } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.theme.color.light.primary).toBe('#abcdef');
    expect(r.warnings.some((w) => w.includes('color.dark.primary'))).toBe(true);
  });

  it('ignores unknown tokens with a warning', () => {
    const r = importDtcg({
      ...fullFile(),
      shadow: { big: { $value: '0 0 4px' } },
    });
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.warnings).toContain('shadow.big: not part of theme.v1, ignored');
  });

  it.each([
    ['not an object', 'nope'],
    ['an array', []],
  ])('rejects %s', (_n, doc) => {
    expect(importDtcg(doc).ok).toBe(false);
  });

  it('rejects broken aliases, cycles and wrong types', () => {
    const bad = (primary: unknown, extra: object = {}) =>
      importDtcg({ color: { light: { primary, ...extra } } });
    expect(bad(token('{nope}')).ok).toBe(false);
    expect(
      bad(token('{color.light.accent}'), {
        accent: token('{color.light.primary}'),
      }).ok,
    ).toBe(false);
    expect(bad({ $type: 'dimension', $value: '4px' }).ok).toBe(false);
    expect(bad(token('red')).ok).toBe(false);
  });

  it('rejects preset names outside the contract (validation still runs)', () => {
    const r = importDtcg({
      ...fullFile(),
      shape: { radius: { $value: '13px' } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors.some((e) => e.path === '/shape/radius')).toBe(true);
  });

  it('never puts tenant strings outside the validated shape', () => {
    const r = importDtcg({
      ...fullFile(),
      brand: { name: { $value: 'x\u0000y' } },
    });
    expect(r.ok).toBe(false);
  });
});

describe('toHexColor', () => {
  it('handles hex forms', () => {
    expect(toHexColor('#ABC')).toEqual({ hex: '#aabbcc', droppedAlpha: false });
    expect(toHexColor('#112233ff')).toEqual({
      hex: '#112233',
      droppedAlpha: false,
    });
    expect(toHexColor('#11223380')).toEqual({
      hex: '#112233',
      droppedAlpha: true,
    });
  });
  it('handles DTCG 2025.10 colour objects', () => {
    expect(toHexColor({ colorSpace: 'srgb', components: [1, 0, 0.5] })).toEqual(
      { hex: '#ff0080', droppedAlpha: false },
    );
    expect(
      toHexColor({
        colorSpace: 'display-p3',
        components: [1, 0, 0],
        hex: '#ff0000',
        alpha: 0.5,
      }),
    ).toEqual({
      hex: '#ff0000',
      droppedAlpha: true,
    });
    expect(
      'error' in
        toHexColor({ colorSpace: 'oklch', components: [0.5, 0.1, 20] }),
    ).toBe(true);
    expect('error' in toHexColor(42)).toBe(true);
  });
});

describe('DTCG importer with a base theme (editor use)', () => {
  const base = fixture('valid', 'acme-light') as Theme;

  it('changes only what the file sets and keeps the rest of the base', () => {
    const r = importDtcg(
      { color: { light: { primary: token('#123456') } } },
      { base },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.colorsImported).toBe(1);
    expect(r.theme.color.light.primary).toBe('#123456');
    expect(r.theme).toEqual({
      ...base,
      color: {
        ...base.color,
        light: { ...base.color.light, primary: '#123456' },
      },
    });
    expect(r.warnings).toContain(
      'color.dark.primary: not set, current value kept',
    );
  });

  it('keeps the base logo and revision, and takes presets from the file', () => {
    const withLogo: Theme = {
      ...base,
      revision: 7,
      brand: { name: 'Acme', logoAssetId: 'logo12345' },
    };
    const r = importDtcg(
      { density: { $value: 'compact' }, brand: { name: { $value: 'New' } } },
      { base: withLogo },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.theme.revision).toBe(7);
    expect(r.theme.density).toBe('compact');
    expect(r.theme.brand).toEqual({ name: 'New', logoAssetId: 'logo12345' });
  });
});

describe('DTCG importer notes', () => {
  it('does not report tokens used through an alias as ignored', () => {
    const r = importDtcg({
      palette: { brand: { $type: 'color', $value: '#123456' } },
      unused: { x: { $type: 'color', $value: '#000000' } },
      color: {
        light: { primary: { $type: 'color', $value: '{palette.brand}' } },
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.some((w) => w.startsWith('palette.brand'))).toBe(false);
    expect(r.warnings).toContain('unused.x: not part of theme.v1, ignored');
  });
});

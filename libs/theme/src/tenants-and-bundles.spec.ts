import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { libRoot } from './test-helpers';

const repoRoot = path.resolve(libRoot, '..', '..');
const tenants = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'validation', 'tenants.json'), 'utf8'),
) as {
  tenants: {
    tenantId: string;
    name: string;
    widgetKey: string;
    theme: string;
  }[];
};

// SPECS/validation/tenant-fixtures.md, the human-readable source of the table.
const TABLE: Record<string, Record<string, string>> = {
  t_acme: {
    name: 'Acme Corp',
    mode: 'light',
    font: 'inter',
    scale: 'md',
    radius: 'md',
    elevation: 'low',
    density: 'comfortable',
    position: 'bottom-right',
    shape: 'circle',
    icon: 'chat',
    primary: '#1d4ed8/#93c5fd',
    accent: '#7c3aed/#c4b5fd',
    surface: '#ffffff/#0b1220',
  },
  t_globex: {
    name: 'Globex',
    mode: 'dark',
    font: 'roboto',
    scale: 'md',
    radius: 'sm',
    elevation: 'medium',
    density: 'spacious',
    position: 'bottom-left',
    shape: 'pill',
    icon: 'message',
    primary: '#0f766e/#5eead4',
    accent: '#f59e0b/#fbbf24',
    surface: '#f8fafc/#111827',
  },
  t_initech: {
    name: 'Initech',
    mode: 'light',
    font: 'source-sans',
    scale: 'sm',
    radius: 'full',
    elevation: 'flat',
    density: 'compact',
    position: 'bottom-right',
    shape: 'pill',
    icon: 'help',
    primary: '#b45309/#fcd34d',
    accent: '#0891b2/#67e8f9',
    surface: '#fffbeb/#1c1917',
  },
};

describe('P1.3-AC09 validation/tenants.json matches the tenant table and the theme fixtures', () => {
  it('lists exactly the three local tenants', () => {
    expect(tenants.tenants.map((t) => t.tenantId)).toEqual([
      't_acme',
      't_globex',
      't_initech',
    ]);
  });

  for (const t of tenants.tenants) {
    it(`${t.tenantId}: theme fixture fields match the table`, () => {
      const theme = JSON.parse(
        fs.readFileSync(path.join(repoRoot, t.theme), 'utf8'),
      );
      const row = TABLE[t.tenantId];
      expect(t.name).toBe(row.name);
      expect(theme.brand.name).toBe(row.name);
      expect(theme.appearance.mode).toBe(row.mode);
      expect(theme.typography).toEqual({
        fontFamily: row.font,
        scale: row.scale,
      });
      expect(theme.shape.radius).toBe(row.radius);
      expect(theme.elevation).toBe(row.elevation);
      expect(theme.density).toBe(row.density);
      expect(theme.launcher).toEqual({
        position: row.position,
        shape: row.shape,
        icon: row.icon,
      });
      expect(`${theme.color.light.primary}/${theme.color.dark.primary}`).toBe(
        row.primary,
      );
      expect(`${theme.color.light.accent}/${theme.color.dark.accent}`).toBe(
        row.accent,
      );
      expect(`${theme.color.light.surface}/${theme.color.dark.surface}`).toBe(
        row.surface,
      );
    });
  }
});

async function bundle(entry: string) {
  const result = await build({
    root: libRoot,
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: true,
      lib: {
        entry: path.join(libRoot, 'src', entry),
        formats: ['es'],
        fileName: () => 'out.js',
      },
    },
  });
  const output = (Array.isArray(result) ? result[0] : result) as {
    output: { type: string; code?: string }[];
  };
  const code = output.output
    .filter((o) => o.type === 'chunk')
    .map((o) => o.code ?? '')
    .join('\n');
  return { code, gzip: gzipSync(code, { level: 9 }).length };
}

describe('frame-safe entries (P1.3-AC08)', () => {
  it('@byteflock/theme/guard contains no schema library and is at most 4 KB gzip', async () => {
    const { code, gzip } = await bundle('guard-entry.ts');
    expect(code).not.toMatch(/typebox|TypeBox|ajv/i);
    expect(gzip).toBeLessThanOrEqual(4096);
    console.log(`guard entry: ${gzip} B gzip`);
  }, 60_000);

  it('@byteflock/theme/resolve contains no schema library', async () => {
    const { code, gzip } = await bundle('resolve-entry.ts');
    expect(code).not.toMatch(/typebox|TypeBox|ajv/i);
    console.log(`resolve entry: ${gzip} B gzip`);
  }, 60_000);
});

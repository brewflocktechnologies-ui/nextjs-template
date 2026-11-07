import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ThemeError,
  getDraft,
  getPublishedTheme,
  listRevisions,
  publish,
  rollback,
  saveDraft,
} from '../src/data/themes';
import {
  WidgetConfigError,
  getWidgetSettings,
  saveAllowedOrigins,
} from '../src/data/widget-config';

const root = path.resolve(__dirname, '../../..');
const fixtures = path.join(root, 'validation', 'widget-fixtures', 'v1');
const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const acme = readJson(
  path.join(root, 'libs/theme/fixtures/valid/acme-light.json'),
);

let publishDir: string;
const configFile = () => path.join(publishDir, 'config', 'wk_acme_demo.json');
const themeFile = (rev: number) =>
  path.join(publishDir, 'themes', 't_acme', `${rev}.json`);

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'byteflock-p16-'));
  publishDir = path.join(tmp, 'v1');
  fs.cpSync(fixtures, publishDir, { recursive: true });
  process.env.THEME_PUBLISH_DIR = publishDir;
  process.env.THEME_DRAFT_DIR = path.join(tmp, 'drafts');
});

describe('theme data access (P1.6-T08, AC05)', () => {
  it('reads the published theme through the widget config pointer', async () => {
    const published = await getPublishedTheme('t_acme');
    expect(published?.revision).toBe(1);
    expect((published?.doc as { brand: { name: string } }).brand.name).toBe(
      'Acme Corp',
    );
    expect(await getPublishedTheme('t_nobody')).toBeNull();
  });

  it('drafts are validated; an invalid draft is refused', async () => {
    await expect(saveDraft('t_acme', { ...acme, color: {} })).rejects.toThrow(
      ThemeError,
    );
    await saveDraft('t_acme', { ...acme, brand: { name: 'Acme Draft' } });
    expect((await getDraft('t_acme'))?.brand.name).toBe('Acme Draft');
  });

  it('publish writes the theme document before moving the pointer, at revision max + 1', async () => {
    await saveDraft('t_acme', { ...acme, brand: { name: 'Acme v2' } });
    const writes: string[] = [];
    const realLink = fs.linkSync.bind(fs);
    const realRename = fs.renameSync.bind(fs);
    const link = jest.spyOn(fs, 'linkSync');
    const rename = jest.spyOn(fs, 'renameSync');
    link.mockImplementation((src, dest) => {
      writes.push(`theme:${path.basename(String(dest))}`);
      return realLink(src, dest);
    });
    rename.mockImplementation((src, dest) => {
      writes.push(`write:${path.basename(String(dest))}`);
      return realRename(src, dest);
    });
    try {
      expect(await publish('t_acme')).toEqual({ revision: 2 });
    } finally {
      link.mockRestore();
      rename.mockRestore();
    }
    expect(writes).toEqual(['theme:2.json', 'write:wk_acme_demo.json']);
    expect(readJson(themeFile(2)).revision).toBe(2);
    expect(readJson(themeFile(2)).brand.name).toBe('Acme v2');
    expect(readJson(configFile()).themeRevision).toBe(2);
    // Untouched fields of the config survive.
    expect(readJson(configFile()).allowedOrigins).toEqual([
      'http://localhost:4300',
    ]);
  });

  it('refuses to overwrite an existing theme document', async () => {
    await saveDraft('t_acme', acme);
    fs.writeFileSync(themeFile(2), '{}');
    // Revision 2 exists, so the next publish is 3, never a rewrite of 2.
    expect(await publish('t_acme')).toEqual({ revision: 3 });
    expect(fs.readFileSync(themeFile(2), 'utf8')).toBe('{}');
  });

  it('rollback moves only the pointer; revisions stay monotonic', async () => {
    await saveDraft('t_acme', acme);
    await publish('t_acme'); // 2
    const before = fs.readFileSync(themeFile(2), 'utf8');
    await rollback('t_acme', 1);
    expect(readJson(configFile()).themeRevision).toBe(1);
    expect(fs.readFileSync(themeFile(2), 'utf8')).toBe(before);
    expect(await publish('t_acme')).toEqual({ revision: 3 });
    expect(await listRevisions('t_acme')).toEqual({
      revisions: [3, 2, 1],
      current: 3,
    });
    await expect(rollback('t_acme', 99)).rejects.toThrow(/does not exist/);
  });

  it('P1.6-AC06 publish refuses contrast violations (server re-check)', async () => {
    const bad = {
      ...acme,
      color: {
        ...acme.color,
        light: { ...acme.color.light, onPrimary: acme.color.light.primary },
      },
    };
    await saveDraft('t_acme', bad);
    await expect(publish('t_acme')).rejects.toMatchObject({ code: 'POLICY' });
    expect(readJson(configFile()).themeRevision).toBe(1);
    expect(fs.existsSync(themeFile(2))).toBe(false);
  });
});

describe('widget settings (P1.6-T12, D-21)', () => {
  it('saves valid allowed origins into the config and refuses invalid ones', async () => {
    expect((await getWidgetSettings('t_acme'))?.allowedOrigins).toEqual([
      'http://localhost:4300',
    ]);
    await saveAllowedOrigins('t_acme', [
      'https://www.example.com',
      'http://localhost:4300',
    ]);
    expect(readJson(configFile()).allowedOrigins).toEqual([
      'https://www.example.com',
      'http://localhost:4300',
    ]);
    expect(readJson(configFile()).themeRevision).toBe(1);
    for (const bad of [
      [],
      ['https://example.com/path'],
      ['https://*.example.com'],
      ['x', 'x'],
    ])
      await expect(saveAllowedOrigins('t_acme', bad)).rejects.toThrow(
        WidgetConfigError,
      );
  });
});

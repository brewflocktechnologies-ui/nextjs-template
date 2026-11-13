/**
 * @jest-environment node
 */
// Theme and widget data access on Postgres (P1.6-AC05 and P1.6-T12, now P2.1-T07). Needs `pnpm
// db:up`. This suite owns its own database (`byteflock_test_data`, created on demand), recreated
// before every test, because published revisions are immutable and other suites use byteflock_test
// in parallel.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from 'pg';

jest.mock('server-only', () => ({}));

// Setup recreates, migrates or seeds a database: allow for a loaded machine (repo-wide runs).
jest.setTimeout(60_000);

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
import { closePool } from '../src/server/db';
import { materialiseTenant } from '../src/server/store/materialise';

const root = path.resolve(__dirname, '../../..');
const DATABASE = 'byteflock_test_data';
const fixtures = path.join(root, 'validation', 'widget-fixtures', 'v1');
const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const acme = readJson(
  path.join(root, 'libs/theme/fixtures/valid/acme-light.json'),
);
const USER = 'u_acme_admin';

let publishDir: string;
const configFile = () => path.join(publishDir, 'config', 'wk_acme_demo.json');
const themeFile = (rev: number) =>
  path.join(publishDir, 'themes', 't_acme', `${rev}.json`);

beforeEach(async () => {
  await closePool();
  try {
    execFileSync(
      process.execPath,
      [
        path.join(root, 'tools/scripts/db/recreate.mjs'),
        `--database=${DATABASE}`,
      ],
      { cwd: root, stdio: 'pipe' },
    );
  } catch (error) {
    throw new Error(
      `recreate failed: is Postgres running (pnpm db:up)?\n${String((error as { stderr?: Buffer }).stderr ?? error)}`,
    );
  }
  process.env.DATABASE_URL = `postgres://byteflock_app:byteflock_app@127.0.0.1:5440/${DATABASE}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'byteflock-p21-'));
  publishDir = path.join(tmp, 'v1');
  fs.cpSync(fixtures, publishDir, { recursive: true });
  process.env.THEME_PUBLISH_DIR = publishDir;
});

afterEach(() => jest.restoreAllMocks());
afterAll(closePool);

describe('theme data access (P1.6-AC05 on Postgres)', () => {
  it('reads the published theme through the published pointer', async () => {
    const published = await getPublishedTheme('t_acme');
    expect(published?.revision).toBe(1);
    expect((published?.doc as { brand: { name: string } }).brand.name).toBe(
      'Acme Corp',
    );
    expect(await getPublishedTheme('t_nobody')).toBeNull();
  });

  it('drafts are validated; an invalid draft is refused; an unknown tenant is refused', async () => {
    await expect(
      saveDraft('t_acme', { ...acme, color: {} }, USER),
    ).rejects.toThrow(ThemeError);
    await saveDraft('t_acme', { ...acme, brand: { name: 'Acme Draft' } }, USER);
    expect((await getDraft('t_acme'))?.brand.name).toBe('Acme Draft');
    await expect(saveDraft('t_nobody', acme, USER)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('publish writes the theme document before moving the pointer, at revision max + 1', async () => {
    await saveDraft('t_acme', { ...acme, brand: { name: 'Acme v2' } }, USER);
    const writes: string[] = [];
    const realLink = fs.linkSync.bind(fs);
    const realRename = fs.renameSync.bind(fs);
    jest.spyOn(fs, 'linkSync').mockImplementation((src, dest) => {
      writes.push(`theme:${path.basename(String(dest))}`);
      return realLink(src, dest);
    });
    jest.spyOn(fs, 'renameSync').mockImplementation((src, dest) => {
      writes.push(`write:${path.basename(String(dest))}`);
      return realRename(src, dest);
    });
    expect(await publish('t_acme', USER)).toEqual({
      revision: 2,
      materialised: true,
    });
    jest.restoreAllMocks();
    expect(writes).toEqual(['theme:2.json', 'write:wk_acme_demo.json']);
    expect(readJson(themeFile(2)).revision).toBe(2);
    expect(readJson(themeFile(2)).brand.name).toBe('Acme v2');
    expect(readJson(configFile()).themeRevision).toBe(2);
    // The rest of the config comes from the database.
    expect(readJson(configFile()).allowedOrigins).toEqual([
      'http://localhost:4300',
    ]);
    expect(await listRevisions('t_acme')).toEqual({
      revisions: [2, 1],
      current: 2,
    });
  });

  it('never overwrites an existing theme document file', async () => {
    await saveDraft('t_acme', acme, USER);
    fs.mkdirSync(path.dirname(themeFile(2)), { recursive: true });
    fs.writeFileSync(themeFile(2), '{}');
    expect(await publish('t_acme', USER)).toMatchObject({ revision: 2 });
    expect(fs.readFileSync(themeFile(2), 'utf8')).toBe('{}');
  });

  it('P2.1-AC03: concurrent publishes get distinct, gap-free revisions', async () => {
    await saveDraft('t_acme', acme, USER);
    const results = await Promise.all([
      publish('t_acme', USER),
      publish('t_acme', USER),
      publish('t_acme', USER),
    ]);
    expect(results.map((r) => r.revision).sort()).toEqual([2, 3, 4]);
    expect((await listRevisions('t_acme')).revisions).toEqual([4, 3, 2, 1]);
  });

  it('rollback moves only the pointer; revisions stay monotonic', async () => {
    await saveDraft('t_acme', acme, USER);
    await publish('t_acme', USER); // 2
    const before = fs.readFileSync(themeFile(2), 'utf8');
    await rollback('t_acme', 1);
    expect(readJson(configFile()).themeRevision).toBe(1);
    expect(fs.readFileSync(themeFile(2), 'utf8')).toBe(before);
    expect((await getPublishedTheme('t_acme'))?.revision).toBe(1);
    expect(await publish('t_acme', USER)).toMatchObject({ revision: 3 });
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
    await saveDraft('t_acme', bad, USER);
    await expect(publish('t_acme', USER)).rejects.toMatchObject({
      code: 'POLICY',
    });
    expect(readJson(configFile()).themeRevision).toBe(1);
    expect(fs.existsSync(themeFile(2))).toBe(false);
    expect((await listRevisions('t_acme')).revisions).toEqual([1]);
  });

  it('publish without a draft, or for a tenant without a widget, is refused', async () => {
    // The seed gives every tenant a draft; remove Acme's (as the owner) to test the refusal.
    const owner = new Client({
      connectionString: `postgres://byteflock:byteflock@127.0.0.1:5440/${DATABASE}`,
    });
    await owner.connect();
    await owner.query("DELETE FROM theme_drafts WHERE tenant_id = 't_acme'");
    await owner.end();
    await expect(publish('t_acme', USER)).rejects.toMatchObject({
      code: 'NO_DRAFT',
    });
    await expect(publish('t_broken', 'u_broken_admin')).rejects.toMatchObject({
      code: 'NO_WIDGET',
    });
  });

  it('a file failure after commit leaves the revision published; materialise repairs the files', async () => {
    await saveDraft('t_acme', { ...acme, brand: { name: 'Acme v2' } }, USER);
    const realLink = fs.linkSync.bind(fs);
    const spy = jest.spyOn(fs, 'linkSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await publish('t_acme', USER)).toEqual({
      revision: 2,
      materialised: false,
    });
    expect(await listRevisions('t_acme')).toEqual({
      revisions: [2, 1],
      current: 2,
    });
    expect(fs.existsSync(themeFile(2))).toBe(false);
    expect(readJson(configFile()).themeRevision).toBe(1); // stale file
    spy.mockImplementation((src, dest) => realLink(src, dest));
    await materialiseTenant('t_acme');
    expect(readJson(themeFile(2)).brand.name).toBe('Acme v2');
    expect(readJson(configFile()).themeRevision).toBe(2);
  });
});

describe('widget settings (P1.6-T12, D-21, on Postgres)', () => {
  it('saves valid allowed origins into the database and the config, and refuses invalid ones', async () => {
    expect((await getWidgetSettings('t_acme'))?.allowedOrigins).toEqual([
      'http://localhost:4300',
    ]);
    await saveAllowedOrigins('t_acme', [
      'https://www.example.com',
      'http://localhost:4300',
    ]);
    expect((await getWidgetSettings('t_acme'))?.allowedOrigins).toEqual([
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

  it('a tenant without a widget has no settings and cannot save origins', async () => {
    expect(await getWidgetSettings('t_broken')).toBeNull();
    await expect(
      saveAllowedOrigins('t_broken', ['https://www.example.com']),
    ).rejects.toThrow(/No widget/);
  });

  it('tenant data is isolated: one tenant never reads another tenant’s settings', async () => {
    await saveAllowedOrigins('t_acme', ['https://acme.example']);
    expect((await getWidgetSettings('t_globex'))?.allowedOrigins).toEqual([
      'http://localhost:4300',
    ]);
  });
});

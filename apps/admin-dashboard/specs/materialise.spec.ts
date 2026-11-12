/**
 * @jest-environment node
 */
// Materialisation (P2.1-T08, section 4.5): `pnpm db:materialise` rebuilds the widget's static files
// from Postgres, byte for byte equal to validation/widget-fixtures, the same bytes the dashboard's
// own materialiser writes after a publish, and it repairs a publish whose file write failed. Needs
// `pnpm db:up`; uses its own database (`byteflock_test_mat`, created on demand).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

jest.mock('server-only', () => ({}));

// Setup recreates, migrates or seeds a database: allow for a loaded machine (repo-wide runs).
jest.setTimeout(60_000);

import { publish, saveDraft } from '../src/data/themes';
import { closePool } from '../src/server/db';

const root = path.resolve(__dirname, '../../..');
const DATABASE = 'byteflock_test_mat';
const fixtures = path.join(root, 'validation', 'widget-fixtures', 'v1');
const acme = JSON.parse(
  fs.readFileSync(
    path.join(root, 'libs/theme/fixtures/valid/acme-light.json'),
    'utf8',
  ),
);
const USER = 'u_acme_admin';

const TENANT_FILES = [
  'config/wk_acme_demo.json',
  'config/wk_globex_demo.json',
  'config/wk_initech_demo.json',
  'themes/t_acme/1.json',
  'themes/t_globex/1.json',
  'themes/t_initech/1.json',
];

const script = (name: string, ...args: string[]) =>
  execFileSync(
    process.execPath,
    [path.join(root, 'tools', 'scripts', 'db', name), ...args],
    { cwd: root, encoding: 'utf8', stdio: 'pipe' },
  );
const materialise = (out: string) =>
  script('materialise.mjs', `--database=${DATABASE}`, `--out=${out}`);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'byteflock-mat-'));
const list = (dir: string) =>
  fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) =>
      path.relative(dir, path.join(e.parentPath, e.name)).replace(/\\/g, '/'),
    )
    .sort();

beforeEach(async () => {
  await closePool();
  script('recreate.mjs', `--database=${DATABASE}`);
  process.env.DATABASE_URL = `postgres://byteflock_app:byteflock_app@127.0.0.1:5440/${DATABASE}`;
});
afterEach(() => jest.restoreAllMocks());
afterAll(closePool);

describe('db:materialise (P2.1-T08)', () => {
  it('P2.1-AC11: reproduces validation/widget-fixtures byte for byte for the seeded tenants', () => {
    const out = tmp();
    expect(materialise(out)).toContain('6 written');
    expect(list(out)).toEqual(TENANT_FILES);
    for (const rel of TENANT_FILES) {
      expect(fs.readFileSync(path.join(out, rel))).toEqual(
        fs.readFileSync(path.join(fixtures, rel)),
      );
    }
  });

  it('a second run changes nothing', () => {
    const out = tmp();
    materialise(out);
    expect(materialise(out)).toContain('0 written, 6 already correct');
  });

  it('writes the same bytes as the dashboard materialiser after a publish', async () => {
    const dashboardOut = path.join(tmp(), 'v1');
    process.env.THEME_PUBLISH_DIR = dashboardOut;
    await saveDraft('t_acme', { ...acme, brand: { name: 'Acme v2' } }, USER);
    expect(await publish('t_acme', USER)).toMatchObject({
      revision: 2,
      materialised: true,
    });
    const scriptOut = tmp();
    materialise(scriptOut);
    // The dashboard wrote the published revision's theme and the config; the script writes all.
    for (const rel of ['config/wk_acme_demo.json', 'themes/t_acme/2.json']) {
      expect(fs.readFileSync(path.join(dashboardOut, rel))).toEqual(
        fs.readFileSync(path.join(scriptOut, rel)),
      );
    }
    expect(list(scriptOut)).toContain('themes/t_acme/1.json');
  });

  it('materialise repair: a forced write failure after commit is repaired (P2.1-AC10)', async () => {
    const out = path.join(tmp(), 'v1');
    fs.cpSync(fixtures, out, { recursive: true });
    process.env.THEME_PUBLISH_DIR = out;
    await saveDraft('t_acme', { ...acme, brand: { name: 'Acme v2' } }, USER);
    jest.spyOn(fs, 'linkSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await publish('t_acme', USER)).toEqual({
      revision: 2,
      materialised: false,
    });
    jest.restoreAllMocks();
    // Committed but not on disk: the widget would still serve revision 1.
    expect(fs.existsSync(path.join(out, 'themes/t_acme/2.json'))).toBe(false);
    expect(
      JSON.parse(
        fs.readFileSync(path.join(out, 'config/wk_acme_demo.json'), 'utf8'),
      ).themeRevision,
    ).toBe(1);

    materialise(out);

    expect(
      JSON.parse(
        fs.readFileSync(path.join(out, 'themes/t_acme/2.json'), 'utf8'),
      ).brand.name,
    ).toBe('Acme v2');
    expect(
      JSON.parse(
        fs.readFileSync(path.join(out, 'config/wk_acme_demo.json'), 'utf8'),
      ).themeRevision,
    ).toBe(2);
    // The hand-written failure fixtures were not touched.
    expect(fs.existsSync(path.join(out, 'config/wk_broken_json.json'))).toBe(
      true,
    );
  });

  it('repairs a corrupted or deleted file', () => {
    const out = tmp();
    materialise(out);
    fs.writeFileSync(path.join(out, 'config/wk_globex_demo.json'), '{broken');
    fs.rmSync(path.join(out, 'themes/t_initech/1.json'));
    expect(materialise(out)).toContain('2 written, 4 already correct');
    for (const rel of TENANT_FILES) {
      expect(fs.readFileSync(path.join(out, rel))).toEqual(
        fs.readFileSync(path.join(fixtures, rel)),
      );
    }
  });
});

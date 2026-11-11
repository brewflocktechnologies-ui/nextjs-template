/**
 * @jest-environment node
 */
// Tenant config: the guard (pure) and its data access plus tenant listing (P2.1-T07). The data
// tests use their own database (`byteflock_test_cfg`, created on demand) because they write.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Client } from 'pg';

jest.mock('server-only', () => ({}));

import { getTenantConfig, saveTenantConfig } from '../src/data/tenant-config';
import { listTenants } from '../src/data/platform/tenants';
import {
  defaultTenantConfig,
  guardTenantConfig,
  NOTICE_MAX,
  TITLE_MAX,
} from '../src/lib/tenant-config';
import { ForbiddenError } from '../src/server/authorize';
import { closePool } from '../src/server/db';
import type {
  PlatformContext,
  RequestContext,
} from '../src/server/session/types';

const valid = defaultTenantConfig({ name: 'Acme Corp', locale: 'en-AU' });

describe('tenant config guard (P2.1-T07, CONFIG)', () => {
  it('accepts the defaults', () => {
    expect(guardTenantConfig(valid)).toEqual({ ok: true, value: valid });
    expect(valid.home.title).toBe('Acme Corp support');
  });

  it('rejects non-objects, a wrong version and unknown keys at every level', () => {
    for (const input of [null, 'x', [], 1])
      expect(guardTenantConfig(input).ok).toBe(false);
    expect(guardTenantConfig({ ...valid, schemaVersion: 2 }).ok).toBe(false);
    expect(guardTenantConfig({ ...valid, extra: 1 }).ok).toBe(false);
    expect(
      guardTenantConfig({ ...valid, modules: { ...valid.modules, x: true } })
        .ok,
    ).toBe(false);
    expect(
      guardTenantConfig({ ...valid, defaults: { locale: 'en', x: 1 } }).ok,
    ).toBe(false);
    expect(
      guardTenantConfig({ ...valid, home: { ...valid.home, html: '<b>' } }).ok,
    ).toBe(false);
  });

  it('checks types and limits', () => {
    const bad = (patch: object) => guardTenantConfig({ ...valid, ...patch }).ok;
    expect(bad({ modules: { themeEditor: 'yes', widgetSettings: true } })).toBe(
      false,
    );
    expect(bad({ modules: { themeEditor: true } })).toBe(false);
    expect(bad({ defaults: { locale: 'EN_au' } })).toBe(false);
    expect(
      bad({ home: { title: 'x'.repeat(TITLE_MAX + 1), notice: '' } }),
    ).toBe(false);
    expect(
      bad({ home: { title: 'ok', notice: 'x'.repeat(NOTICE_MAX + 1) } }),
    ).toBe(false);
    expect(
      bad({
        home: { title: 'x'.repeat(TITLE_MAX), notice: 'x'.repeat(NOTICE_MAX) },
      }),
    ).toBe(true);
    expect(bad({ home: { title: 5, notice: '' } })).toBe(false);
  });

  it('keeps markup as plain text: it is stored and later rendered as text, never parsed', () => {
    const result = guardTenantConfig({
      ...valid,
      home: {
        title: '<img src=x onerror=alert(1)>',
        notice: '<script>x</script>',
      },
    });
    expect(result.ok).toBe(true);
  });
});

const root = path.resolve(__dirname, '../../..');
const DATABASE = 'byteflock_test_cfg';
const url = (user: string) =>
  `postgres://${user}:${user}@127.0.0.1:5440/${DATABASE}`;
let owner: Client;

const platform: PlatformContext = {
  scope: 'platform',
  userId: 'u_platform_admin',
  roles: ['super_admin'],
  locale: 'en-AU',
};

beforeAll(async () => {
  execFileSync(
    process.execPath,
    [
      path.join(root, 'tools/scripts/db/recreate.mjs'),
      `--database=${DATABASE}`,
    ],
    { cwd: root, stdio: 'pipe' },
  );
  process.env.DATABASE_URL = url('byteflock_app');
  owner = new Client({ connectionString: url('byteflock') });
  await owner.connect();
});
afterAll(async () => {
  await owner.end();
  await closePool();
});
afterEach(() => jest.restoreAllMocks());

describe('tenant config data access (P2.1-T07)', () => {
  it('reads the seeded default config', async () => {
    expect(await getTenantConfig('t_acme')).toEqual(valid);
    expect((await getTenantConfig('t_globex')).defaults.locale).toBe('en-US');
  });

  it('saves a valid config and reads it back; the user is recorded', async () => {
    const next = {
      ...valid,
      modules: { themeEditor: false, widgetSettings: true },
      home: { title: 'Acme help', notice: 'Office closed Friday' },
    };
    expect(await saveTenantConfig('t_acme', next, 'u_acme_admin')).toEqual(
      next,
    );
    expect(await getTenantConfig('t_acme')).toEqual(next);
    const { rows } = await owner.query(
      "SELECT updated_by FROM tenant_configs WHERE tenant_id = 't_acme'",
    );
    expect(rows[0].updated_by).toBe('u_acme_admin');
  });

  it('refuses an invalid config and a locale the tenant does not support', async () => {
    await expect(
      saveTenantConfig('t_acme', { ...valid, extra: true }, 'u_acme_admin'),
    ).rejects.toMatchObject({ name: 'TenantConfigError' });
    await expect(
      saveTenantConfig(
        't_globex',
        { ...valid, defaults: { locale: 'en-AU' } },
        'u_globex_admin',
      ),
    ).rejects.toMatchObject({ problems: [expect.stringContaining('en-US')] });
    await expect(
      saveTenantConfig('t_nobody', valid, 'u_acme_admin'),
    ).rejects.toThrow(/Unknown tenant/);
  });

  it('a missing or invalid stored config falls back to the defaults and is logged', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    await owner.query(
      "DELETE FROM tenant_configs WHERE tenant_id = 't_initech'",
    );
    expect(await getTenantConfig('t_initech')).toEqual(
      defaultTenantConfig({ name: 'Initech', locale: 'en-AU' }),
    );
    expect(warn).not.toHaveBeenCalled();
    await owner.query(
      `INSERT INTO tenant_configs (tenant_id, doc, schema_version, updated_by)
       VALUES ('t_initech', '{"schemaVersion":7}', 1, 'u_initech_admin')`,
    );
    expect((await getTenantConfig('t_initech')).schemaVersion).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('t_initech'));
  });
});

describe('platform tenant listing (P2.1-T07)', () => {
  it('lists every tenant for platform scope', async () => {
    const tenants = await listTenants(platform);
    expect(tenants.map((t) => t.tenantId)).toEqual([
      't_acme',
      't_broken',
      't_globex',
      't_initech',
    ]);
    expect(tenants[0]).toEqual({
      tenantId: 't_acme',
      name: 'Acme Corp',
      widgetKey: 'wk_acme_demo',
      publishedRevision: 1,
    });
    expect(tenants[1]).toMatchObject({
      widgetKey: null,
      publishedRevision: null,
    });
  });

  it('refuses a tenant context, even one cast to the platform type', async () => {
    const tenant: RequestContext = {
      scope: 'tenant',
      tenantId: 't_acme',
      userId: 'u_acme_admin',
      roles: ['tenant_admin'],
      locale: 'en-AU',
    };
    await expect(listTenants(tenant as never)).rejects.toThrow(ForbiddenError);
  });
});

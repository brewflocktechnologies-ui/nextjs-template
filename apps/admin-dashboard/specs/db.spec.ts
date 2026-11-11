/**
 * @jest-environment node
 */
// Database layer against byteflock_test (P2.1-T05). Needs `pnpm db:up`. Setup migrates and seeds
// the test database through the same scripts the stack uses, then connects as byteflock_app.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

jest.mock('server-only', () => ({}));

function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('expected a row');
  return value;
}

const root = path.resolve(__dirname, '../../..');
const script = (name: string) =>
  path.join(root, 'tools', 'scripts', 'db', name);

beforeAll(() => {
  for (const name of ['migrate.mjs', 'seed.mjs']) {
    try {
      execFileSync(
        process.execPath,
        [script(name), '--database=byteflock_test'],
        {
          cwd: root,
          stdio: 'pipe',
        },
      );
    } catch (error) {
      throw new Error(
        `${name} failed against byteflock_test: is Postgres running (pnpm db:up)?\n${String((error as { stderr?: Buffer }).stderr ?? error)}`,
      );
    }
  }
  process.env.DATABASE_URL =
    'postgres://byteflock_app:byteflock_app@127.0.0.1:5440/byteflock_test';
});

afterAll(async () => {
  const { closePool } = await import('../src/server/db');
  await closePool();
});

describe('withScope (P2.1-T05)', () => {
  it('tenant scope sees only its own rows in every tenant table', async () => {
    const { withScope } = await import('../src/server/db');
    const tables = [
      'tenants',
      'tenant_memberships',
      'widget_keys',
      'theme_drafts',
      'theme_revisions',
      'tenant_configs',
    ];
    for (const table of tables) {
      const ids = await withScope(
        { scope: 'tenant', tenantId: 't_acme' },
        (db) =>
          db.rows<{ tenant_id: string }>(
            `SELECT DISTINCT tenant_id FROM ${table}`,
          ),
      );
      expect(ids.map((r) => r.tenant_id)).toEqual(['t_acme']);
    }
  });

  it('platform scope sees every tenant', async () => {
    const { withScope } = await import('../src/server/db');
    const rows = await withScope({ scope: 'platform' }, (db) =>
      db.rows<{ tenant_id: string }>(
        'SELECT tenant_id FROM tenants ORDER BY 1',
      ),
    );
    expect(rows.map((r) => r.tenant_id)).toEqual([
      't_acme',
      't_broken',
      't_globex',
      't_initech',
    ]);
  });

  it('settings end with the transaction: a bare pooled query sees nothing', async () => {
    const { withScope, getPool } = await import('../src/server/db');
    await withScope({ scope: 'platform' }, (db) => db.rows('SELECT 1'));
    const { rows } = await getPool().query(
      'SELECT count(*)::int AS n FROM tenants',
    );
    expect(rows[0].n).toBe(0);
  });

  it('a tenant cannot write another tenant’s rows', async () => {
    const { withScope } = await import('../src/server/db');
    await expect(
      withScope({ scope: 'tenant', tenantId: 't_acme' }, (db) =>
        db.rows(
          `INSERT INTO theme_drafts (tenant_id, doc, updated_by) VALUES ('t_globex', '{}', 'u_acme_admin')`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('rolls back when the callback throws', async () => {
    const { withScope } = await import('../src/server/db');
    await expect(
      withScope({ scope: 'tenant', tenantId: 't_acme' }, async (db) => {
        await db.rows(
          `UPDATE tenant_configs SET doc = '{"changed":true}' WHERE tenant_id = 't_acme'`,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const row = await withScope({ scope: 'tenant', tenantId: 't_acme' }, (db) =>
      db.maybeOne<{ doc: Record<string, unknown> }>(
        `SELECT doc FROM tenant_configs WHERE tenant_id = 't_acme'`,
      ),
    );
    expect(row?.doc).not.toHaveProperty('changed');
  });

  it('commits when the callback returns', async () => {
    const { withScope } = await import('../src/server/db');
    const ctx = { scope: 'tenant', tenantId: 't_acme' } as const;
    await withScope(ctx, (db) =>
      db.rows(
        `UPDATE theme_drafts SET updated_by = 'u_acme_agent' WHERE tenant_id = 't_acme'`,
      ),
    );
    const row = await withScope(ctx, (db) =>
      db.maybeOne<{ updated_by: string }>(
        `SELECT updated_by FROM theme_drafts WHERE tenant_id = 't_acme'`,
      ),
    );
    expect(row?.updated_by).toBe('u_acme_agent');
    await withScope(ctx, (db) =>
      db.rows(
        `UPDATE theme_drafts SET updated_by = 'u_acme_admin' WHERE tenant_id = 't_acme'`,
      ),
    );
  });

  it('rejects an invalid tenant id before touching the database', async () => {
    const { withScope } = await import('../src/server/db');
    await expect(
      withScope(
        { scope: 'tenant', tenantId: "t_x'; drop table tenants;--" },
        async () => 1,
      ),
    ).rejects.toThrow('invalid tenant id');
    await expect(
      withScope({ scope: 'nope' } as never, async () => 1),
    ).rejects.toThrow('unknown scope');
  });

  it('maybeOne returns null for no rows and throws for several', async () => {
    const { withScope } = await import('../src/server/db');
    await withScope({ scope: 'platform' }, async (db) => {
      expect(
        await db.maybeOne(`SELECT 1 FROM tenants WHERE tenant_id = 't_none'`),
      ).toBeNull();
      await expect(
        db.maybeOne('SELECT tenant_id FROM tenants'),
      ).rejects.toThrow('at most one row');
    });
  });
});

describe('row mappers (P2.1-T05)', () => {
  it('map real rows to camelCase objects with ISO timestamps', async () => {
    const db = await import('../src/server/db');
    const platform = { scope: 'platform' } as const;
    const user = await db.withScope(platform, async (q) =>
      db.mapUser(
        must(
          await q.maybeOne<db.UserRow>(
            `SELECT * FROM users WHERE user_id = 'u_platform_admin'`,
          ),
        ),
      ),
    );
    expect(user).toMatchObject({
      userId: 'u_platform_admin',
      platformRole: 'super_admin',
    });
    expect(new Date(user.createdAt).toISOString()).toBe(user.createdAt);

    const tenant = await db.withScope(platform, async (q) =>
      db.mapTenant(
        must(
          await q.maybeOne<db.TenantRow>(
            `SELECT * FROM tenants WHERE tenant_id = 't_acme'`,
          ),
        ),
      ),
    );
    expect(tenant).toMatchObject({
      tenantId: 't_acme',
      name: 'Acme Corp',
      publishedRevision: 1,
    });

    const key = await db.withScope(platform, async (q) =>
      db.mapWidgetKey(
        must(
          await q.maybeOne<db.WidgetKeyRow>(
            `SELECT * FROM widget_keys WHERE tenant_id = 't_acme'`,
          ),
        ),
      ),
    );
    expect(key).toMatchObject({
      widgetKey: 'wk_acme_demo',
      localeDefault: 'en-AU',
    });
    expect(key.localesSupported).toEqual(['en-AU', 'en-US']);

    const revision = await db.withScope(platform, async (q) =>
      db.mapThemeRevision(
        must(
          await q.maybeOne<db.ThemeRevisionRow>(
            `SELECT * FROM theme_revisions WHERE tenant_id = 't_acme'`,
          ),
        ),
      ),
    );
    expect(revision).toMatchObject({
      tenantId: 't_acme',
      revision: 1,
      schemaVersion: 1,
    });

    const membership = await db.withScope(platform, async (q) =>
      db.mapMembership(
        must(
          await q.maybeOne<db.MembershipRow>(
            `SELECT * FROM tenant_memberships WHERE user_id = 'u_acme_agent'`,
          ),
        ),
      ),
    );
    expect(membership).toEqual({
      userId: 'u_acme_agent',
      tenantId: 't_acme',
      role: 'agent',
    });

    const draft = await db.withScope(platform, async (q) =>
      db.mapThemeDraft(
        must(
          await q.maybeOne<db.ThemeDraftRow>(
            `SELECT * FROM theme_drafts WHERE tenant_id = 't_acme'`,
          ),
        ),
      ),
    );
    expect(draft.tenantId).toBe('t_acme');
    const config = await db.withScope(platform, async (q) =>
      db.mapTenantConfig(
        must(
          await q.maybeOne<db.TenantConfigRow>(
            `SELECT * FROM tenant_configs WHERE tenant_id = 't_acme'`,
          ),
        ),
      ),
    );
    expect(config).toMatchObject({ tenantId: 't_acme', schemaVersion: 1 });
  });
});

describe('getPool (P2.1-T05)', () => {
  it('fails clearly without DATABASE_URL', async () => {
    const { closePool, getPool } = await import('../src/server/db');
    const saved = process.env.DATABASE_URL;
    await closePool();
    delete process.env.DATABASE_URL;
    expect(() => getPool()).toThrow(/DATABASE_URL is not set/);
    process.env.DATABASE_URL = saved;
  });

  it('returns one pool per process', async () => {
    const { getPool } = await import('../src/server/db');
    expect(getPool()).toBe(getPool());
  });
});

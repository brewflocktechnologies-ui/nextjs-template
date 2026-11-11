/**
 * @jest-environment node
 */
// loadContext against byteflock_test (P2.1-T06): the context comes from the database on every call,
// so role changes, removed memberships and deleted users take effect at once (AC09 groundwork).
// Needs `pnpm db:up`; setup migrates and seeds byteflock_test with the stack's own scripts.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Client } from 'pg';

jest.mock('server-only', () => ({}));

const root = path.resolve(__dirname, '../../..');
const url = (user: string) =>
  `postgres://${user}:${user}@127.0.0.1:5440/byteflock_test`;

let owner: Client;

beforeAll(async () => {
  for (const name of ['migrate.mjs', 'seed.mjs']) {
    try {
      execFileSync(
        process.execPath,
        [
          path.join(root, 'tools', 'scripts', 'db', name),
          '--database=byteflock_test',
        ],
        { cwd: root, stdio: 'pipe' },
      );
    } catch (error) {
      throw new Error(
        `${name} failed against byteflock_test: is Postgres running (pnpm db:up)?\n${String((error as { stderr?: Buffer }).stderr ?? error)}`,
      );
    }
  }
  process.env.DATABASE_URL = url('byteflock_app');
  owner = new Client({ connectionString: url('byteflock') });
  await owner.connect();
});

afterAll(async () => {
  await owner.end();
  const { closePool } = await import('../src/server/db');
  await closePool();
});

const load = async (claims: { userId: string; tenantId: string | null }) => {
  const { loadContext } = await import('../src/server/session/load-context');
  return loadContext(claims);
};

describe('loadContext (P2.1-T06)', () => {
  it('builds a tenant context from the database, not the cookie', async () => {
    expect(await load({ userId: 'u_acme_admin', tenantId: 't_acme' })).toEqual({
      scope: 'tenant',
      tenantId: 't_acme',
      userId: 'u_acme_admin',
      roles: ['tenant_admin'],
      locale: 'en-AU',
    });
    expect(
      await load({ userId: 'u_acme_agent', tenantId: 't_acme' }),
    ).toMatchObject({ scope: 'tenant', roles: ['agent'] });
  });

  it('a super admin always gets platform scope, whatever tenant the cookie names', async () => {
    const expected = {
      scope: 'platform',
      userId: 'u_platform_admin',
      roles: ['super_admin'],
      locale: 'en-AU',
    };
    expect(await load({ userId: 'u_platform_admin', tenantId: null })).toEqual(
      expected,
    );
    expect(
      await load({ userId: 'u_platform_admin', tenantId: 't_globex' }),
    ).toEqual(expected);
  });

  it('a tenant user without a claimed tenant, or in the wrong tenant, has no context', async () => {
    expect(await load({ userId: 'u_acme_admin', tenantId: null })).toBeNull();
    expect(
      await load({ userId: 'u_acme_admin', tenantId: 't_globex' }),
    ).toBeNull();
  });

  it('an unknown user has no context', async () => {
    expect(await load({ userId: 'u_nobody', tenantId: 't_acme' })).toBeNull();
  });

  it('the failure-fixture tenant admin can sign in', async () => {
    expect(
      await load({ userId: 'u_broken_admin', tenantId: 't_broken' }),
    ).toMatchObject({ scope: 'tenant', tenantId: 't_broken' });
  });

  it('a role change takes effect on the next call; a removed membership and a deleted user end the session', async () => {
    // A throwaway user, so this test never mutates seeded rows other suites read in parallel.
    const claims = { userId: 'u_ctx_probe', tenantId: 't_acme' };
    await owner.query("DELETE FROM users WHERE user_id = 'u_ctx_probe'");
    try {
      await owner.query(
        "INSERT INTO users (user_id, display_name, locale) VALUES ('u_ctx_probe', 'Probe', 'en-AU')",
      );
      expect(await load(claims)).toBeNull();
      await owner.query(
        "INSERT INTO tenant_memberships (user_id, tenant_id, role) VALUES ('u_ctx_probe', 't_acme', 'agent')",
      );
      expect(await load(claims)).toMatchObject({ roles: ['agent'] });
      await owner.query(
        "UPDATE tenant_memberships SET role = 'tenant_admin' WHERE user_id = 'u_ctx_probe'",
      );
      expect(await load(claims)).toMatchObject({ roles: ['tenant_admin'] });
      await owner.query(
        "DELETE FROM tenant_memberships WHERE user_id = 'u_ctx_probe'",
      );
      expect(await load(claims)).toBeNull();
      await owner.query(
        "INSERT INTO tenant_memberships (user_id, tenant_id, role) VALUES ('u_ctx_probe', 't_acme', 'agent')",
      );
      await owner.query("DELETE FROM users WHERE user_id = 'u_ctx_probe'");
      expect(await load(claims)).toBeNull();
    } finally {
      await owner.query("DELETE FROM users WHERE user_id = 'u_ctx_probe'");
    }
  });
});

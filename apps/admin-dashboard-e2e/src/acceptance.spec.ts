// P2.1 acceptance criteria not covered elsewhere (P2.1-T15): the authorization matrix at the
// route-handler level (AC04), role changes without a new cookie (AC09), the migration runner
// (AC01) and the production refusals of the database scripts (AC15). The other [auto] criteria are
// covered by chrome-scope, platform, tenant-config, dev-session and the dashboard unit specs; the
// evidence file maps each one.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test';
import {
  DASHBOARD,
  ROOT,
  e2eDatabase,
  ownerQuery,
  resetLocalState,
} from './helpers';

test.describe.configure({ mode: 'serial' });
test.afterAll(resetLocalState);

/** A request context signed in through the switcher's `as` field (P2.1-T12). */
async function contextAs(as: string): Promise<APIRequestContext> {
  const ctx = await playwrightRequest.newContext();
  const res = await ctx.post(`${DASHBOARD}/dev/session/select`, {
    form: { as },
    maxRedirects: 0,
  });
  expect(res.status(), as).toBe(303);
  return ctx;
}

type Role = 'tenant_admin' | 'agent' | 'super_admin';
const USERS: Record<Role, string> = {
  tenant_admin: 'u_acme_admin@t_acme',
  agent: 'u_acme_agent@t_acme',
  super_admin: 'u_platform_admin',
};

/**
 * Every API route, the action it is authorized with, and the status an allowed call returns with
 * the body sent here. Allowed writes get invalid bodies (422) or a missing revision (404) so they
 * change nothing; publish succeeds, and the suite resets the database afterwards.
 */
const ROUTES = [
  {
    method: 'get',
    path: '/api/theme/revisions',
    action: 'theme.read',
    ok: 200,
  },
  {
    method: 'post',
    path: '/api/theme/resolve',
    action: 'theme.read',
    ok: 422,
    data: {},
  },
  {
    method: 'post',
    path: '/api/theme/draft',
    action: 'theme.write',
    ok: 422,
    data: {},
  },
  {
    method: 'post',
    path: '/api/theme/publish',
    action: 'theme.publish',
    ok: 200,
  },
  {
    method: 'post',
    path: '/api/theme/rollback',
    action: 'theme.publish',
    ok: 404,
    data: { revision: 999 },
  },
  {
    method: 'post',
    path: '/api/widget/origins',
    action: 'widget.write',
    ok: 422,
    data: { origins: [] },
  },
  {
    method: 'post',
    path: '/api/tenant-config',
    action: 'config.write',
    ok: 422,
    data: {},
  },
] as const;

/** The matrix, written out (ADR-013): agents may only read; tenant users only their own tenant. */
function allowed(role: Role, action: string, own: boolean): boolean {
  if (role === 'super_admin') return true;
  if (!own) return false;
  if (role === 'agent') return action.endsWith('.read');
  return true;
}

test('P2.1-AC04: every role × every route × own and other tenant: allowed or 403', async () => {
  test.setTimeout(180_000);
  const rows: string[] = [];
  for (const role of Object.keys(USERS) as Role[]) {
    const ctx = await contextAs(USERS[role]);
    for (const own of [true, false]) {
      const tenant = own ? 't_acme' : 't_globex';
      for (const route of ROUTES) {
        const url = `${DASHBOARD}${route.path}?tenantId=${tenant}`;
        const res =
          route.method === 'get'
            ? await ctx.get(url)
            : await ctx.post(url, { data: 'data' in route ? route.data : {} });
        const expectAllowed = allowed(role, route.action, own);
        const expected = expectAllowed ? route.ok : 403;
        rows.push(
          `${role.padEnd(12)} ${own ? 'own  ' : 'other'} ${route.action.padEnd(13)} ${route.method.toUpperCase()} ${route.path} -> ${res.status()}`,
        );
        expect(
          res.status(),
          `${role} ${own ? 'own' : 'other'} ${route.method} ${route.path}`,
        ).toBe(expected);
      }
    }
    await ctx.dispose();
  }
  // 3 roles × 2 tenants × 7 routes, printed for the evidence file.
  expect(rows).toHaveLength(42);
  console.log(`P2.1-AC04 matrix:\n${rows.join('\n')}`);
});

test('P2.1-AC04: a tenant user without a tenant id acts on their own tenant only', async () => {
  const ctx = await contextAs(USERS.agent);
  expect((await ctx.get(`${DASHBOARD}/api/theme/revisions`)).status()).toBe(
    200,
  );
  expect(
    (await ctx.post(`${DASHBOARD}/api/theme/draft`, { data: {} })).status(),
  ).toBe(403);
  await ctx.dispose();
});

test('P2.1-AC09: removing a membership in the database ends the session on the next request', async () => {
  const ctx = await contextAs(USERS.agent);
  const page = async () =>
    (await ctx.get(`${DASHBOARD}/`, { maxRedirects: 0 })).status();
  expect(await page()).toBe(200);
  try {
    await ownerQuery(
      "DELETE FROM tenant_memberships WHERE user_id = 'u_acme_agent' AND tenant_id = 't_acme'",
    );
    // Same cookie, no new sign-in: the page now redirects to the switcher and the API refuses.
    expect(await page()).toBe(307);
    expect((await ctx.get(`${DASHBOARD}/api/theme/revisions`)).status()).toBe(
      401,
    );
  } finally {
    await ownerQuery(
      "INSERT INTO tenant_memberships (user_id, tenant_id, role) VALUES ('u_acme_agent', 't_acme', 'agent') ON CONFLICT DO NOTHING",
    );
  }
  expect(await page()).toBe(200);
  await ctx.dispose();
});

test('P2.1-AC09: a role change applies on the next request, with the same cookie', async () => {
  const ctx = await contextAs(USERS.agent);
  const draft = async () =>
    (await ctx.post(`${DASHBOARD}/api/theme/draft`, { data: {} })).status();
  expect(await draft()).toBe(403);
  try {
    await ownerQuery(
      "UPDATE tenant_memberships SET role = 'tenant_admin' WHERE user_id = 'u_acme_agent'",
    );
    expect(await draft()).toBe(422); // allowed now; the empty body is invalid
  } finally {
    await ownerQuery(
      "UPDATE tenant_memberships SET role = 'agent' WHERE user_id = 'u_acme_agent'",
    );
  }
  expect(await draft()).toBe(403);
  await ctx.dispose();
});

/** Runs a database script with the e2e database; returns status and output. */
function script(
  name: string,
  args: string[] = [],
  env: Record<string, string> = {},
) {
  const r = spawnSync(
    process.execPath,
    [path.join(ROOT, 'tools', 'scripts', 'db', name), ...args],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } },
  );
  return { status: r.status, output: `${r.stdout}${r.stderr}` };
}

test('P2.1-AC01: re-running the migrations is a no-op; an edited applied migration fails the runner', () => {
  const again = script('migrate.mjs', [`--database=${e2eDatabase()}`]);
  expect(again.status).toBe(0);
  expect(again.output).toContain('up to date');

  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'byteflock-migrations-'));
  const source = path.join(ROOT, 'apps', 'admin-dashboard', 'db', 'migrations');
  fs.cpSync(source, copy, { recursive: true });
  fs.appendFileSync(path.join(copy, '0001_init.sql'), '\n-- edited\n');
  const edited = script('migrate.mjs', [
    `--database=${e2eDatabase()}`,
    `--dir=${copy}`,
  ]);
  expect(edited.status).toBe(1);
  expect(edited.output).toContain(
    '0001_init.sql was edited after it was applied',
  );
});

test('P2.1-AC15: the seed and the database scripts refuse to run in production', () => {
  for (const name of ['seed.mjs', 'recreate.mjs']) {
    const r = script(name, [`--database=${e2eDatabase()}`], {
      NODE_ENV: 'production',
    });
    expect(r.status, name).not.toBe(0);
    expect(r.output, name).toContain('NODE_ENV=production');
  }
});

test('the dev server names its database on /healthz for the global setup; production never does', async ({
  request,
}) => {
  const dev = await request.get(`${DASHBOARD}/healthz`);
  expect(dev.headers()['x-byteflock-database']).toBe(e2eDatabase());
  const prod = await request.get('http://localhost:3005/healthz');
  expect(prod.status()).toBe(200);
  expect(prod.headers()['x-byteflock-database']).toBeUndefined();
});

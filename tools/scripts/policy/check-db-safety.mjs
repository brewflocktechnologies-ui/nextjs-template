// Policy (D-27, P2.1-T18; ADR-012, ADR-013): tenant isolation holds in the database itself.
//
// Reads the catalog of the migrated stack database (as the owner role, like db:migrate) and fails
// when:
// - a table with a `tenant_id` column lacks row-level security (enabled AND forced), has no policy,
//   or has a policy that is `true` or does not read `app.tenant_id`;
// - a table without `tenant_id` is not on the named allowlist below (a new global table is a
//   decision, not an accident), or an allowlisted table that must stay closed is reachable by the
//   application role;
// - the application role (the user of DATABASE_URL, default byteflock_app) is a superuser, can
//   bypass row-level security, create roles or databases, owns a table, schema or function, is a
//   member of a privileged role, or holds TRUNCATE, REFERENCES or TRIGGER on any table (TRUNCATE
//   ignores row-level security and row triggers).
//
// The decision is a pure function of a catalog snapshot, and the check proves itself first by
// running negative snapshots that must each fail. It needs the database: run `pnpm db:up` (verify
// does). With BYTEFLOCK_REPORT_DIR set, details/db-safety.json is written for the report.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
const require = createRequire(
  path.join(root, 'apps', 'admin-dashboard', 'package.json'),
);

/** Tables without tenant_id that are allowed, each with the reason; `closed` = the app role gets no access. */
export const NON_TENANT_TABLES = {
  users: {
    reason:
      'no tenant_id: the request context loads a user before any scope exists',
    closed: false,
  },
  schema_migrations: {
    reason: 'migration bookkeeping, owned and read by the owner role only',
    closed: true,
  },
};

export function appRoleName(env = process.env) {
  try {
    if (env.DATABASE_URL)
      return (
        decodeURIComponent(new URL(env.DATABASE_URL).username) ||
        'byteflock_app'
      );
  } catch {
    // A malformed URL falls back to the default; the application would not start with it anyway.
  }
  return 'byteflock_app';
}

/** Pure decision over a catalog snapshot. Returns { failures, tables, role }. */
export function evaluate(snapshot, allowlist = NON_TENANT_TABLES) {
  const failures = [];
  const { role } = snapshot;
  const name = snapshot.appRole;

  if (!role) failures.push(`application role ${name} does not exist`);
  else {
    for (const [flag, what] of [
      ['rolsuper', 'is a superuser'],
      ['rolbypassrls', 'has BYPASSRLS'],
      ['rolcreaterole', 'can create roles'],
      ['rolcreatedb', 'can create databases'],
      ['rolreplication', 'has REPLICATION'],
    ])
      if (role[flag]) failures.push(`role ${name} ${what}`);
  }
  if (snapshot.ownedSchemas > 0)
    failures.push(`role ${name} owns ${snapshot.ownedSchemas} schema(s)`);
  if (snapshot.ownedFunctions > 0)
    failures.push(`role ${name} owns ${snapshot.ownedFunctions} function(s)`);
  for (const m of snapshot.memberOf ?? [])
    if (m.rolsuper || m.rolbypassrls || m.rolcreaterole)
      failures.push(
        `role ${name} is a member of the privileged role ${m.rolname}`,
      );

  const rows = [];
  for (const t of snapshot.tables) {
    const policies = snapshot.policies.filter((p) => p.table === t.name);
    const row = {
      table: t.name,
      kind: t.hasTenantId ? 'tenant' : 'global',
      rls: t.rls,
      forced: t.forced,
      policies: policies.length,
      appRead: t.appRead,
      appWrite: t.appWrite,
    };
    rows.push(row);

    if (t.owner === name)
      failures.push(
        `${t.name}: owned by the application role, which could disable row-level security`,
      );
    for (const [flag, priv] of [
      ['appTruncate', 'TRUNCATE'],
      ['appReferences', 'REFERENCES'],
      ['appTrigger', 'TRIGGER'],
    ])
      if (t[flag])
        failures.push(
          `${t.name}: the application role has ${priv}${priv === 'TRUNCATE' ? ' (it ignores row-level security)' : ''}`,
        );

    if (t.hasTenantId) {
      if (!t.rls)
        failures.push(
          `${t.name}: has tenant_id but row-level security is not enabled`,
        );
      if (!t.forced)
        failures.push(
          `${t.name}: row-level security is not forced (the owner would bypass it)`,
        );
      if (policies.length === 0)
        failures.push(`${t.name}: has tenant_id but no policy`);
      for (const p of policies) {
        const qual = (p.qual ?? '').replace(/[\s()]/g, '').toLowerCase();
        if (qual === '' || qual === 'true')
          failures.push(`${t.name}: policy ${p.name} allows every row`);
        else if (!qual.includes('app.tenant_id'))
          failures.push(
            `${t.name}: policy ${p.name} does not read app.tenant_id`,
          );
      }
    } else {
      const entry = allowlist[t.name];
      if (!entry)
        failures.push(
          `${t.name}: has no tenant_id and is not on the allowlist; add tenant_id with row-level security, or list it in NON_TENANT_TABLES with a reason`,
        );
      else if (entry.closed && (t.appRead || t.appWrite))
        failures.push(
          `${t.name}: must stay closed to the application role but it has access`,
        );
    }
  }
  for (const name of Object.keys(allowlist))
    if (!snapshot.tables.some((t) => t.name === name))
      failures.push(
        `allowlist names ${name}, which is not a table (remove it)`,
      );

  return { failures, tables: rows, role: role ?? null };
}

/** Snapshots that must fail, and one that must pass; returns the cases that did not behave. */
export function selfTest() {
  const good = () => ({
    appRole: 'byteflock_app',
    role: {
      rolsuper: false,
      rolbypassrls: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolreplication: false,
    },
    ownedSchemas: 0,
    ownedFunctions: 0,
    memberOf: [],
    tables: [
      {
        name: 'tenants',
        owner: 'byteflock',
        hasTenantId: true,
        rls: true,
        forced: true,
        appRead: true,
        appWrite: true,
        appTruncate: false,
        appReferences: false,
        appTrigger: false,
      },
      {
        name: 'users',
        owner: 'byteflock',
        hasTenantId: false,
        rls: false,
        forced: false,
        appRead: true,
        appWrite: false,
        appTruncate: false,
        appReferences: false,
        appTrigger: false,
      },
      {
        name: 'schema_migrations',
        owner: 'byteflock',
        hasTenantId: false,
        rls: false,
        forced: false,
        appRead: false,
        appWrite: false,
        appTruncate: false,
        appReferences: false,
        appTrigger: false,
      },
    ],
    policies: [
      {
        table: 'tenants',
        name: 'tenant_isolation',
        qual: "((current_setting('app.scope'::text, true) = 'platform'::text) OR (tenant_id = current_setting('app.tenant_id'::text, true)))",
      },
    ],
  });
  const t = (s, name) => s.tables.find((x) => x.name === name);
  const cases = [
    ['a correct database passes', (s) => s, true],
    [
      'RLS not enabled',
      (s) => {
        t(s, 'tenants').rls = false;
        return s;
      },
    ],
    [
      'RLS not forced',
      (s) => {
        t(s, 'tenants').forced = false;
        return s;
      },
    ],
    [
      'no policy',
      (s) => {
        s.policies = [];
        return s;
      },
    ],
    [
      'policy USING (true)',
      (s) => {
        s.policies[0].qual = 'true';
        return s;
      },
    ],
    [
      'policy that ignores app.tenant_id',
      (s) => {
        s.policies[0].qual =
          "(current_setting('app.scope', true) = 'platform')";
        return s;
      },
    ],
    [
      'a new table without tenant_id',
      (s) => {
        s.tables.push({
          name: 'invoices',
          owner: 'byteflock',
          hasTenantId: false,
          appRead: true,
          appWrite: true,
        });
        return s;
      },
    ],
    [
      'schema_migrations readable by the app role',
      (s) => {
        t(s, 'schema_migrations').appRead = true;
        return s;
      },
    ],
    [
      'app role missing',
      (s) => {
        s.role = null;
        return s;
      },
    ],
    [
      'app role superuser',
      (s) => {
        s.role.rolsuper = true;
        return s;
      },
    ],
    [
      'app role BYPASSRLS',
      (s) => {
        s.role.rolbypassrls = true;
        return s;
      },
    ],
    [
      'app role owns a table',
      (s) => {
        t(s, 'tenants').owner = 'byteflock_app';
        return s;
      },
    ],
    [
      'app role owns a schema',
      (s) => {
        s.ownedSchemas = 1;
        return s;
      },
    ],
    [
      'app role has TRUNCATE',
      (s) => {
        t(s, 'tenants').appTruncate = true;
        return s;
      },
    ],
    [
      'app role member of a superuser role',
      (s) => {
        s.memberOf = [{ rolname: 'admin', rolsuper: true }];
        return s;
      },
    ],
    [
      'allowlist names a missing table',
      (s) => {
        s.tables = s.tables.filter((x) => x.name !== 'users');
        return s;
      },
    ],
  ];
  return cases
    .filter(
      ([, mutate, shouldPass]) =>
        (evaluate(mutate(good())).failures.length === 0) !==
        Boolean(shouldPass),
    )
    .map(([name]) => name);
}

async function readSnapshot(connectionString, appRole) {
  const { Client } = require('pg');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const q = async (text, params = []) =>
      (await client.query(text, params)).rows;
    const [role] = await q(
      'SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication FROM pg_roles WHERE rolname = $1',
      [appRole],
    );
    const tables = await q(
      `SELECT c.relname AS name, pg_get_userbyid(c.relowner) AS owner,
              c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
              EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped) AS "hasTenantId",
              CASE WHEN $1::name IN (SELECT rolname FROM pg_roles) THEN has_table_privilege($1, c.oid, 'SELECT') ELSE false END AS "appRead",
              CASE WHEN $1::name IN (SELECT rolname FROM pg_roles) THEN has_table_privilege($1, c.oid, 'INSERT,UPDATE,DELETE') ELSE false END AS "appWrite",
              CASE WHEN $1::name IN (SELECT rolname FROM pg_roles) THEN has_table_privilege($1, c.oid, 'TRUNCATE') ELSE false END AS "appTruncate",
              CASE WHEN $1::name IN (SELECT rolname FROM pg_roles) THEN has_table_privilege($1, c.oid, 'REFERENCES') ELSE false END AS "appReferences",
              CASE WHEN $1::name IN (SELECT rolname FROM pg_roles) THEN has_table_privilege($1, c.oid, 'TRIGGER') ELSE false END AS "appTrigger"
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
        ORDER BY c.relname`,
      [appRole],
    );
    const policies = await q(
      "SELECT tablename AS table, policyname AS name, qual FROM pg_policies WHERE schemaname = 'public'",
    );
    const [{ n: ownedSchemas }] = await q(
      'SELECT count(*)::int AS n FROM pg_namespace WHERE nspowner = (SELECT oid FROM pg_roles WHERE rolname = $1)',
      [appRole],
    );
    const [{ n: ownedFunctions }] = await q(
      "SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proowner = (SELECT oid FROM pg_roles WHERE rolname = $1)",
      [appRole],
    );
    const memberOf = await q(
      `SELECT r.rolname, r.rolsuper, r.rolbypassrls, r.rolcreaterole
         FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid
        WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = $1)`,
      [appRole],
    );
    return {
      appRole,
      role: role ?? null,
      tables,
      policies,
      ownedSchemas,
      ownedFunctions,
      memberOf,
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const broken = selfTest();
  if (broken.length) {
    console.error(
      `check-db-safety: self-test failed, the check does not catch: ${broken.join('; ')}`,
    );
    process.exit(1);
  }

  const { ownerUrl } = await import('../db/migrate.mjs');
  const appRole = appRoleName();
  let snapshot;
  try {
    snapshot = await readSnapshot(ownerUrl(), appRole);
  } catch (error) {
    console.error(
      `check-db-safety: cannot read the database (${error.message}). Start it with \`pnpm db:up\` (Docker), then run \`pnpm db:migrate\`.`,
    );
    process.exit(1);
  }

  const result = evaluate(snapshot);
  const dir = process.env.BYTEFLOCK_REPORT_DIR;
  if (dir) {
    const out = path.join(dir, 'details', 'db-safety.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(
      out,
      JSON.stringify({ appRole, ...result }, null, 2) + '\n',
    );
  }

  const tenant = result.tables.filter((t) => t.kind === 'tenant').length;
  console.log(
    `check-db-safety: ${tenant} tenant tables with forced row-level security and a scoped policy, ${result.tables.length - tenant} allowlisted; ${appRole} is not a superuser, owns nothing and cannot truncate; self-test passed`,
  );
  if (result.failures.length) {
    console.error(`check-db-safety:\n  ${result.failures.join('\n  ')}`);
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();

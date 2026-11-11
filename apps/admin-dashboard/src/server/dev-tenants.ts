// The tenants offered by the development session switcher (D-12, P2.1-T07): read from Postgres
// (replacing the old validation/tenants.json read). Development only, and read before any session
// exists, so it uses platform scope for this one listing. /dev/session reworks it in P2.1-T12.
import 'server-only';
import { withScope } from './db';
import { isDevOnly } from './dev-only';

export interface DevTenant {
  tenantId: string;
  name: string;
  widgetKey: string | null;
  user: string;
  roles: string[];
  locale: string;
}

/** Each tenant with its admin user, ordered by tenant id. Empty outside development. */
export async function listDevTenants(): Promise<DevTenant[]> {
  if (!isDevOnly()) return [];
  const rows = await withScope({ scope: 'platform' }, (db) =>
    db.rows<{
      tenant_id: string;
      name: string;
      widget_key: string | null;
      user_id: string;
      locale: string;
    }>(
      `SELECT t.tenant_id, t.name, u.user_id, u.locale,
              (SELECT w.widget_key FROM widget_keys w
                WHERE w.tenant_id = t.tenant_id ORDER BY w.widget_key LIMIT 1) AS widget_key
         FROM tenants t
         JOIN LATERAL (
           SELECT m.user_id FROM tenant_memberships m
            WHERE m.tenant_id = t.tenant_id AND m.role = 'tenant_admin'
            ORDER BY m.user_id LIMIT 1
         ) admin ON true
         JOIN users u ON u.user_id = admin.user_id
        ORDER BY t.tenant_id`,
    ),
  );
  return rows.map((r) => ({
    tenantId: r.tenant_id,
    name: r.name,
    widgetKey: r.widget_key,
    user: r.user_id,
    roles: ['tenant_admin'],
    locale: r.locale,
  }));
}

export async function devTenant(tenantId: string): Promise<DevTenant | null> {
  return (await listDevTenants()).find((t) => t.tenantId === tenantId) ?? null;
}

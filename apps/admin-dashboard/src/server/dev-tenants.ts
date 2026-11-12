// The users offered by the development session switcher (D-12, P2.1-T12), read from Postgres.
// Development only, and read before any session exists, so it uses platform scope for these
// listings. Nothing here decides what a user may do: the request context is rebuilt from the
// database on every request (ADR-013); this only picks whose cookie to sign.
import 'server-only';
import { withScope } from './db';
import { isDevOnly } from './dev-only';
import type { SessionClaims, TenantRole } from './session/types';
import { TENANT_ID, USER_ID } from './session/types';

export interface DevUser {
  userId: string;
  displayName: string;
  role: 'super_admin' | TenantRole;
}

export interface DevTenantGroup {
  tenantId: string;
  name: string;
  widgetKey: string | null;
  users: DevUser[];
}

export interface DevUsers {
  platform: DevUser[];
  tenants: DevTenantGroup[];
}

/**
 * Every user the switcher offers: super admins under "Platform", then each tenant with its members
 * (admins first). Empty outside development.
 */
export async function listDevUsers(): Promise<DevUsers> {
  if (!isDevOnly()) return { platform: [], tenants: [] };
  return withScope({ scope: 'platform' }, async (db) => {
    const platform = await db.rows<{ user_id: string; display_name: string }>(
      `SELECT user_id, display_name FROM users
        WHERE platform_role = 'super_admin' ORDER BY user_id`,
    );
    const members = await db.rows<{
      tenant_id: string;
      name: string;
      widget_key: string | null;
      user_id: string | null;
      display_name: string | null;
      role: TenantRole | null;
    }>(
      `SELECT t.tenant_id, t.name, u.user_id, u.display_name, m.role,
              (SELECT w.widget_key FROM widget_keys w
                WHERE w.tenant_id = t.tenant_id ORDER BY w.widget_key LIMIT 1) AS widget_key
         FROM tenants t
         LEFT JOIN tenant_memberships m ON m.tenant_id = t.tenant_id
         LEFT JOIN users u ON u.user_id = m.user_id
        ORDER BY t.tenant_id, (m.role = 'tenant_admin') DESC, u.user_id`,
    );
    const tenants: DevTenantGroup[] = [];
    for (const row of members) {
      let group = tenants.at(-1);
      if (group?.tenantId !== row.tenant_id) {
        group = {
          tenantId: row.tenant_id,
          name: row.name,
          widgetKey: row.widget_key,
          users: [],
        };
        tenants.push(group);
      }
      if (row.user_id && row.display_name && row.role)
        group.users.push({
          userId: row.user_id,
          displayName: row.display_name,
          role: row.role,
        });
    }
    return {
      platform: platform.map((u) => ({
        userId: u.user_id,
        displayName: u.display_name,
        role: 'super_admin' as const,
      })),
      tenants,
    };
  });
}

/**
 * The cookie claims for a switcher choice, or null when the choice does not match the database:
 * a super admin always signs in without a tenant; a tenant user only into a tenant they belong to.
 */
export async function devClaimsFor(
  userId: string,
  tenantId: string | null,
): Promise<SessionClaims | null> {
  if (!isDevOnly() || !USER_ID.test(userId)) return null;
  if (tenantId !== null && !TENANT_ID.test(tenantId)) return null;
  const users = await listDevUsers();
  if (users.platform.some((u) => u.userId === userId))
    return { userId, tenantId: null };
  const group = users.tenants.find((t) => t.tenantId === tenantId);
  return group?.users.some((u) => u.userId === userId)
    ? { userId, tenantId }
    : null;
}

/** A tenant's first admin (the switcher's per-tenant shortcut and the e2e helper). */
export async function devTenantAdmin(
  tenantId: string,
): Promise<SessionClaims | null> {
  const group = (await listDevUsers()).tenants.find(
    (t) => t.tenantId === tenantId,
  );
  const admin = group?.users.find((u) => u.role === 'tenant_admin');
  return admin ? { userId: admin.userId, tenantId } : null;
}

/** The first super admin, or null. */
export async function devPlatformUser(): Promise<SessionClaims | null> {
  const first = (await listDevUsers()).platform[0];
  return first ? { userId: first.userId, tenantId: null } : null;
}

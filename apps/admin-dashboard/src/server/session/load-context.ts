// Builds the request context from the database (P2.1-T06, ADR-013). Called on every request, so a
// role change, a removed membership or a deleted user takes effect on the next request.
import 'server-only';
import { withScope } from '../db';
import type { SessionClaims, RequestContext, TenantRole } from './types';

interface UserRecord {
  locale: string;
  platform_role: 'super_admin' | null;
}

/**
 * The context for a signed cookie's claims, or null when the user no longer exists or has no
 * membership in the claimed tenant. A super admin always gets platform scope, whatever tenant the
 * cookie names. Never throws for a stale cookie; database errors do propagate.
 */
export async function loadContext(
  claims: SessionClaims,
): Promise<RequestContext | null> {
  // `users` has no tenant_id and no row-level security: the user is read before any tenant scope
  // exists. Platform scope here only satisfies withScope; nothing tenant-owned is read with it.
  const user = await withScope({ scope: 'platform' }, (db) =>
    db.maybeOne<UserRecord>(
      'SELECT locale, platform_role FROM users WHERE user_id = $1',
      [claims.userId],
    ),
  );
  if (!user) return null;
  if (user.platform_role === 'super_admin') {
    return {
      scope: 'platform',
      userId: claims.userId,
      roles: ['super_admin'],
      locale: user.locale,
    };
  }
  if (!claims.tenantId) return null;
  const tenantId = claims.tenantId;
  const membership = await withScope({ scope: 'tenant', tenantId }, (db) =>
    db.maybeOne<{ role: TenantRole }>(
      'SELECT role FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2',
      [claims.userId, tenantId],
    ),
  );
  if (!membership) return null;
  return {
    scope: 'tenant',
    tenantId,
    userId: claims.userId,
    roles: [membership.role],
    locale: user.locale,
  };
}

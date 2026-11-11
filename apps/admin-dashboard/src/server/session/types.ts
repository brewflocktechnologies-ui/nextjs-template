/**
 * Who is making the request (ADR-013, P2.1 section 4.3). A tenant user acts inside one tenant; a
 * super admin acts in platform scope across tenants. Built by the server from the database on
 * every request, never read from the cookie.
 */
export type TenantRole = 'tenant_admin' | 'agent';

export interface TenantContext {
  scope: 'tenant';
  tenantId: string;
  userId: string;
  roles: TenantRole[];
  locale: string;
}

export interface PlatformContext {
  scope: 'platform';
  userId: string;
  roles: ['super_admin'];
  locale: string;
}

export type RequestContext = TenantContext | PlatformContext;

/** What the signed development cookie carries (D-12). Roles are never in the cookie. */
export interface SessionClaims {
  userId: string;
  tenantId: string | null;
}

export const TENANT_ID = /^t_[a-z0-9_]{2,40}$/;
export const USER_ID = /^u_[a-z0-9_]{2,40}$/;

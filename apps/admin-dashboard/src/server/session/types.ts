/** Who is making the request (ADR-005). Every data access takes `tenantId` from here. */
export interface RequestContext {
  tenantId: string;
  userId: string;
  roles: string[];
  locale: string;
}

export const TENANT_ID = /^t_[a-z0-9_]{2,40}$/;
export const USER_ID = /^u_[a-z0-9_]{2,40}$/;

// The one authorization helper (P2.1-T06, ADR-013). Every route handler and server action calls
// authorize() before any data access. Database row-level security gets the same scope, so a missed
// call still cannot leak another tenant's rows.
import type { RequestContext, TenantRole } from './session/types';

export const ACTIONS = [
  'theme.read',
  'theme.write',
  'theme.publish',
  'config.read',
  'config.write',
  'widget.read',
  'widget.write',
  'tenants.list',
] as const;
export type Action = (typeof ACTIONS)[number];

/** What each tenant role may do. `tenants.list` is platform-only and appears in no tenant role. */
const ROLE_ACTIONS: Record<TenantRole, readonly Action[]> = {
  tenant_admin: [
    'theme.read',
    'theme.write',
    'theme.publish',
    'config.read',
    'config.write',
    'widget.read',
    'widget.write',
  ],
  agent: ['theme.read', 'config.read', 'widget.read'],
};

/** A refusal. Route handlers map it to HTTP 403. */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(
    readonly action: Action,
    readonly tenantId: string | null,
  ) {
    super(`forbidden: ${action}${tenantId ? ` on ${tenantId}` : ''}`);
    this.name = 'ForbiddenError';
  }
}

/**
 * Throws ForbiddenError unless `ctx` may perform `action` on `tenantId`. Platform scope may do
 * everything. Tenant scope may act only on its own tenant, and only with an action its role
 * allows. `tenantId` is null for actions that name no tenant (`tenants.list`).
 */
export function authorize(
  ctx: RequestContext,
  tenantId: string | null,
  action: Action,
): void {
  if (ctx.scope === 'platform') return;
  if (
    tenantId !== null &&
    ctx.tenantId === tenantId &&
    ctx.roles.some((role) => ROLE_ACTIONS[role]?.includes(action))
  ) {
    return;
  }
  throw new ForbiddenError(action, tenantId);
}

/** True when authorize() would not throw; for hiding controls, never as the check itself. */
export function can(
  ctx: RequestContext,
  tenantId: string | null,
  action: Action,
): boolean {
  try {
    authorize(ctx, tenantId, action);
    return true;
  } catch (error) {
    if (error instanceof ForbiddenError) return false;
    throw error;
  }
}

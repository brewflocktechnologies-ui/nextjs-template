// Helpers for the dashboard's route handlers: authenticated, authorized, never cached.
import 'server-only';
import { ForbiddenError, authorize, type Action } from './authorize';
import { getOptionalRequestContext } from './request-context';
import { isModuleEnabled, moduleOfAction } from './tenant-config/modules';
import { TENANT_ID, type RequestContext } from './session/types';

export function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

/** The request context, or a 401 response to return as is. */
export async function requireContext(): Promise<RequestContext | Response> {
  const ctx = await getOptionalRequestContext();
  return ctx ?? json({ error: 'unauthenticated' }, 401);
}

/** The tenant a request acts on, with who is asking. */
export interface Target {
  ctx: RequestContext;
  tenantId: string;
  userId: string;
}

/**
 * For handlers that act on one tenant (P2.1-T10): the target after authorize(), or a 400, 401, 403
 * or 404 response to return as is. A tenant user acts on their own tenant; naming another one with
 * `?tenantId=` is refused (403). A super admin must name the tenant. A disabled module's routes do
 * not exist for tenant users (CONFIG-01).
 */
export async function requireTenantTarget(
  request: Request,
  action: Action,
): Promise<Target | Response> {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const asked = new URL(request.url).searchParams.get('tenantId');
  if (ctx.scope === 'platform' && !asked)
    return json({ error: 'tenantId is required' }, 400);
  const tenantId = asked ?? (ctx.scope === 'tenant' ? ctx.tenantId : '');
  if (!TENANT_ID.test(tenantId))
    return json({ error: 'invalid tenantId' }, 400);
  try {
    authorize(ctx, tenantId, action);
  } catch (error) {
    if (error instanceof ForbiddenError) return forbidden(error);
    throw error;
  }
  const module = moduleOfAction(action);
  if (module && !(await isModuleEnabled(ctx, module)))
    return json({ error: 'not found' }, 404);
  return { ctx, tenantId, userId: ctx.userId };
}

export function forbidden(error: ForbiddenError): Response {
  return json({ error: 'forbidden', action: error.action }, 403);
}

export async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

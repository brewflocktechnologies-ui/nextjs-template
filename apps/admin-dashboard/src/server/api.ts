// Helpers for the dashboard's route handlers: authenticated, authorized, never cached.
import 'server-only';
import { ForbiddenError, authorize, type Action } from './authorize';
import { getOptionalRequestContext } from './request-context';
import { isModuleEnabled, moduleOfAction } from './tenant-config/modules';
import type { RequestContext, TenantContext } from './session/types';

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

/**
 * For handlers that act on the signed-in user's own tenant: the tenant context after authorize(),
 * or a 401 or 403 response to return as is. Platform scope has no own tenant, so these routes
 * refuse it (403); platform pages name the tenant explicitly (P2.1-T10).
 */
export async function requireTenantAction(
  action: Action,
): Promise<TenantContext | Response> {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  if (ctx.scope !== 'tenant')
    return forbidden(new ForbiddenError(action, null));
  try {
    authorize(ctx, ctx.tenantId, action);
  } catch (error) {
    if (error instanceof ForbiddenError) return forbidden(error);
    throw error;
  }
  // A disabled module's routes do not exist for the tenant (CONFIG-01).
  const module = moduleOfAction(action);
  if (module && !(await isModuleEnabled(ctx, module)))
    return json({ error: 'not found' }, 404);
  return ctx;
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

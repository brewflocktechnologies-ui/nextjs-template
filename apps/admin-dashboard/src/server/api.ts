// Helpers for the dashboard's route handlers: authenticated, never cached.
import 'server-only';
import { getOptionalRequestContext } from './request-context';
import type { RequestContext } from './session/types';

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

export async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

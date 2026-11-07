// Request context (ADR-005, P1.6-T01): who is asking, derived from the session on every request.
// No module-level state holds tenant data.
import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isDevOnly } from './dev-only';
import { SESSION_COOKIE } from './proxy-allowlist';
import type { RequestContext } from './session/types';

/** The context, or null without a valid session. The production adapter has no sessions yet. */
export async function getOptionalRequestContext(): Promise<RequestContext | null> {
  if (!isDevOnly()) return null;
  const { readSession } = await import('./session/dev-adapter');
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value ? readSession(value) : null;
}

/** The context for an authenticated page; without one, redirects to the tenant switcher. */
export async function getRequestContext(): Promise<RequestContext> {
  if (!isDevOnly())
    throw new Error('Production session adapter: not implemented (ADR-005).');
  const ctx = await getOptionalRequestContext();
  if (!ctx) redirect('/dev/session');
  return ctx;
}

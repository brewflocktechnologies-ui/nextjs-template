// Request context (ADR-013, P2.1-T06): who is asking, derived from the signed cookie plus the
// database on every request. No module-level state holds tenant data.
import 'server-only';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { isDevOnly } from './dev-only';
import { SESSION_COOKIE } from './proxy-allowlist';
import { loadContext } from './session/load-context';
import type {
  PlatformContext,
  RequestContext,
  TenantContext,
} from './session/types';

/** The context, or null without a valid session or when the user or membership is gone. */
export async function getOptionalRequestContext(): Promise<RequestContext | null> {
  if (!isDevOnly()) return null;
  const { readSession } = await import('./session/dev-adapter');
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = value ? readSession(value) : null;
  return claims ? loadContext(claims) : null;
}

/** The context for an authenticated page; without one, redirects to the tenant switcher. */
export async function getRequestContext(): Promise<RequestContext> {
  if (!isDevOnly())
    throw new Error('Production session adapter: not implemented (ADR-005).');
  const ctx = await getOptionalRequestContext();
  if (!ctx) redirect('/dev/session');
  return ctx;
}

/**
 * The context for a tenant page (`/`, `/settings/**`). A super admin has no tenant here and is sent
 * to `/platform` (ADR-013 routing; the platform pages arrive in P2.1-T10).
 */
export async function getTenantContext(): Promise<TenantContext> {
  const ctx = await getRequestContext();
  if (ctx.scope === 'platform') redirect('/platform');
  return ctx;
}

/**
 * The context for a platform page (`/platform/**`). A tenant user gets a 404, not a 403, so the
 * route's existence is not revealed (ADR-013 routing); no session redirects to the switcher.
 */
export async function getPlatformContext(): Promise<PlatformContext> {
  const ctx = await getRequestContext();
  if (ctx.scope !== 'platform') notFound();
  return ctx;
}

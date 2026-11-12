import { NextResponse, type NextRequest } from 'next/server';
import {
  devClaimsFor,
  devPlatformUser,
  devTenantAdmin,
} from '../../../../server/dev-tenants';
import { isDevOnly } from '../../../../server/dev-only';
import { SESSION_COOKIE } from '../../../../server/proxy-allowlist';
import type { SessionClaims } from '../../../../server/session/types';

export const dynamic = 'force-dynamic';

/** `as` is "<userId>" for a super admin or "<userId>@<tenantId>" for a tenant user. */
const AS = /^(u_[a-z0-9_]{2,40})(?:@(t_[a-z0-9_]{2,40}))?$/;

/**
 * Development only (D-12, P2.1-T12): signs the session cookie for the chosen user, after checking
 * the choice against the database. Form fields, one of:
 * - `as` ("<userId>" or "<userId>@<tenantId>"): the switcher's buttons;
 * - `tenantId`: that tenant's first admin; `platform=1`: the first super admin (shortcuts, used by
 *   the e2e helpers).
 * A super admin lands on /platform, a tenant user on /.
 */
export async function POST(request: NextRequest) {
  if (!isDevOnly()) return new NextResponse(null, { status: 404 });
  const { signSession } = await import(
    '../../../../server/session/dev-adapter'
  );
  const form = await request.formData();
  let claims: SessionClaims | null;
  const as = form.get('as');
  if (typeof as === 'string') {
    const match = AS.exec(as);
    claims = match ? await devClaimsFor(match[1], match[2] ?? null) : null;
  } else if (form.get('platform')) {
    claims = await devPlatformUser();
  } else {
    claims = await devTenantAdmin(String(form.get('tenantId') ?? ''));
  }
  if (!claims) return new NextResponse('Unknown user', { status: 400 });

  const landing = claims.tenantId === null ? '/platform' : '/';
  const response = NextResponse.redirect(new URL(landing, request.url), 303);
  response.cookies.set(SESSION_COOKIE, signSession(claims), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

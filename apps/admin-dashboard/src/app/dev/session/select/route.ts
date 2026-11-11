import { NextResponse, type NextRequest } from 'next/server';
import { devPlatformUser, devTenant } from '../../../../server/dev-tenants';
import { isDevOnly } from '../../../../server/dev-only';
import { SESSION_COOKIE } from '../../../../server/proxy-allowlist';

export const dynamic = 'force-dynamic';

/**
 * Development only (D-12): sets the signed session cookie for a local tenant's admin (`tenantId`)
 * or for the super admin (`platform=1`). The full user switcher arrives in P2.1-T12.
 */
export async function POST(request: NextRequest) {
  if (!isDevOnly()) return new NextResponse(null, { status: 404 });
  const { signSession } = await import(
    '../../../../server/session/dev-adapter'
  );
  const form = await request.formData();
  let claims: { userId: string; tenantId: string | null };
  let landing = '/';
  if (form.get('platform')) {
    const user = await devPlatformUser();
    if (!user) return new NextResponse('No super admin', { status: 400 });
    claims = { userId: user, tenantId: null };
    landing = '/platform';
  } else {
    const tenant = await devTenant(String(form.get('tenantId') ?? ''));
    if (!tenant) return new NextResponse('Unknown tenant', { status: 400 });
    claims = { userId: tenant.user, tenantId: tenant.tenantId };
  }
  const response = NextResponse.redirect(new URL(landing, request.url), 303);
  response.cookies.set(SESSION_COOKIE, signSession(claims), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

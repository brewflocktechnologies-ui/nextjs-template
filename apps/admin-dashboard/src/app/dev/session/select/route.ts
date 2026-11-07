import { NextResponse, type NextRequest } from 'next/server';
import { isDevOnly } from '../../../../server/dev-only';
import { SESSION_COOKIE } from '../../../../server/proxy-allowlist';
import { localTenant } from '../../../../server/tenants';

export const dynamic = 'force-dynamic';

/** Development only (D-12): sets the signed session cookie for a local tenant. */
export async function POST(request: NextRequest) {
  if (!isDevOnly()) return new NextResponse(null, { status: 404 });
  const { signSession } = await import(
    '../../../../server/session/dev-adapter'
  );
  const form = await request.formData();
  const tenant = localTenant(String(form.get('tenantId') ?? ''));
  if (!tenant) return new NextResponse('Unknown tenant', { status: 400 });
  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.cookies.set(
    SESSION_COOKIE,
    signSession({
      tenantId: tenant.tenantId,
      userId: tenant.user,
      roles: tenant.roles,
      locale: tenant.locale,
    }),
    { httpOnly: true, sameSite: 'lax', path: '/' },
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

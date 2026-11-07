// Next 16 proxy (formerly middleware). Routing only (ADR-005, T-11): it checks that a session cookie
// is present, never verifies it or reads data; the server verifies on every request and the backend
// authorizes. Lint (`proxy-allowlist`) allows imports from next/server and proxy-allowlist only.
import { NextResponse, type NextRequest } from 'next/server';
import {
  NONCE_HEADER,
  SESSION_COOKIE,
  isPublicPath,
} from './server/proxy-allowlist';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);
  if (!isPublic && !request.cookies.has(SESSION_COOKIE))
    return NextResponse.redirect(new URL('/dev/session', request.url));

  // A fresh nonce per request for the layout's theme <style> (ARCH-001 §9.2).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, btoa(crypto.randomUUID()));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Authenticated HTML is never cacheable (ARCH-001 §9.1, P1.6-T05).
  if (!isPublic) response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  // Everything except Next's static assets, the favicon, brand images and fonts.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|fonts/).*)'],
};

// The only module proxy.ts may import besides next/server (T-11, lint rule `proxy-allowlist`).
// Constants and pure path checks only: no data access, no session verification.

export const SESSION_COOKIE = 'dev-session';
export const NONCE_HEADER = 'x-nonce';

/** Paths that need no session. */
const PUBLIC = ['/dev/session', '/healthz'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * The dashboard's Content-Security-Policy for one request (D-28). Next.js reads the nonce from this
 * header on the request and adds it to its own scripts; the layout's theme <style> uses the same
 * nonce. `'unsafe-eval'` only in development, where React needs it for error stacks.
 */
export function contentSecurityPolicy(
  nonce: string,
  { dev, widgetOrigin }: { dev: boolean; widgetOrigin: string },
): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'report-sample'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}' 'report-sample'`,
    // Style attributes, not <style> elements: React server-renders them (theme swatches) and Base UI
    // uses them for visually hidden inputs. They cannot run script.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${widgetOrigin}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
  ].join('; ');
}

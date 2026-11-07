// The only module proxy.ts may import besides next/server (T-11, lint rule `proxy-allowlist`).
// Constants and pure path checks only: no data access, no session verification.

export const SESSION_COOKIE = 'dev-session';
export const NONCE_HEADER = 'x-nonce';

/** Paths that need no session. */
const PUBLIC = ['/dev/session', '/healthz'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Single source for the widget origin's response headers (SPECS/contracts/public-endpoints-and-headers.md,
// ENDP-01 and ENDP-03). Applied by dev-server-plugin.ts in `vite dev` and `vite preview`; emitted as
// dist/_headers for the static host from PoC-A (D-14).

/** Placeholder until PoC-A builds the frame; the frame CSP needs no runtime nonce in Phase 1 (ENDP-03 note). */
export const FRAME_STYLE_NONCE = 'phase1-static';

/** `rt.<platform>` is the realtime origin placeholder; nothing connects to it in Phase 1. */
export const REALTIME_ORIGIN = 'https://rt.byteflock.invalid';

export const FRAME_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  `style-src 'self' 'nonce-${FRAME_STYLE_NONCE}'`,
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${REALTIME_ORIGIN}`,
  // Stays `*` with the D-21 allowlist: one static document serves every widget key.
  'frame-ancestors *',
  "base-uri 'none'",
  "form-action 'none'",
  "require-trusted-types-for 'script'",
  'trusted-types lit-html byteflock-frame',
].join('; ');

export const FRAME_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': FRAME_CSP,
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
};

/** Paths that receive FRAME_HEADERS: the frame document and everything under it. */
export function isFramePath(urlPath: string): boolean {
  const path = urlPath.split('?')[0];
  return path === '/v1/frame' || path.startsWith('/v1/frame/');
}

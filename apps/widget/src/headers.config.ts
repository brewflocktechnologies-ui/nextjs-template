// Single source for the widget origin's response headers (SPECS/contracts/public-endpoints-and-headers.md,
// ENDP-01 and ENDP-03). Applied by dev-server-plugin.ts in `vite dev` and `vite preview`, and emitted
// as dist/_headers for the static host by scripts/build.mjs (D-14).

/** The frame CSP needs no runtime nonce in Phase 1 (ENDP-03 note); the nonce is a per-build constant. */
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

const IMMUTABLE = 'public, max-age=31536000, immutable';

export interface HeaderRule {
  /** Pattern for dist/_headers (static host syntax). */
  pattern: string;
  test: (pathname: string) => boolean;
  headers: Readonly<Record<string, string>>;
}

/** ENDP-01 caching, ENDP-03 frame headers. The first matching rule wins. */
export const HEADER_RULES: readonly HeaderRule[] = [
  {
    pattern: '/v1/loader.js',
    test: (p) => p === '/v1/loader.js',
    headers: {
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  },
  {
    // Imported as a module from the customer's page, so it needs CORS (module scripts are fetched in cors mode).
    pattern: '/v1/launcher.*',
    test: (p) => /^\/v1\/launcher\.[a-z0-9]+\.js$/.test(p),
    headers: {
      'Cache-Control': IMMUTABLE,
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  },
  {
    pattern: '/v1/frame/assets/*',
    test: (p) => p.startsWith('/v1/frame/assets/'),
    headers: { ...FRAME_HEADERS, 'Cache-Control': IMMUTABLE },
  },
  {
    pattern: '/v1/frame/*',
    test: (p) => p === '/v1/frame' || p.startsWith('/v1/frame/'),
    headers: {
      ...FRAME_HEADERS,
      'Cache-Control': 'public, max-age=60, must-revalidate',
    },
  },
  {
    pattern: '/v1/config/*',
    test: (p) => p.startsWith('/v1/config/'),
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
      'X-Content-Type-Options': 'nosniff',
    },
  },
  {
    pattern: '/v1/themes/*',
    test: (p) => p.startsWith('/v1/themes/'),
    headers: {
      'Cache-Control': IMMUTABLE,
      'X-Content-Type-Options': 'nosniff',
    },
  },
  {
    pattern: '/v1/fonts/*',
    test: (p) => p.startsWith('/v1/fonts/'),
    headers: { 'Cache-Control': IMMUTABLE },
  },
  {
    pattern: '/v1/telemetry',
    test: (p) => p === '/v1/telemetry',
    headers: { 'Cache-Control': 'no-store' },
  },
];

/** Paths whose responses carry FRAME_HEADERS: the frame document and everything under it. */
export function isFramePath(urlPath: string): boolean {
  const path = urlPath.split('?')[0];
  return path === '/v1/frame' || path.startsWith('/v1/frame/');
}

/**
 * Headers for a request path. In development, config and themes are never cached, so a local
 * publish from the dashboard shows up on the next reload (SPECS/validation/local-stack.md).
 */
export function headersFor(
  urlPath: string,
  options: { dev?: boolean } = {},
): Record<string, string> {
  const path = urlPath.split('?')[0];
  const rule = HEADER_RULES.find((r) => r.test(path));
  const headers = { ...(rule?.headers ?? {}) };
  if (
    options.dev &&
    (path.startsWith('/v1/config/') || path.startsWith('/v1/themes/'))
  ) {
    headers['Cache-Control'] = 'no-store';
  }
  return headers;
}

/** dist/_headers in the common static-host format (Netlify, Cloudflare Pages). */
export function renderHeadersFile(): string {
  return (
    HEADER_RULES.map(
      (r) =>
        `${r.pattern}\n${Object.entries(r.headers)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join('\n')}`,
    ).join('\n\n') + '\n'
  );
}

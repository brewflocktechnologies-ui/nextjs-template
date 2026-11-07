import { FRAME_CSP, FRAME_HEADERS, isFramePath } from './headers.config';

describe('widget origin headers (ENDP-03)', () => {
  it('sends the five frame headers', () => {
    expect(Object.keys(FRAME_HEADERS).sort()).toEqual([
      'Content-Security-Policy',
      'Cross-Origin-Opener-Policy',
      'Permissions-Policy',
      'Referrer-Policy',
      'X-Content-Type-Options',
    ]);
  });

  it('locks the frame CSP down and enforces Trusted Types', () => {
    expect(FRAME_CSP).toContain("default-src 'none'");
    expect(FRAME_CSP).toContain("script-src 'self'");
    expect(FRAME_CSP).toContain("require-trusted-types-for 'script'");
    expect(FRAME_CSP).toContain('trusted-types lit-html byteflock-frame');
    expect(FRAME_CSP).not.toContain('unsafe-inline');
    expect(FRAME_CSP).not.toContain('unsafe-eval');
  });

  it('applies only to the frame paths', () => {
    expect(isFramePath('/v1/frame/')).toBe(true);
    expect(isFramePath('/v1/frame/?key=wk_acme_demo')).toBe(true);
    expect(isFramePath('/v1/frame/assets/main.js')).toBe(true);
    expect(isFramePath('/v1/loader.js')).toBe(false);
    expect(isFramePath('/v1/framework.js')).toBe(false);
  });
});

import { isSupportedTheme } from '@byteflock/theme/guard';
import { checkConfig, isOriginAllowed } from './config';
import { EMBEDDED_DEFAULT } from './embedded-default';
import { FONT_FACES, fontUrls } from './fonts';

const valid = {
  schemaVersion: 1,
  tenantId: 't_acme',
  themeRevision: 1,
  locale: { default: 'en-AU', supported: ['en-AU'] },
  features: { proactive: true, consent: 'required' },
  launcher: { position: 'bottom-right' },
  allowedOrigins: ['http://localhost:4300'],
};
const preview = {
  mode: 'production',
  dashboardOrigin: 'http://localhost:3000',
};

describe('config allowedOrigins (P1.5-T13, ENDP-02a)', () => {
  it('accepts 1 to 20 exact origins', () => {
    expect(checkConfig(valid)).not.toBeNull();
    const twenty = Array.from({ length: 20 }, (_, i) => `https://s${i}.test`);
    expect(checkConfig({ ...valid, allowedOrigins: twenty })).not.toBeNull();
  });

  it.each([
    ['missing', undefined],
    ['empty', []],
    ['21 entries', Array.from({ length: 21 }, (_, i) => `https://s${i}.test`)],
    ['a path', ['https://customer.example/shop']],
    ['a wildcard', ['https://*.customer.example']],
    ['upper case', ['https://Customer.example']],
    ['no scheme', ['customer.example']],
    ['a trailing slash', ['https://customer.example/']],
    ['a non-string', [42]],
  ])('rejects %s', (_, allowedOrigins) => {
    expect(checkConfig({ ...valid, allowedOrigins })).toBeNull();
  });

  it('allows only listed origins, exactly', () => {
    const c = { allowedOrigins: ['https://customer.example'] };
    expect(isOriginAllowed(c, 'https://customer.example', preview)).toBe(true);
    for (const origin of [
      'http://customer.example',
      'https://customer.example:8443',
      'https://evil.customer.example',
      'http://localhost:4300',
    ])
      expect(isOriginAllowed(c, origin, preview)).toBe(false);
  });

  it('always allows the dashboard origin in preview mode, and only then', () => {
    const c = { allowedOrigins: ['https://customer.example'] };
    expect(
      isOriginAllowed(c, 'http://localhost:3000', {
        ...preview,
        mode: 'preview',
      }),
    ).toBe(true);
    expect(isOriginAllowed(c, 'http://localhost:3000', preview)).toBe(false);
    expect(
      isOriginAllowed(c, 'http://localhost:4300', {
        ...preview,
        mode: 'preview',
      }),
    ).toBe(false);
  });
});

describe('frame theme and fonts (P1.5-T05)', () => {
  it('the embedded default passes the contract guard', () => {
    expect(isSupportedTheme(EMBEDDED_DEFAULT)).toBe(true);
  });

  it('every curated family has two font files under /v1/fonts', () => {
    expect(fontUrls('system')).toEqual([]);
    for (const family of Object.keys(FONT_FACES) as (keyof typeof FONT_FACES)[])
      for (const url of fontUrls(family))
        expect(url).toMatch(/^\/v1\/fonts\/[a-z-]+\/[a-z0-9-]+\.woff2$/);
  });
});

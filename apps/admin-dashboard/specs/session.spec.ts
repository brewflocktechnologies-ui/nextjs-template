import { decodeSession, encodeSession } from '../src/server/session/cookie';

const ctx = {
  tenantId: 't_acme',
  userId: 'u_acme_admin',
  roles: ['tenant_admin'],
  locale: 'en-AU',
};

describe('dev session cookie (P1.6-T01)', () => {
  it('a valid cookie yields the request context', () => {
    expect(decodeSession(encodeSession(ctx, 's3cret'), 's3cret')).toEqual(ctx);
  });

  it('a tampered payload or signature yields null', () => {
    const value = encodeSession(ctx, 's3cret');
    const [payload, sig] = value.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...ctx, tenantId: 't_globex', iat: 1 }),
    ).toString('base64url');
    expect(decodeSession(`${forged}.${sig}`, 's3cret')).toBeNull();
    expect(
      decodeSession(`${payload}.${sig.slice(0, -2)}xx`, 's3cret'),
    ).toBeNull();
    expect(decodeSession(value, 'other-secret')).toBeNull();
    expect(decodeSession('garbage', 's3cret')).toBeNull();
    expect(decodeSession(`${value}.extra`, 's3cret')).toBeNull();
  });

  it('a correctly signed cookie with an invalid tenant id yields null', () => {
    expect(
      decodeSession(encodeSession({ ...ctx, tenantId: '../etc' }, 'k'), 'k'),
    ).toBeNull();
  });
});

describe('dev session adapter guard (D-12, P1.6-AC07)', () => {
  const env = process.env as Record<string, string | undefined>;
  const original = env.NODE_ENV;
  afterEach(() => {
    env.NODE_ENV = original;
  });

  it('loads in development and signs readable cookies', () => {
    env.NODE_ENV = 'development';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const adapter = require('../src/server/session/dev-adapter');
      expect(adapter.readSession(adapter.signSession(ctx))).toEqual(ctx);
    });
  });

  it('throws when imported in production', () => {
    env.NODE_ENV = 'production';
    jest.isolateModules(() => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../src/server/session/dev-adapter'),
      ).toThrow(/must not load in production/);
    });
  });
});

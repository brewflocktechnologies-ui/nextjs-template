import { createHmac } from 'node:crypto';
import { decodeSession, encodeSession } from '../src/server/session/cookie';

const claims = { userId: 'u_acme_admin', tenantId: 't_acme' };

const signed = (body: object, secret = 'k') => {
  const payload = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
};

describe('dev session cookie (P1.6-T01, P2.1-T06)', () => {
  it('a valid cookie yields the claims', () => {
    expect(decodeSession(encodeSession(claims, 's3cret'), 's3cret')).toEqual(
      claims,
    );
  });

  it('carries only userId, tenantId and iat: no roles, scope or locale', () => {
    const [payload] = encodeSession(claims, 's3cret', 1234).split('.');
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual({
      userId: 'u_acme_admin',
      tenantId: 't_acme',
      iat: 1234,
    });
  });

  it('a platform user has a null tenantId', () => {
    const platform = { userId: 'u_platform_admin', tenantId: null };
    expect(decodeSession(encodeSession(platform, 'k'), 'k')).toEqual(platform);
  });

  it('a tampered payload or signature yields null', () => {
    const value = encodeSession(claims, 's3cret');
    const [payload, sig] = value.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...claims, tenantId: 't_globex', iat: 1 }),
    ).toString('base64url');
    expect(decodeSession(`${forged}.${sig}`, 's3cret')).toBeNull();
    expect(
      decodeSession(`${payload}.${sig.slice(0, -2)}xx`, 's3cret'),
    ).toBeNull();
    expect(decodeSession(value, 'other-secret')).toBeNull();
    expect(decodeSession('garbage', 's3cret')).toBeNull();
    expect(decodeSession(`${value}.extra`, 's3cret')).toBeNull();
  });

  it('rejects a bad user id or a missing iat', () => {
    expect(
      decodeSession(
        signed({ userId: 'nobody', tenantId: 't_acme', iat: 1 }),
        'k',
      ),
    ).toBeNull();
    expect(
      decodeSession(
        signed({ userId: 'u_acme_admin', tenantId: 't_acme' }),
        'k',
      ),
    ).toBeNull();
  });

  it('drops extra fields: roles can never come from the cookie', () => {
    const cookie = signed({
      userId: 'u_acme_admin',
      tenantId: 't_acme',
      iat: 1,
      roles: ['super_admin'],
    });
    expect(decodeSession(cookie, 'k')).toEqual(claims);
  });

  it('a correctly signed cookie with an invalid tenant id yields null', () => {
    expect(
      decodeSession(encodeSession({ ...claims, tenantId: '../etc' }, 'k'), 'k'),
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
      expect(adapter.readSession(adapter.signSession(claims))).toEqual(claims);
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

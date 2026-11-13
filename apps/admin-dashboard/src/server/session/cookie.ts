// The `dev-session` cookie format (D-12): base64url(JSON payload) "." base64url(HMAC-SHA256).
// Payload (P2.1-T06): { userId, tenantId | null, iat }. Roles, locale and scope are NOT in the
// cookie: the server loads them from the database on every request (ADR-013).
// Pure functions with the secret passed in, so they are unit-testable without the dev guard.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { TENANT_ID, USER_ID, type SessionClaims } from './types';

const b64 = (data: Buffer | string) => Buffer.from(data).toString('base64url');
const mac = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest();

export function encodeSession(
  claims: SessionClaims,
  secret: string,
  now = Date.now(),
): string {
  const payload = b64(
    JSON.stringify({
      userId: claims.userId,
      tenantId: claims.tenantId,
      iat: now,
    }),
  );
  return `${payload}.${b64(mac(secret, payload))}`;
}

/** The claims in a well-formed, correctly signed cookie; otherwise null. */
export function decodeSession(
  value: string,
  secret: string,
): SessionClaims | null {
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = mac(secret, payload);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;
  try {
    const p = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as Partial<{ userId: unknown; tenantId: unknown; iat: unknown }>;
    if (typeof p.userId !== 'string' || !USER_ID.test(p.userId)) return null;
    if (typeof p.iat !== 'number' || !Number.isFinite(p.iat)) return null;
    if (p.tenantId === null) return { userId: p.userId, tenantId: null };
    if (typeof p.tenantId !== 'string' || !TENANT_ID.test(p.tenantId))
      return null;
    return { userId: p.userId, tenantId: p.tenantId };
  } catch {
    return null;
  }
}

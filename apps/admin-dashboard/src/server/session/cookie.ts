// The `dev-session` cookie format (P1.6 §4): base64url(JSON payload) "." base64url(HMAC-SHA256).
// Pure functions with the secret passed in, so they are unit-testable without the dev guard.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { TENANT_ID, USER_ID, type RequestContext } from './types';

interface Payload extends RequestContext {
  iat: number;
}

const b64 = (data: Buffer | string) => Buffer.from(data).toString('base64url');
const mac = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest();

export function encodeSession(
  ctx: RequestContext,
  secret: string,
  now = Date.now(),
): string {
  const payload = b64(JSON.stringify({ ...ctx, iat: now } satisfies Payload));
  return `${payload}.${b64(mac(secret, payload))}`;
}

/** The context in a well-formed, correctly signed cookie; otherwise null. */
export function decodeSession(
  value: string,
  secret: string,
): RequestContext | null {
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = mac(secret, payload);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;
  try {
    const p = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as Partial<Payload>;
    if (
      typeof p.tenantId !== 'string' ||
      !TENANT_ID.test(p.tenantId) ||
      typeof p.userId !== 'string' ||
      !USER_ID.test(p.userId) ||
      !Array.isArray(p.roles) ||
      !p.roles.every((r) => typeof r === 'string') ||
      typeof p.locale !== 'string'
    )
      return null;
    return {
      tenantId: p.tenantId,
      userId: p.userId,
      roles: p.roles,
      locale: p.locale,
    };
  } catch {
    return null;
  }
}

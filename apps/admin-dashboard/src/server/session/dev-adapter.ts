// Development session adapter (D-12). Refuses to load in production: nothing may import it
// statically; callers load it with `await import()` behind isDevOnly().
import { isDevOnly } from '../dev-only';
import { decodeSession, encodeSession } from './cookie';
import type { SessionClaims } from './types';

if (!isDevOnly())
  throw new Error(
    'The dev session adapter must not load in production (D-12).',
  );

/** Documented development default (`.env.local.example`); override with DEV_SESSION_SECRET. */
export const DEV_SESSION_SECRET_DEFAULT = 'dev-only-secret-change-me';

const secret = () =>
  process.env.DEV_SESSION_SECRET || DEV_SESSION_SECRET_DEFAULT;

export const signSession = (claims: SessionClaims) =>
  encodeSession(claims, secret());
export const readSession = (value: string) => decodeSession(value, secret());

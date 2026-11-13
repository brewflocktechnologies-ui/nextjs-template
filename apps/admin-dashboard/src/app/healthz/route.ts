import { isDevOnly } from '../../server/dev-only';

export const dynamic = 'force-dynamic';

/**
 * Development only (P2.1-T15): the name of the database this server uses, so the e2e global setup
 * resets the database the server actually reads, also when it reuses a running `pnpm stack`. The
 * name only, never the connection string; absent in production.
 */
function databaseHeader(): Record<string, string> {
  if (!isDevOnly()) return {};
  try {
    const name = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
    return /^[a-z0-9_]+$/.test(name) ? { 'X-Byteflock-Database': name } : {};
  } catch {
    return {};
  }
}

/** Unauthenticated liveness check; never cached. */
export function GET() {
  return new Response('ok', {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain',
      ...databaseHeader(),
    },
  });
}

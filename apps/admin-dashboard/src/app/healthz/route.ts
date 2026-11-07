export const dynamic = 'force-dynamic';

/** Unauthenticated liveness check; never cached. */
export function GET() {
  return new Response('ok', {
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' },
  });
}

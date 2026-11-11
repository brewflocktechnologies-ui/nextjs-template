import Link from 'next/link';
import type { RequestContext } from '../server/session/types';

/** Development only (D-12): who you are signed in as, and a link to switch tenants. */
export function DevBadge({ ctx }: { ctx: RequestContext }) {
  return (
    <p
      className="flex items-center gap-2 rounded-md bg-black/15 px-3 py-1 text-xs"
      data-testid="dev-badge"
    >
      <span>
        {ctx.scope === 'platform' ? 'platform' : ctx.tenantId} · {ctx.userId}
      </span>
      <Link
        href="/dev/session"
        className="underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
      >
        Switch
      </Link>
    </p>
  );
}

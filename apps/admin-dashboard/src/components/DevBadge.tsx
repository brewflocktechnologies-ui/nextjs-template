import Link from 'next/link';
import type { RequestContext } from '../server/session/types';

/**
 * Development only (D-12, P2.1-T12): who you are signed in as, and a link to switch users.
 * `platform · u_platform_admin` for a super admin, `<tenantId> · <userId> · <role>` for a tenant user.
 */
export function DevBadge({ ctx }: { ctx: RequestContext }) {
  const who =
    ctx.scope === 'platform'
      ? `platform · ${ctx.userId}`
      : `${ctx.tenantId} · ${ctx.userId} · ${ctx.roles.join(', ')}`;
  return (
    <p
      className="flex items-center gap-2 rounded-md bg-black/15 px-3 py-1 text-xs"
      data-testid="dev-badge"
    >
      <span>{who}</span>
      <Link
        href="/dev/session"
        className="underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
      >
        Switch
      </Link>
    </p>
  );
}

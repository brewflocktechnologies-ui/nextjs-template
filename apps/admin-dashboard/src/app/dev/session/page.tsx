import { notFound } from 'next/navigation';
import { Button } from '@byteflock/ui-react';
import { listDevUsers, type DevUser } from '../../../server/dev-tenants';
import { isDevOnly } from '../../../server/dev-only';
import { getOptionalRequestContext } from '../../../server/request-context';
import type { RequestContext } from '../../../server/session/types';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<DevUser['role'], string> = {
  super_admin: 'super admin',
  tenant_admin: 'admin',
  agent: 'agent',
};

function isCurrent(
  current: RequestContext | null,
  user: DevUser,
  tenantId: string | null,
): boolean {
  if (!current || current.userId !== user.userId) return false;
  return current.scope === 'platform'
    ? tenantId === null
    : current.tenantId === tenantId;
}

function UserRow({
  user,
  tenantId,
  current,
}: {
  user: DevUser;
  tenantId: string | null;
  current: RequestContext | null;
}) {
  const active = isCurrent(current, user, tenantId);
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
      <div>
        <p className="font-medium">{user.displayName}</p>
        <p className="text-sm text-muted-foreground">
          {user.userId} · {ROLE_LABEL[user.role]}
        </p>
      </div>
      <Button
        type="submit"
        name="as"
        value={tenantId ? `${user.userId}@${tenantId}` : user.userId}
        variant={active ? 'default' : 'outline'}
        aria-label={`Sign in as ${user.displayName} (${ROLE_LABEL[user.role]})`}
      >
        {active ? 'Signed in' : 'Sign in'}
      </Button>
    </li>
  );
}

/**
 * Development user switcher (D-12, P2.1-T12): every user in the database, grouped as "Platform"
 * and per tenant; one click signs the cookie. Absent from production builds (404).
 */
export default async function DevSessionPage() {
  if (!isDevOnly()) notFound();
  const current = await getOptionalRequestContext();
  const { platform, tenants } = await listDevUsers();
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Choose a user</h1>
      <p className="mb-6 text-muted-foreground">
        Development only: signs you in with a signed <code>dev-session</code>{' '}
        cookie. Roles come from the database on every request.
      </p>
      <form method="post" action="/dev/session/select" className="grid gap-6">
        <section aria-labelledby="group-platform" className="grid gap-2">
          <h2 id="group-platform" className="text-lg font-medium">
            Platform
          </h2>
          <ul className="grid gap-2">
            {platform.map((u) => (
              <UserRow
                key={u.userId}
                user={u}
                tenantId={null}
                current={current}
              />
            ))}
          </ul>
        </section>
        {tenants.map((t) => (
          <section
            key={t.tenantId}
            aria-labelledby={`group-${t.tenantId}`}
            className="grid gap-2"
            data-testid={`group-${t.tenantId}`}
          >
            <h2 id={`group-${t.tenantId}`} className="text-lg font-medium">
              {t.name}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                {t.tenantId}
                {t.widgetKey ? ` · ${t.widgetKey}` : ''}
              </span>
            </h2>
            {t.users.length ? (
              <ul className="grid gap-2">
                {t.users.map((u) => (
                  <UserRow
                    key={u.userId}
                    user={u}
                    tenantId={t.tenantId}
                    current={current}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No members.</p>
            )}
          </section>
        ))}
      </form>
    </main>
  );
}

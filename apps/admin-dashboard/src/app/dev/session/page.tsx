import { notFound } from 'next/navigation';
import { Button } from '@byteflock/ui-react';
import { isDevOnly } from '../../../server/dev-only';
import { getOptionalRequestContext } from '../../../server/request-context';
import { listDevTenants } from '../../../server/dev-tenants';

export const dynamic = 'force-dynamic';

/** Development tenant switcher (D-12). Absent from production builds. */
export default async function DevSessionPage() {
  if (!isDevOnly()) notFound();
  const current = await getOptionalRequestContext();
  const tenants = await listDevTenants();
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Choose a tenant</h1>
      <p className="mb-6 text-muted-foreground">
        Development only: signs you in as the tenant&apos;s admin with a signed{' '}
        <code>dev-session</code> cookie.
      </p>
      <form method="post" action="/dev/session/select">
        <ul className="grid gap-3">
          <li className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
            <div>
              <p className="font-medium">Super admin</p>
              <p className="text-sm text-muted-foreground">
                Platform scope · every tenant
              </p>
            </div>
            <Button
              type="submit"
              name="platform"
              value="1"
              variant={current?.scope === 'platform' ? 'default' : 'outline'}
              aria-label="Sign in as Super admin"
            >
              {current?.scope === 'platform' ? 'Signed in' : 'Sign in'}
            </Button>
          </li>
          {tenants.map((t) => (
            <li
              key={t.tenantId}
              className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4"
            >
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t.tenantId} · {t.user}
                  {t.widgetKey ? ` · ${t.widgetKey}` : ''}
                </p>
              </div>
              <Button
                type="submit"
                name="tenantId"
                value={t.tenantId}
                variant={
                  (current?.scope === 'tenant' ? current.tenantId : null) ===
                  t.tenantId
                    ? 'default'
                    : 'outline'
                }
                aria-label={`Sign in as ${t.name}`}
              >
                {(current?.scope === 'tenant' ? current.tenantId : null) ===
                t.tenantId
                  ? 'Signed in'
                  : 'Sign in'}
              </Button>
            </li>
          ))}
        </ul>
      </form>
    </main>
  );
}

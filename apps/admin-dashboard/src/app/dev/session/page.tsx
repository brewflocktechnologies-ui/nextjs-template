import { notFound } from 'next/navigation';
import { Button } from '@byteflock/ui-react';
import { isDevOnly } from '../../../server/dev-only';
import { getOptionalRequestContext } from '../../../server/request-context';
import { listLocalTenants } from '../../../server/tenants';

export const dynamic = 'force-dynamic';

/** Development tenant switcher (D-12). Absent from production builds. */
export default async function DevSessionPage() {
  if (!isDevOnly()) notFound();
  const current = await getOptionalRequestContext();
  const tenants = listLocalTenants();
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Choose a tenant</h1>
      <p className="mb-6 text-muted-foreground">
        Development only: signs you in as the tenant&apos;s admin with a signed{' '}
        <code>dev-session</code> cookie.
      </p>
      <form method="post" action="/dev/session/select">
        <ul className="grid gap-3">
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
                  current?.tenantId === t.tenantId ? 'default' : 'outline'
                }
                aria-label={`Sign in as ${t.name}`}
              >
                {current?.tenantId === t.tenantId ? 'Signed in' : 'Sign in'}
              </Button>
            </li>
          ))}
        </ul>
      </form>
    </main>
  );
}

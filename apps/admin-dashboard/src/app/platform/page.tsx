import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { listTenants } from '../../data/platform/tenants';
import { getPlatformContext } from '../../server/request-context';

export const dynamic = 'force-dynamic';

/** The super admin's tenant list (P2.1-T10). Platform scope only; tenant users get a 404. */
export default async function PlatformPage() {
  const ctx = await getPlatformContext();
  const tenants = await listTenants(ctx, { hideFixtures: true });
  return (
    <AppShell ctx={ctx} current="/platform">
      <h1 className="mb-2 text-2xl font-semibold">Tenants</h1>
      <p className="mb-6 text-muted-foreground">
        Every tenant on the platform. Open one to edit its theme, dashboard
        settings and widget. This view always uses the platform design.
      </p>
      <table className="w-full text-left text-sm" data-testid="tenant-list">
        <caption className="sr-only">Tenants</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="py-2 pr-4 font-medium">
              Tenant
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Widget key
            </th>
            <th scope="col" className="py-2 font-medium">
              Published revision
            </th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.tenantId} className="border-b">
              <th scope="row" className="py-2 pr-4 font-medium">
                <Link
                  href={`/platform/tenants/${t.tenantId}`}
                  className="text-primary underline underline-offset-4"
                >
                  {t.name}
                </Link>
                <span className="block font-normal text-muted-foreground">
                  {t.tenantId}
                </span>
              </th>
              <td className="py-2 pr-4">
                {t.widgetKey ? <code>{t.widgetKey}</code> : 'none'}
              </td>
              <td className="py-2">{t.publishedRevision ?? 'not published'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}

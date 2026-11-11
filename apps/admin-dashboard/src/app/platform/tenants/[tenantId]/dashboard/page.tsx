import { notFound } from 'next/navigation';
import { AppShell } from '../../../../../components/AppShell';
import { getTenant } from '../../../../../data/platform/tenants';
import {
  getTenantConfig,
  listSupportedLocales,
} from '../../../../../data/tenant-config';
import { getPlatformContext } from '../../../../../server/request-context';
import { TENANT_ID } from '../../../../../server/session/types';
import { DashboardSettingsForm } from '../../../../settings/dashboard/DashboardSettingsForm';
import { TenantTabs } from '../../../TenantTabs';

export const dynamic = 'force-dynamic';

/** The tenant's dashboard config for a super admin (P2.1-T10, CONFIG-05). */
export default async function PlatformTenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const ctx = await getPlatformContext();
  const tenant = TENANT_ID.test(tenantId)
    ? await getTenant(ctx, tenantId)
    : null;
  if (!tenant) notFound();
  const config = await getTenantConfig(tenantId);
  const locales = await listSupportedLocales(tenantId);
  return (
    <AppShell ctx={ctx} current="/platform">
      <h1 className="mb-1 text-2xl font-semibold">{tenant.name}</h1>
      <p className="mb-4 text-muted-foreground">{tenant.tenantId}</p>
      <TenantTabs tenantId={tenantId} current="/dashboard" />
      <DashboardSettingsForm
        initial={config}
        locales={locales.length ? locales : [config.defaults.locale]}
        apiQuery={`?tenantId=${tenantId}`}
      />
    </AppShell>
  );
}

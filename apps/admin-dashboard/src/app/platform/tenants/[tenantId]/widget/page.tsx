import { notFound } from 'next/navigation';
import { AppShell } from '../../../../../components/AppShell';
import { getTenant } from '../../../../../data/platform/tenants';
import { getWidgetSettings } from '../../../../../data/widget-config';
import { getPlatformContext } from '../../../../../server/request-context';
import { TENANT_ID } from '../../../../../server/session/types';
import { WidgetSettingsForm } from '../../../../settings/widget/WidgetSettingsForm';
import { TenantTabs } from '../../../TenantTabs';

export const dynamic = 'force-dynamic';

/** The tenant's allowed origins for a super admin (P2.1-T10, D-21). */
export default async function PlatformTenantWidgetPage({
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
  const settings = await getWidgetSettings(tenantId);
  return (
    <AppShell ctx={ctx} current="/platform">
      <h1 className="mb-1 text-2xl font-semibold">{tenant.name}</h1>
      <p className="mb-4 text-muted-foreground">{tenant.tenantId}</p>
      <TenantTabs tenantId={tenantId} current="/widget" />
      {settings ? (
        <>
          <p className="mb-6 text-muted-foreground">
            Widget key <code>{settings.widgetKey}</code> works only on the
            origins listed here (D-21).
          </p>
          <WidgetSettingsForm
            initial={settings.allowedOrigins}
            apiQuery={`?tenantId=${tenantId}`}
          />
        </>
      ) : (
        <p className="text-muted-foreground">This tenant has no widget.</p>
      )}
    </AppShell>
  );
}

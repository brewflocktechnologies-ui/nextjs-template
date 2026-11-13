import { notFound } from 'next/navigation';
import { AppShell } from '../../../../components/AppShell';
import { getTenant } from '../../../../data/platform/tenants';
import { getTenantConfig } from '../../../../data/tenant-config';
import { getWidgetSettings } from '../../../../data/widget-config';
import { TenantPreview } from '../../../../components/TenantPreview';
import { getPlatformContext } from '../../../../server/request-context';
import { TENANT_ID } from '../../../../server/session/types';
import { TenantTabs } from '../../TenantTabs';

export const dynamic = 'force-dynamic';

/** One tenant at a glance, for the super admin (P2.1-T10). */
export default async function TenantOverviewPage({
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
  const widget = await getWidgetSettings(tenantId);
  return (
    <AppShell ctx={ctx} current="/platform">
      <h1 className="mb-1 text-2xl font-semibold">{tenant.name}</h1>
      <p className="mb-4 text-muted-foreground">{tenant.tenantId}</p>
      <TenantTabs tenantId={tenantId} current="" />
      <TenantPreview tenantId={tenantId} tenantName={tenant.name} />
      <dl className="grid max-w-xl grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="font-medium">Widget key</dt>
        <dd>{tenant.widgetKey ? <code>{tenant.widgetKey}</code> : 'none'}</dd>
        <dt className="font-medium">Published revision</dt>
        <dd>{tenant.publishedRevision ?? 'not published'}</dd>
        <dt className="font-medium">Allowed origins</dt>
        <dd>
          {widget?.allowedOrigins.length
            ? widget.allowedOrigins.join(', ')
            : 'none'}
        </dd>
        <dt className="font-medium">Theme editor</dt>
        <dd>{config.modules.themeEditor ? 'on' : 'off'}</dd>
        <dt className="font-medium">Widget settings</dt>
        <dd>{config.modules.widgetSettings ? 'on' : 'off'}</dd>
        <dt className="font-medium">Default locale</dt>
        <dd>{config.defaults.locale}</dd>
      </dl>
    </AppShell>
  );
}

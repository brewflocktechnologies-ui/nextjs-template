import { AppShell } from '../../../components/AppShell';
import { getWidgetSettings } from '../../../data/widget-config';
import { can } from '../../../server/authorize';
import { getTenantContext } from '../../../server/request-context';
import { requireModule } from '../../../server/tenant-config/modules';
import { WidgetSettingsForm } from './WidgetSettingsForm';

export const dynamic = 'force-dynamic';

export default async function WidgetSettingsPage() {
  const ctx = await getTenantContext();
  await requireModule(ctx, 'widgetSettings');
  const settings = await getWidgetSettings(ctx.tenantId);
  return (
    <AppShell ctx={ctx} current="/settings/widget">
      <h1 className="mb-2 text-2xl font-semibold">Widget</h1>
      {settings ? (
        <>
          <p className="mb-6 text-muted-foreground">
            Widget key <code>{settings.widgetKey}</code> works only on the
            origins listed here (D-21). On any other site the chat stays
            unavailable.
          </p>
          <WidgetSettingsForm
            initial={settings.allowedOrigins}
            readOnly={!can(ctx, ctx.tenantId, 'widget.write')}
          />
        </>
      ) : (
        <p className="text-muted-foreground">This tenant has no widget.</p>
      )}
    </AppShell>
  );
}

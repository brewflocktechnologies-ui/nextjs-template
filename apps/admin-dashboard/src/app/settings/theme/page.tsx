import { AppShell } from '../../../components/AppShell';
import { can } from '../../../server/authorize';
import { getTenantContext } from '../../../server/request-context';
import { requireModule } from '../../../server/tenant-config/modules';
import { ThemeEditorSection } from './ThemeEditorSection';

export const dynamic = 'force-dynamic';

export default async function ThemeSettingsPage() {
  const ctx = await getTenantContext();
  await requireModule(ctx, 'themeEditor');
  return (
    <AppShell ctx={ctx} current="/settings/theme">
      <h1 className="mb-2 text-2xl font-semibold">Theme</h1>
      <p className="mb-6 text-muted-foreground">
        Edit your brand theme, preview it in the real chat widget, and publish
        it to your widget and this dashboard.
      </p>
      <ThemeEditorSection
        tenantId={ctx.tenantId}
        readOnly={!can(ctx, ctx.tenantId, 'theme.write')}
      />
    </AppShell>
  );
}

import { AppShell } from '../../../components/AppShell';
import {
  getTenantConfig,
  listSupportedLocales,
} from '../../../data/tenant-config';
import { can } from '../../../server/authorize';
import { getTenantContext } from '../../../server/request-context';
import { DashboardSettingsForm } from './DashboardSettingsForm';

export const dynamic = 'force-dynamic';

/** Tenant dashboard config editor (P2.1-T09, CONFIG-05). Tenant admins only. */
export default async function DashboardSettingsPage() {
  const ctx = await getTenantContext();
  const canWrite = can(ctx, ctx.tenantId, 'config.write');
  const config = await getTenantConfig(ctx.tenantId);
  const locales = await listSupportedLocales(ctx.tenantId);
  return (
    <AppShell ctx={ctx} current="/settings/dashboard">
      <h1 className="mb-2 text-2xl font-semibold">Dashboard</h1>
      <p className="mb-6 text-muted-foreground">
        Choose which modules your team sees and what your home page says. Text
        is shown exactly as typed.
      </p>
      {canWrite ? (
        <DashboardSettingsForm
          initial={config}
          locales={locales.length ? locales : [config.defaults.locale]}
        />
      ) : (
        <p role="status" className="text-muted-foreground">
          Only a tenant admin can change these settings.
        </p>
      )}
    </AppShell>
  );
}

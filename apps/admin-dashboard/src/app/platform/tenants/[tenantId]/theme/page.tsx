import { notFound } from 'next/navigation';
import { AppShell } from '../../../../../components/AppShell';
import { getTenant } from '../../../../../data/platform/tenants';
import { getPlatformContext } from '../../../../../server/request-context';
import { TENANT_ID } from '../../../../../server/session/types';
import { ThemeEditorSection } from '../../../../settings/theme/ThemeEditorSection';
import { TenantTabs } from '../../../TenantTabs';

export const dynamic = 'force-dynamic';

/**
 * The tenant's theme editor for a super admin (P2.1-T10): the same editor as /settings/theme, with
 * the tenant named explicitly. The dashboard chrome stays on the platform design (D-25); the live
 * preview is the real widget frame.
 */
export default async function PlatformTenantThemePage({
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
  return (
    <AppShell ctx={ctx} current="/platform">
      <h1 className="mb-1 text-2xl font-semibold">{tenant.name}</h1>
      <p className="mb-4 text-muted-foreground">{tenant.tenantId}</p>
      <TenantTabs tenantId={tenantId} current="/theme" />
      <ThemeEditorSection
        tenantId={tenantId}
        apiQuery={`?tenantId=${tenantId}`}
      />
    </AppShell>
  );
}

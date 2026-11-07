import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { validateTheme } from '@byteflock/theme';
import { AppShell } from '../../../components/AppShell';
import {
  getDraft,
  getPublishedTheme,
  listRevisions,
} from '../../../data/themes';
import { DEFAULT_THEME } from '../../../lib/default-theme';
import { qk } from '../../../lib/query/qk';
import { getServerQueryClient } from '../../../lib/query/server-query-client';
import { getRequestContext } from '../../../server/request-context';
import { localTenant } from '../../../server/tenants';
import { ThemeEditor } from './ThemeEditor';

export const dynamic = 'force-dynamic';

export default async function ThemeSettingsPage() {
  const ctx = await getRequestContext();
  const widgetKey = localTenant(ctx.tenantId)?.widgetKey ?? null;
  const draft = await getDraft(ctx.tenantId);
  const published = await getPublishedTheme(ctx.tenantId);
  const publishedTheme = published ? validateTheme(published.doc) : null;
  const initial =
    draft ?? (publishedTheme?.ok ? publishedTheme.value : DEFAULT_THEME);

  const queryClient = getServerQueryClient();
  if (widgetKey)
    await queryClient.prefetchQuery({
      queryKey: qk(ctx.tenantId, 'theme', 'revisions'),
      queryFn: () => listRevisions(ctx.tenantId),
    });

  return (
    <AppShell ctx={ctx} current="/settings/theme">
      <h1 className="mb-2 text-2xl font-semibold">Theme</h1>
      <p className="mb-6 text-muted-foreground">
        Edit your brand theme, preview it in the real chat widget, and publish
        it to your widget and this dashboard.
      </p>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ThemeEditor
          tenantId={ctx.tenantId}
          initial={initial}
          widgetKey={widgetKey}
          widgetOrigin={
            process.env.NEXT_PUBLIC_WIDGET_ORIGIN ?? 'http://localhost:4400'
          }
          dashboardOrigin={
            process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN ?? 'http://localhost:3000'
          }
        />
      </HydrationBoundary>
    </AppShell>
  );
}

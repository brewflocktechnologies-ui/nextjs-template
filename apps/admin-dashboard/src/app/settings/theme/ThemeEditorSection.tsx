// The theme editor with its server-side data, shared by the tenant page (/settings/theme) and the
// super admin's per-tenant page (/platform/tenants/[tenantId]/theme), P2.1-T10. `apiQuery` makes
// the editor's API calls name the tenant ('?tenantId=t_x'); a tenant user passes nothing.
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { validateTheme } from '@byteflock/theme';
import {
  getDraft,
  getPublishedTheme,
  listRevisions,
} from '../../../data/themes';
import { getWidgetSettings } from '../../../data/widget-config';
import { DEFAULT_THEME } from '../../../lib/default-theme';
import { qk } from '../../../lib/query/qk';
import { getServerQueryClient } from '../../../lib/query/server-query-client';
import { ThemeEditor } from './ThemeEditor';

export async function ThemeEditorSection({
  tenantId,
  apiQuery = '',
  readOnly = false,
}: {
  tenantId: string;
  apiQuery?: string;
  readOnly?: boolean;
}) {
  const widgetKey = (await getWidgetSettings(tenantId))?.widgetKey ?? null;
  const draft = await getDraft(tenantId);
  const published = await getPublishedTheme(tenantId);
  const publishedTheme = published ? validateTheme(published.doc) : null;
  const initial =
    draft ?? (publishedTheme?.ok ? publishedTheme.value : DEFAULT_THEME);

  const queryClient = getServerQueryClient();
  if (widgetKey)
    await queryClient.prefetchQuery({
      queryKey: qk(tenantId, 'theme', 'revisions'),
      queryFn: () => listRevisions(tenantId),
    });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ThemeEditor
        tenantId={tenantId}
        initial={initial}
        widgetKey={widgetKey}
        widgetOrigin={
          process.env.NEXT_PUBLIC_WIDGET_ORIGIN ?? 'http://localhost:4400'
        }
        dashboardOrigin={
          process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN ?? 'http://localhost:3000'
        }
        apiQuery={apiQuery}
        readOnly={readOnly}
      />
    </HydrationBoundary>
  );
}

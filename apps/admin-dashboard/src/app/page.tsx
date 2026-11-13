import Link from 'next/link';
import { AppShell } from '../components/AppShell';
import { AgentFilterDemo } from '../components/AgentFilterDemo';
import { getTenantConfig } from '../data/tenant-config';
import { getTenantContext } from '../server/request-context';
import { isModuleEnabled } from '../server/tenant-config/modules';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await getTenantContext();
  const config = await getTenantConfig(ctx.tenantId);
  const themeEditor = await isModuleEnabled(ctx, 'themeEditor');
  // The title and notice are tenant-written plain text (CONFIG-02): rendered as text nodes only.
  return (
    <AppShell ctx={ctx} current="/">
      <h1 className="mb-2 text-2xl font-semibold" data-testid="home-title">
        {config.home.title || 'Admin dashboard'}
      </h1>
      {config.home.notice ? (
        <p
          role="note"
          data-testid="home-notice"
          className="mb-4 rounded-md border bg-card p-3 text-sm"
        >
          {config.home.notice}
        </p>
      ) : null}
      <p className="mb-6 text-muted-foreground">
        Your dashboard uses your published theme.
        {themeEditor ? (
          <>
            {' '}
            Change it under{' '}
            <Link
              href="/settings/theme"
              className="text-primary underline underline-offset-4"
            >
              Theme
            </Link>
            .
          </>
        ) : null}
      </p>
      <section
        aria-labelledby="sample-heading"
        className="grid gap-3 rounded-lg border bg-card p-4 shadow-md"
      >
        <h2 id="sample-heading" className="text-lg font-medium">
          Conversations
        </h2>
        <p className="text-sm text-muted-foreground">
          A sample of the shared components under your theme.
        </p>
        <AgentFilterDemo />
      </section>
    </AppShell>
  );
}

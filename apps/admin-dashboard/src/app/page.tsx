import Link from 'next/link';
import { AppShell } from '../components/AppShell';
import { AgentFilterDemo } from '../components/AgentFilterDemo';
import { getTenantContext } from '../server/request-context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await getTenantContext();
  return (
    <AppShell ctx={ctx} current="/">
      <h1 className="mb-2 text-2xl font-semibold">Admin dashboard</h1>
      <p className="mb-6 text-muted-foreground">
        Your dashboard uses your published theme. Change it under{' '}
        <Link
          href="/settings/theme"
          className="text-primary underline underline-offset-4"
        >
          Theme
        </Link>
        .
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

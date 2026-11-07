import { headers } from 'next/headers';
import { ThemeStyleTag } from '@byteflock/ui-react';
import { QueryProvider } from '../lib/query/query-provider';
import { isDevOnly } from '../server/dev-only';
import { NONCE_HEADER } from '../server/proxy-allowlist';
import { getOptionalRequestContext } from '../server/request-context';
import { tenantThemeView } from '../server/tenant-theme';
import './global.css';

export const metadata = {
  title: 'Byteflock admin',
  description: 'Byteflock tenant admin dashboard',
};

// Every request renders for its own tenant; nothing is cached (P1.6-T05).
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  const ctx = await getOptionalRequestContext();
  const theme = await tenantThemeView(ctx);
  return (
    <html
      lang={ctx?.locale ?? 'en'}
      data-appearance={theme.appearance}
      data-density={theme.density}
    >
      <head>
        <ThemeStyleTag
          vars={theme.vars}
          darkVars={theme.darkVars}
          nonce={nonce}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {theme.invalid && isDevOnly() ? (
          <div
            role="alert"
            className="bg-destructive px-4 py-2 text-sm text-white"
          >
            Development: this tenant&apos;s stored theme failed validation; the
            platform default theme is shown.
          </div>
        ) : null}
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

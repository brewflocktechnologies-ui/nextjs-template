import Link from 'next/link';
import type { ReactNode } from 'react';
import { isDevOnly } from '../server/dev-only';
import type { RequestContext } from '../server/session/types';
import { tenantThemeView } from '../server/tenant-theme';
import { DevBadge } from './DevBadge';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/settings/theme', label: 'Theme' },
  { href: '/settings/widget', label: 'Widget' },
];

/** Dashboard chrome: tenant brand, navigation and, in development, the session badge. */
export async function AppShell({
  ctx,
  current,
  children,
}: {
  ctx: RequestContext;
  current: string;
  children: ReactNode;
}) {
  const theme = await tenantThemeView(ctx);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-primary px-6 py-3 text-primary-foreground shadow-md">
        <div className="flex items-center gap-3">
          {theme.logoUrl ? (
            <img src={theme.logoUrl} alt="" className="size-8 rounded-md" />
          ) : null}
          <span className="text-lg font-semibold" data-testid="brand-name">
            {theme.brandName}
          </span>
        </div>
        <nav aria-label="Main">
          <ul className="flex gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={item.href === current ? 'page' : undefined}
                  className="rounded-md px-3 py-1.5 text-sm font-medium outline-none hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-primary-foreground aria-[current=page]:underline aria-[current=page]:underline-offset-4"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {isDevOnly() ? <DevBadge ctx={ctx} /> : null}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">{children}</main>
    </div>
  );
}

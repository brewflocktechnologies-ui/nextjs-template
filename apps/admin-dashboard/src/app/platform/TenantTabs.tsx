import Link from 'next/link';

const TABS = [
  { slug: '', label: 'Overview' },
  { slug: '/theme', label: 'Theme' },
  { slug: '/dashboard', label: 'Dashboard' },
  { slug: '/widget', label: 'Widget' },
];

/** Sub-navigation for one tenant's platform pages (P2.1-T10). */
export function TenantTabs({
  tenantId,
  current,
}: {
  tenantId: string;
  current: '' | '/theme' | '/dashboard' | '/widget';
}) {
  return (
    <nav aria-label="Tenant" className="mb-6">
      <ul className="flex flex-wrap gap-1 border-b">
        {TABS.map((tab) => (
          <li key={tab.slug}>
            <Link
              href={`/platform/tenants/${tenantId}${tab.slug}`}
              aria-current={tab.slug === current ? 'page' : undefined}
              className="inline-block rounded-t-md px-3 py-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:border-b-2 aria-[current=page]:border-primary"
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

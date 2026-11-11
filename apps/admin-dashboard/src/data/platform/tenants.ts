// Platform-only data access (P2.1-T07, ADR-013): functions that span tenants. They take a
// PlatformContext first (lint rule `data-access-tenant-first` accepts exactly that under
// src/data/platform) and call authorize() themselves, so no caller can forget it.
import 'server-only';
import { authorize } from '../../server/authorize';
import { withScope } from '../../server/db';
import type { PlatformContext } from '../../server/session/types';

export interface TenantSummary {
  tenantId: string;
  name: string;
  widgetKey: string | null;
  publishedRevision: number | null;
}

/**
 * Tenants that exist only as development failure fixtures (the seed's `t_broken`, whose stored
 * theme is a deliberately bad document). The platform tenant list hides them so it shows the real
 * tenants; their pages stay reachable by URL.
 */
const FAILURE_FIXTURE_TENANTS: readonly string[] = ['t_broken'];

/**
 * Every tenant, ordered by id. Platform scope only (action `tenants.list`). With
 * `hideFixtures`, the development failure-fixture tenants are left out (the `/platform` list).
 */
export async function listTenants(
  ctx: PlatformContext,
  options: { hideFixtures?: boolean } = {},
): Promise<TenantSummary[]> {
  authorize(ctx, null, 'tenants.list');
  const rows = await withScope({ scope: 'platform' }, (db) =>
    db.rows<{
      tenant_id: string;
      name: string;
      widget_key: string | null;
      published_revision: number | null;
    }>(
      `SELECT t.tenant_id, t.name, t.published_revision,
              (SELECT w.widget_key FROM widget_keys w
                WHERE w.tenant_id = t.tenant_id ORDER BY w.widget_key LIMIT 1) AS widget_key
         FROM tenants t
        ORDER BY t.tenant_id`,
    ),
  );
  return rows
    .filter(
      (r) =>
        !options.hideFixtures || !FAILURE_FIXTURE_TENANTS.includes(r.tenant_id),
    )
    .map((r) => ({
      tenantId: r.tenant_id,
      name: r.name,
      widgetKey: r.widget_key,
      publishedRevision: r.published_revision,
    }));
}

/** One tenant, or null when it does not exist. Platform scope only. */
export async function getTenant(
  ctx: PlatformContext,
  tenantId: string,
): Promise<TenantSummary | null> {
  return (await listTenants(ctx)).find((t) => t.tenantId === tenantId) ?? null;
}

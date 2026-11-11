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

/** Every tenant, ordered by id. Platform scope only (action `tenants.list`). */
export async function listTenants(
  ctx: PlatformContext,
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
  return rows.map((r) => ({
    tenantId: r.tenant_id,
    name: r.name,
    widgetKey: r.widget_key,
    publishedRevision: r.published_revision,
  }));
}

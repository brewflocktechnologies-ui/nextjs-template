import {
  TenantConfigError,
  saveTenantConfig,
} from '../../../data/tenant-config';
import { json, readBody, requireTenantAction } from '../../../server/api';

export const dynamic = 'force-dynamic';

/** Saves the tenant's dashboard config after the guard (CONFIG-05: tenant admins, own tenant). */
export async function POST(request: Request) {
  const ctx = await requireTenantAction('config.write');
  if (ctx instanceof Response) return ctx;
  const body = (await readBody(request)) as { config?: unknown } | null;
  try {
    return json({
      config: await saveTenantConfig(ctx.tenantId, body?.config, ctx.userId),
    });
  } catch (e) {
    if (e instanceof TenantConfigError)
      return json({ error: e.message, problems: e.problems }, 422);
    throw e;
  }
}

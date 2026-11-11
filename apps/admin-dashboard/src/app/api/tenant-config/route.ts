import {
  TenantConfigError,
  saveTenantConfig,
} from '../../../data/tenant-config';
import { json, readBody, requireTenantTarget } from '../../../server/api';

export const dynamic = 'force-dynamic';

/** Saves the tenant's dashboard config after the guard (CONFIG-05: tenant admins, own tenant). */
export async function POST(request: Request) {
  const target = await requireTenantTarget(request, 'config.write');
  if (target instanceof Response) return target;
  const body = (await readBody(request)) as { config?: unknown } | null;
  try {
    return json({
      config: await saveTenantConfig(
        target.tenantId,
        body?.config,
        target.userId,
      ),
    });
  } catch (e) {
    if (e instanceof TenantConfigError)
      return json({ error: e.message, problems: e.problems }, 422);
    throw e;
  }
}

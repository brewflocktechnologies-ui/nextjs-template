import { ThemeError, rollback } from '../../../../data/themes';
import { json, readBody, requireTenantTarget } from '../../../../server/api';

export const dynamic = 'force-dynamic';

/** Points the widget at an earlier published revision (THEME-09). */
export async function POST(request: Request) {
  const target = await requireTenantTarget(request, 'theme.publish');
  if (target instanceof Response) return target;
  const body = (await readBody(request)) as { revision?: unknown } | null;
  try {
    await rollback(target.tenantId, Number(body?.revision));
    return json({ ok: true, revision: Number(body?.revision) });
  } catch (e) {
    if (e instanceof ThemeError) return json({ error: e.message }, 404);
    throw e;
  }
}

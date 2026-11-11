import { ThemeError, saveDraft } from '../../../../data/themes';
import { json, readBody, requireTenantTarget } from '../../../../server/api';

export const dynamic = 'force-dynamic';

/** Saves the tenant's draft after full validation (contrast violations are allowed in drafts). */
export async function POST(request: Request) {
  const target = await requireTenantTarget(request, 'theme.write');
  if (target instanceof Response) return target;
  const body = (await readBody(request)) as { theme?: unknown } | null;
  try {
    await saveDraft(target.tenantId, body?.theme, target.userId);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ThemeError) return json({ error: e.message }, 422);
    throw e;
  }
}

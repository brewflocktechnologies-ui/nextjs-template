import { ThemeError, saveDraft } from '../../../../data/themes';
import { json, readBody, requireContext } from '../../../../server/api';

export const dynamic = 'force-dynamic';

/** Saves the tenant's draft after full validation (contrast violations are allowed in drafts). */
export async function POST(request: Request) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  const body = (await readBody(request)) as { theme?: unknown } | null;
  try {
    await saveDraft(ctx.tenantId, body?.theme);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ThemeError) return json({ error: e.message }, 422);
    throw e;
  }
}

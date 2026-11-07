import { ThemeError, publish } from '../../../../data/themes';
import { json, requireContext } from '../../../../server/api';

export const dynamic = 'force-dynamic';

/** Publishes the saved draft. The server re-checks schema and contrast (P1.6-AC06). */
export async function POST() {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  try {
    return json(await publish(ctx.tenantId));
  } catch (e) {
    if (e instanceof ThemeError)
      return json(
        { error: e.message, code: e.code, violations: e.violations },
        e.code === 'POLICY' || e.code === 'NO_DRAFT' ? 422 : 409,
      );
    throw e;
  }
}

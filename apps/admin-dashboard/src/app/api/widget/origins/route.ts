import {
  WidgetConfigError,
  saveAllowedOrigins,
} from '../../../../data/widget-config';
import { json, readBody, requireTenantTarget } from '../../../../server/api';

export const dynamic = 'force-dynamic';

/** Saves the widget key's allowed origins (D-21); the server re-validates every entry. */
export async function POST(request: Request) {
  const target = await requireTenantTarget(request, 'widget.write');
  if (target instanceof Response) return target;
  const body = (await readBody(request)) as { origins?: unknown } | null;
  const origins = Array.isArray(body?.origins)
    ? body.origins.map((o) => String(o).trim()).filter(Boolean)
    : [];
  try {
    return json(await saveAllowedOrigins(target.tenantId, origins));
  } catch (e) {
    if (e instanceof WidgetConfigError)
      return json({ error: e.message, problems: e.problems }, 422);
    throw e;
  }
}

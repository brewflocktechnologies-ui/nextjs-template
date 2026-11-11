import { listRevisions } from '../../../../data/themes';
import { json, requireTenantAction } from '../../../../server/api';

export const dynamic = 'force-dynamic';

/** Published revisions, newest first, and the one the widget uses. */
export async function GET() {
  const ctx = await requireTenantAction('theme.read');
  if (ctx instanceof Response) return ctx;
  return json(await listRevisions(ctx.tenantId));
}

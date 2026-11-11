import { listRevisions } from '../../../../data/themes';
import { json, requireTenantTarget } from '../../../../server/api';

export const dynamic = 'force-dynamic';

/** Published revisions, newest first, and the one the widget uses. */
export async function GET(request: Request) {
  const target = await requireTenantTarget(request, 'theme.read');
  if (target instanceof Response) return target;
  return json(await listRevisions(target.tenantId));
}

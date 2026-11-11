import { resolveTheme, validateTheme } from '@byteflock/theme';
import { json, readBody, requireTenantTarget } from '../../../../server/api';

export const dynamic = 'force-dynamic';

/**
 * Validates, then resolves, a theme for the editor's preview (P1.6-T07). The browser never resolves
 * raw input. The elevation shadow is left out: theme.preview accepts colours, lengths, numbers and
 * font stacks only (BRIDGE-02), and the frame does not use elevation.
 */
export async function POST(request: Request) {
  const target = await requireTenantTarget(request, 'theme.read');
  if (target instanceof Response) return target;
  const body = (await readBody(request)) as {
    theme?: unknown;
    appearance?: unknown;
  } | null;
  const appearance = body?.appearance === 'dark' ? 'dark' : 'light';
  const result = validateTheme(body?.theme);
  if (!result.ok) return json({ errors: result.errors }, 422);
  const { '--sem-elevation-surface': _shadow, ...vars } = resolveTheme(
    result.value,
    { appearance },
  );
  return json({ vars });
}

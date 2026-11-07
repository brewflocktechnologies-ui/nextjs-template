import { isResolvedKey, type ResolvedVars } from '@byteflock/theme/guard';

export interface ThemeStyleTagProps {
  /** Resolved variables from resolveTheme(). Raw theme documents are never accepted. */
  vars: ResolvedVars;
  /** CSP nonce for the <style> element. */
  nonce?: string;
  /** `brand` emits only the colour roles; `all` (default) emits every resolved variable. */
  scope?: 'all' | 'brand';
  /**
   * Dark variables for a tenant whose appearance is `system` (D-20): emitted under
   * `prefers-color-scheme: dark` for `html[data-appearance="system"]`.
   */
  darkVars?: ResolvedVars;
}

// Values come from the resolver (colours already validated as #rrggbb, everything else from token
// scales). This is a second line of defence: anything that could leave the declaration is refused.
const UNSAFE_VALUE = /[;{}<>\\]|\/\*|url\(|expression\(/i;

function declarations(vars: ResolvedVars, scope: 'all' | 'brand'): string {
  const out: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    if (!isResolvedKey(key))
      throw new Error(
        `ThemeStyleTag: refusing unknown variable ${JSON.stringify(key)}`,
      );
    if (typeof value !== 'string' || UNSAFE_VALUE.test(value))
      throw new Error(`ThemeStyleTag: refusing unsafe value for ${key}`);
    if (scope === 'brand' && !key.startsWith('--sem-color-')) continue;
    out.push(`${key}:${value}`);
  }
  return out.join(';');
}

/**
 * Builds the `:root:root{…}` rule, plus the system-dark block when darkVars is given. Throws on a
 * key outside RESOLVED_KEYS or an unsafe value. `:root:root` outranks the token defaults, including
 * `[data-appearance="dark"]`, whatever the stylesheet order.
 */
export function themeCss(
  vars: ResolvedVars,
  scope: 'all' | 'brand' = 'all',
  darkVars?: ResolvedVars,
): string {
  const base = `:root:root{${declarations(vars, scope)}}`;
  return darkVars
    ? `${base}@media (prefers-color-scheme: dark){:root:root[data-appearance="system"]{${declarations(darkVars, scope)}}}`
    : base;
}

/**
 * Renders one `<style nonce>` with the tenant's resolved variables on `:root` (P1.4-T03).
 * It throws rather than render anything it cannot vouch for; callers fall back to defaults at the
 * data layer, never at render (P1.6).
 */
export function ThemeStyleTag({
  vars,
  nonce,
  scope = 'all',
  darkVars,
}: ThemeStyleTagProps) {
  return (
    <style nonce={nonce} data-byteflock-theme="">
      {themeCss(vars, scope, darkVars)}
    </style>
  );
}

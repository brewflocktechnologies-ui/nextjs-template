import { isResolvedKey, type ResolvedVars } from '@byteflock/theme/guard';

export interface ThemeStyleTagProps {
  /** Resolved variables from resolveTheme(). Raw theme documents are never accepted. */
  vars: ResolvedVars;
  /** CSP nonce for the <style> element. */
  nonce?: string;
  /** `brand` emits only the colour roles; `all` (default) emits every resolved variable. */
  scope?: 'all' | 'brand';
}

// Values come from the resolver (colours already validated as #rrggbb, everything else from token
// scales). This is a second line of defence: anything that could leave the declaration is refused.
const UNSAFE_VALUE = /[;{}<>\\]|\/\*|url\(|expression\(/i;

/** Builds the `:root:root{…}` rule. Throws on a key outside RESOLVED_KEYS or an unsafe value. */
export function themeCss(
  vars: ResolvedVars,
  scope: 'all' | 'brand' = 'all',
): string {
  const declarations: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    if (!isResolvedKey(key))
      throw new Error(
        `ThemeStyleTag: refusing unknown variable ${JSON.stringify(key)}`,
      );
    if (typeof value !== 'string' || UNSAFE_VALUE.test(value))
      throw new Error(`ThemeStyleTag: refusing unsafe value for ${key}`);
    if (scope === 'brand' && !key.startsWith('--sem-color-')) continue;
    declarations.push(`${key}:${value}`);
  }
  // `:root:root` outranks the token defaults, including `[data-appearance="dark"]`, whatever the
  // stylesheet order.
  return `:root:root{${declarations.join(';')}}`;
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
}: ThemeStyleTagProps) {
  return (
    <style nonce={nonce} data-byteflock-theme="">
      {themeCss(vars, scope)}
    </style>
  );
}

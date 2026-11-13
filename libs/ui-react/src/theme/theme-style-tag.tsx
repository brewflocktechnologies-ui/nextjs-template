import { isResolvedKey, type ResolvedVars } from '@byteflock/theme/guard';

export interface ThemeStyleTagProps {
  /** Resolved variables from resolveTheme(). Raw theme documents are never accepted. */
  vars: ResolvedVars;
  /** CSP nonce for the <style> element. */
  nonce?: string;
  /**
   * Where the variables apply. Default `:root:root` (the whole page). A scoped preview passes
   * `[data-tenant-preview="t_acme"]` (P2.1-T11); nothing else is accepted.
   */
  selector?: string;
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

const ROOT_SELECTOR = ':root:root';
// The only scoped selector: one tenant's preview container. Anything else is refused.
const PREVIEW_SELECTOR = /^\[data-tenant-preview="t_[a-z0-9_]{2,40}"\]$/;

function checkSelector(selector: string): string {
  if (selector !== ROOT_SELECTOR && !PREVIEW_SELECTOR.test(selector))
    throw new Error(
      `ThemeStyleTag: refusing selector ${JSON.stringify(selector)}`,
    );
  return selector;
}

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
  selector: string = ROOT_SELECTOR,
): string {
  const target = checkSelector(selector);
  const base = `${target}{${declarations(vars, scope)}}`;
  if (!darkVars) return base;
  // On the page, `system` appearance is the html attribute; in a scoped preview it follows the OS.
  const dark =
    target === ROOT_SELECTOR ? `${target}[data-appearance="system"]` : target;
  return `${base}@media (prefers-color-scheme: dark){${dark}{${declarations(darkVars, scope)}}}`;
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
  selector,
}: ThemeStyleTagProps) {
  return (
    <style nonce={nonce} data-byteflock-theme="">
      {themeCss(vars, scope, darkVars, selector)}
    </style>
  );
}

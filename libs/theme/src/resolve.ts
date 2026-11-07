// Resolver (THEME-03): validated theme → --sem-* variables for one appearance.
//
// Pure and deterministic. Colours pass through (already validated as #rrggbb); every other value
// comes from the design-token scale tables, never from tenant input. No schema library is imported,
// so the widget frame can use this entry (`@byteflock/theme/resolve`) without TypeBox.
// `system` appearance is resolved by the consumer (dashboard CSS or the frame's matchMedia).
import { SCALES } from '@byteflock/design-tokens';
import { colorVar, type ResolvedVars } from './resolved-keys';
import { COLOR_ROLES } from './schema/constants';
import type { Theme } from './schema/theme.v1';

export type Appearance = 'light' | 'dark';

export function resolveTheme(
  theme: Theme,
  options: { appearance: Appearance },
): ResolvedVars {
  const colors = theme.color[options.appearance];
  const vars = {} as Record<string, string>;
  for (const role of COLOR_ROLES) vars[colorVar(role)] = colors[role];
  vars['--sem-radius-md'] = SCALES.radius[theme.shape.radius];
  vars['--sem-elevation-surface'] = SCALES.elevation[theme.elevation];
  vars['--sem-density-factor'] = String(SCALES.density[theme.density]);
  vars['--sem-type-scale'] = String(SCALES.typeScale[theme.typography.scale]);
  vars['--sem-font-family-sans'] =
    SCALES.fontStacks[theme.typography.fontFamily];
  return vars as ResolvedVars;
}

/** The appearance a theme asks for, given whether the viewer prefers dark (for `system`). */
export function appearanceOf(theme: Theme, prefersDark: boolean): Appearance {
  return theme.appearance.mode === 'system'
    ? prefersDark
      ? 'dark'
      : 'light'
    : theme.appearance.mode;
}

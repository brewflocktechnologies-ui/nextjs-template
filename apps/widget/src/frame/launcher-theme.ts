// The allow-listed launcher theme posted in `ready` (BRIDGE-02): colours and enums only, no text.
import type { Appearance } from '@byteflock/theme/resolve';
import type { Theme } from '@byteflock/theme/guard';
import type { LauncherTheme } from '../bridge/protocol';

export function launcherThemeOf(
  theme: Theme,
  appearance: Appearance,
): LauncherTheme {
  const c = theme.color[appearance];
  return {
    bg: c.primary,
    fg: c.onPrimary,
    radius: theme.shape.radius,
    icon: theme.launcher.icon,
    position: theme.launcher.position,
    shape: theme.launcher.shape,
  };
}

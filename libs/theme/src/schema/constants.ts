// Contract constants shared by the schema, the resolver and the guard (THEME-02). No TypeBox import:
// the frame-safe entries (`/guard`, `/resolve`) depend on this file and must not pull in the schema
// library.

export const SCHEMA_VERSION = 1 as const;
export const SCHEMA_ID = 'https://schemas.byteflock.dev/theme/v1.json';

export const APPEARANCE_MODES = ['light', 'dark', 'system'] as const;
export const FONT_FAMILIES = [
  'system',
  'inter',
  'roboto',
  'source-sans',
  'noto-sans',
] as const;
export const TYPE_SCALES = ['sm', 'md', 'lg'] as const;
export const RADII = ['none', 'sm', 'md', 'lg', 'full'] as const;
export const ELEVATIONS = ['flat', 'low', 'medium'] as const;
export const DENSITIES = ['compact', 'comfortable', 'spacious'] as const;
export const LAUNCHER_POSITIONS = ['bottom-right', 'bottom-left'] as const;
export const LAUNCHER_SHAPES = ['circle', 'pill'] as const;
export const LAUNCHER_ICONS = ['chat', 'help', 'message'] as const;

/** The 13 colour roles every appearance must define (THEME-02). */
export const COLOR_ROLES = [
  'primary',
  'onPrimary',
  'surface',
  'onSurface',
  'surfaceVariant',
  'onSurfaceVariant',
  'outline',
  'accent',
  'onAccent',
  'success',
  'warning',
  'danger',
  'focusRing',
] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

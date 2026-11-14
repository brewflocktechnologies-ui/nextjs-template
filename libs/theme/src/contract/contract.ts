// Platform semantic contract v1 as data (SPECS/contracts/platform-semantic-v1.md, SEM-01…09).
// The single source for the generator, the artifact guard and the emitted JSON copy
// (schema/platform-semantic.v1.json). Changing it needs a CONTRACT-CHANGE: trailer.

export const CONTRACT_ID = 'platform-semantic-v1';

export type ContractType =
  | 'color'
  | 'dimension'
  | 'number'
  | 'fontFamily'
  | 'fontWeight'
  | 'shadow'
  | 'duration'
  | 'cubicBezier';

export interface ContractToken {
  /** Contract path, the key of a manifest's semanticMap. */
  path: string;
  /** The CSS custom property shared components read. */
  variable: `--sem-${string}`;
  type: ContractType;
  /** SEM-02 (true) or SEM-03 (false, platform fallback). */
  required: boolean;
  /** True when the value may differ between light and dark (SEM-04 rule 3). */
  perMode: boolean;
  /** Colours: alpha below 1 allowed. Opaque otherwise (SEM-05). */
  alpha?: boolean;
  /** Inclusive range for numbers, or for dimensions in px (rem counted as 16 px). */
  range?: readonly [number, number];
}

const color = (
  name: string,
  required: boolean,
  alpha = false,
): ContractToken => ({
  path: `color.${name}`,
  variable: `--sem-color-${name}`,
  type: 'color',
  required,
  perMode: true,
  ...(alpha ? { alpha } : {}),
});

const REQUIRED_COLORS = [
  'primary',
  'on-primary',
  'surface',
  'on-surface',
  'surface-variant',
  'on-surface-variant',
  'outline',
  'accent',
  'on-accent',
  'success',
  'warning',
  'danger',
  'focus-ring',
] as const;

const optional = (
  path: string,
  variable: `--sem-${string}`,
  type: ContractType,
  extra: Partial<ContractToken> = {},
): ContractToken => ({
  path,
  variable,
  type,
  required: false,
  perMode: false,
  ...extra,
});

export const CONTRACT: readonly ContractToken[] = [
  // SEM-02: required, exactly what shared components read today.
  ...REQUIRED_COLORS.map((c) => color(c, true)),
  {
    path: 'font.family.sans',
    variable: '--sem-font-family-sans',
    type: 'fontFamily',
    required: true,
    perMode: false,
  },
  {
    path: 'radius.md',
    variable: '--sem-radius-md',
    type: 'dimension',
    required: true,
    perMode: false,
    range: [0, 48],
  },
  {
    path: 'elevation.surface',
    variable: '--sem-elevation-surface',
    type: 'shadow',
    required: true,
    perMode: true,
  },
  {
    path: 'scale.density',
    variable: '--sem-density-factor',
    type: 'number',
    required: true,
    perMode: false,
    range: [0.75, 1.5],
  },
  {
    path: 'scale.type',
    variable: '--sem-type-scale',
    type: 'number',
    required: true,
    perMode: false,
    range: [0.875, 1.25],
  },
  // SEM-03: optional, with a platform fallback.
  color('surface-container', false),
  color('outline-variant', false),
  color('on-primary-container', false),
  color('backdrop', false, true),
  ...['xs', 'sm', 'md', 'lg', 'xl', '2xl'].map((s) =>
    optional(`font.size.${s}`, `--sem-font-size-${s}` as const, 'dimension', {
      range: [8, 96],
    }),
  ),
  ...['regular', 'medium', 'semibold', 'bold'].map((w) =>
    optional(
      `font.weight.${w}`,
      `--sem-font-weight-${w}` as const,
      'fontWeight',
    ),
  ),
  ...['tight', 'normal'].map((h) =>
    optional(`line-height.${h}`, `--sem-line-height-${h}` as const, 'number', {
      range: [0.8, 3],
    }),
  ),
  ...['none', 'sm', 'lg', 'full'].map((r) =>
    optional(`radius.${r}`, `--sem-radius-${r}` as const, 'dimension', {
      range: [0, 9999],
    }),
  ),
  ...['flat', 'low', 'medium'].map((e) =>
    optional(`elevation.${e}`, `--sem-elevation-${e}` as const, 'shadow', {
      perMode: true,
    }),
  ),
  ...['fast', 'normal', 'slow'].map((d) =>
    optional(
      `motion.duration.${d}`,
      `--sem-motion-duration-${d}` as const,
      'duration',
    ),
  ),
  optional(
    'motion.easing.standard',
    '--sem-motion-easing-standard',
    'cubicBezier',
  ),
  ...Array.from({ length: 13 }, (_, i) =>
    optional(`space.${i}`, `--sem-space-${i}` as const, 'dimension', {
      range: [0, 256],
    }),
  ),
];

export const CONTRACT_BY_PATH: ReadonlyMap<string, ContractToken> = new Map(
  CONTRACT.map((t) => [t.path, t]),
);

/** Contrast pairs (THEME-06, D-20) on contract paths, checked in both modes. */
export const CONTRAST_PAIRS: readonly {
  foreground: string;
  background: string;
  required: number;
}[] = [
  {
    foreground: 'color.on-primary',
    background: 'color.primary',
    required: 4.5,
  },
  {
    foreground: 'color.on-surface',
    background: 'color.surface',
    required: 4.5,
  },
  {
    foreground: 'color.on-surface-variant',
    background: 'color.surface-variant',
    required: 4.5,
  },
  { foreground: 'color.on-accent', background: 'color.accent', required: 4.5 },
  { foreground: 'color.focus-ring', background: 'color.surface', required: 3 },
  { foreground: 'color.outline', background: 'color.surface', required: 3 },
  { foreground: 'color.primary', background: 'color.surface', required: 3 },
  { foreground: 'color.danger', background: 'color.surface', required: 3 },
  { foreground: 'color.success', background: 'color.surface', required: 3 },
  { foreground: 'color.warning', background: 'color.surface', required: 3 },
  {
    foreground: 'color.on-surface',
    background: 'color.surface-variant',
    required: 4.5,
  },
];

/** SEM-08: extension variable names. */
export const EXTENSION_NAME = /^[a-z][a-z0-9-]{0,40}$/;
export const extensionVariable = (themeId: string, name: string) =>
  `--ext-${themeId}-${name}` as const;

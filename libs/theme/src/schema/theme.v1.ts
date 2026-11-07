// Tenant theme contract v1: the single authored source (ADR-004, SPECS/contracts/theme-contract-v1.md).
//
// TypeBox values ARE JSON Schema 2020-12 documents. scripts/emit-schema.mjs writes
// libs/theme/schema/theme.v1.json from this file; that JSON is the contract the Java backend validates.
// The TypeScript type comes from Static<>, so there is no separate .d.ts to drift.
//
// Node runs the emitter on this file directly (type stripping), so its one relative import carries
// the .ts extension.
import {
  Type,
  type Static,
  type TLiteral,
  type TUnion,
} from '@sinclair/typebox';

import {
  APPEARANCE_MODES,
  COLOR_ROLES,
  DENSITIES,
  ELEVATIONS,
  FONT_FAMILIES,
  LAUNCHER_ICONS,
  LAUNCHER_POSITIONS,
  LAUNCHER_SHAPES,
  RADII,
  SCHEMA_ID,
  SCHEMA_VERSION,
  TYPE_SCALES,
  type ColorRole,
} from './constants.ts';

// Re-exported so consumers keep one import path for the contract.
export * from './constants.ts';

const closed = { additionalProperties: false } as const;
/** A union of string literals; Static<> gives the union of the values. */
const literalUnion = <T extends string>(
  values: readonly T[],
): TUnion<TLiteral<T>[]> => Type.Union(values.map((v) => Type.Literal(v)));

/** Lower-case #rrggbb only. The editor normalises case before validating (THEME-01 rule 3). */
export const Color = Type.String({ pattern: '^#[0-9a-f]{6}$' });

export const ColorRoles = Type.Object(
  Object.fromEntries(COLOR_ROLES.map((role) => [role, Color])) as Record<
    ColorRole,
    typeof Color
  >,
  closed,
);

export const ThemeV1 = Type.Object(
  {
    schemaVersion: Type.Literal(SCHEMA_VERSION),
    revision: Type.Integer({ minimum: 1 }),
    appearance: Type.Object({ mode: literalUnion(APPEARANCE_MODES) }, closed),
    color: Type.Object({ light: ColorRoles, dark: ColorRoles }, closed),
    typography: Type.Object(
      {
        fontFamily: literalUnion(FONT_FAMILIES),
        scale: literalUnion(TYPE_SCALES),
      },
      closed,
    ),
    shape: Type.Object({ radius: literalUnion(RADII) }, closed),
    elevation: literalUnion(ELEVATIONS),
    density: literalUnion(DENSITIES),
    brand: Type.Object(
      {
        // 1–60 characters, no C0 control characters and no DEL.
        name: Type.String({
          minLength: 1,
          maxLength: 60,
          pattern: '^[^\\u0000-\\u001f\\u007f]+$',
        }),
        logoAssetId: Type.Optional(
          Type.String({ pattern: '^[a-z0-9]{8,32}$' }),
        ),
      },
      closed,
    ),
    launcher: Type.Object(
      {
        position: literalUnion(LAUNCHER_POSITIONS),
        shape: literalUnion(LAUNCHER_SHAPES),
        icon: literalUnion(LAUNCHER_ICONS),
      },
      closed,
    ),
  },
  {
    ...closed,
    $id: SCHEMA_ID,
    title: 'Byteflock tenant theme',
    description: 'Tenant theme contract, schema version 1.',
  },
);

export type Theme = Static<typeof ThemeV1>;
export type ColorSet = Static<typeof ColorRoles>;

# Contract: platform semantic contract v1 (SEM)

Source: D-30, ADR-014 (Proposed), `docs/architecture/design-tokens/design-token-contract-proposal.md`. Normative once ADR-014 is accepted and P2.4 is `Accepted`; until then this is the agreed draft P2.4 implements against.

Every theme (design system) satisfies this contract. It names the **outputs** shared components read, as CSS custom properties with the existing `--sem-*` names (ADR-003). How a theme names its own tokens is its own business; its manifest maps contract paths to them (SEM-07). A machine-readable copy lives at `libs/theme/schema/platform-semantic.v1.json` (P2.4); a change to either needs a `CONTRACT-CHANGE:` trailer.

## SEM-01 Principles

1. Required tokens are exactly those shared components read (measured 2026-11-14, `docs/architecture/design-tokens/design-token-repository-audit.md` §8) plus the status colours under contrast policy.
2. Optional tokens have a platform fallback from the `platform-default` theme.
3. Every emitted value is serialised by the platform from a canonical typed value. No source string is copied into output (ADR-014).
4. Nothing is converted silently: every conversion that changes information is a report entry (SEM-05).

## SEM-02 Required tokens

| Contract path              | Variable                         | DTCG type    | Per mode | Constraint                                                                                         |
| -------------------------- | -------------------------------- | ------------ | -------- | -------------------------------------------------------------------------------------------------- |
| `color.primary`            | `--sem-color-primary`            | `color`      | yes      | opaque; ≥ 3:1 against `color.surface`                                                              |
| `color.on-primary`         | `--sem-color-on-primary`         | `color`      | yes      | opaque; ≥ 4.5:1 against `color.primary`                                                            |
| `color.surface`            | `--sem-color-surface`            | `color`      | yes      | opaque                                                                                             |
| `color.on-surface`         | `--sem-color-on-surface`         | `color`      | yes      | opaque; ≥ 4.5:1 against `color.surface` and `color.surface-variant`                                |
| `color.surface-variant`    | `--sem-color-surface-variant`    | `color`      | yes      | opaque                                                                                             |
| `color.on-surface-variant` | `--sem-color-on-surface-variant` | `color`      | yes      | opaque; ≥ 4.5:1 against `color.surface-variant`                                                    |
| `color.outline`            | `--sem-color-outline`            | `color`      | yes      | opaque; ≥ 3:1 against `color.surface`                                                              |
| `color.accent`             | `--sem-color-accent`             | `color`      | yes      | opaque                                                                                             |
| `color.on-accent`          | `--sem-color-on-accent`          | `color`      | yes      | opaque; ≥ 4.5:1 against `color.accent`                                                             |
| `color.success`            | `--sem-color-success`            | `color`      | yes      | opaque; ≥ 3:1 against `color.surface`                                                              |
| `color.warning`            | `--sem-color-warning`            | `color`      | yes      | opaque; ≥ 3:1 against `color.surface`                                                              |
| `color.danger`             | `--sem-color-danger`             | `color`      | yes      | opaque; ≥ 3:1 against `color.surface`                                                              |
| `color.focus-ring`         | `--sem-color-focus-ring`         | `color`      | yes      | opaque; ≥ 3:1 against `color.surface`                                                              |
| `font.family.sans`         | `--sem-font-family-sans`         | `fontFamily` | no       | families in the platform font registry (SEM-06); the generator appends the platform fallback stack |
| `radius.md`                | `--sem-radius-md`                | `dimension`  | no       | `px` or `rem`; 0–48 px                                                                             |
| `elevation.surface`        | `--sem-elevation-surface`        | `shadow`     | yes      | 1–3 layers; shadow colours may have alpha                                                          |
| `scale.density`            | `--sem-density-factor`           | `number`     | no       | 0.75–1.5                                                                                           |
| `scale.type`               | `--sem-type-scale`               | `number`     | no       | 0.875–1.25                                                                                         |

These are the 18 keys of `RESOLVED_KEYS` today, so existing consumers keep working. Contrast constraints are THEME-06 and D-20, unchanged, checked in both modes.

## SEM-03 Optional tokens

All other variables in `libs/design-tokens/src/generated/css/semantic.css`: `color.surface-container`, `color.outline-variant`, `color.on-primary-container`, `color.backdrop` (alpha allowed), `font.size.*`, `font.weight.*`, `line-height.*`, `radius.none|sm|lg|full`, `elevation.flat|low|medium`, `motion.duration.*`, `motion.easing.standard`, `space.0…12`. Same types and units as `platform-default`. A theme that maps one is validated as for a required token; one it does not map takes the platform value.

## SEM-04 Modes

1. Required modes: `light` and `dark`. A theme without a dark design maps both modes to the same files, explicitly. The generator never copies one mode into the other.
2. A mode is an ordered list of source files; a later file overlays (overrides) paths of an earlier one, as Design Token Kit exports a base `tokens.json` and overlay files such as `tokens.dark.json`. Every override is listed in the report.
3. Tokens marked "no" in SEM-02 must resolve to the same value in both modes; otherwise G4 fails.
4. `appearance` (`light | dark | system`) belongs to the tenant's assignment, not to the theme.

## SEM-05 Values

| Type         | Accepted source forms                                                                            | Emitted                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `color`      | DTCG 2025.10 colour object in any of its 14 colour spaces (`hex` fallback honoured); hex strings | `#rrggbb` (or `#rrggbbaa` where alpha is allowed). A colour not exactly representable in sRGB is converted, reported with original and result, and needs approval (D-30) |
| `dimension`  | `{ value, unit }`, unit `px` or `rem`                                                            | same value and unit; units are never converted                                                                                                                           |
| `number`     | number                                                                                           | number                                                                                                                                                                   |
| `fontFamily` | string or array of strings                                                                       | quoted family names from the registry, then the platform fallback stack                                                                                                  |
| `shadow`     | DTCG shadow object or array (`color`, `offsetX`, `offsetY`, `blur`, `spread`, `inset`)           | one layer per entry, typed parts only                                                                                                                                    |
| references   | `{path}` and `$ref` JSON Pointer, within the theme's own sources                                 | resolved per mode; cycles and missing targets fail G3                                                                                                                    |

Alpha below 1 where SEM-02 requires opaque fails G5; it is never flattened.

## SEM-06 Fonts

`fontFamily` values must name families in the platform font registry (`libs/theme/src/fonts.ts` today). The platform adds families by self-hosting their files and registering them (D-30). Unknown families fail G5 with the family named. Font URLs are never accepted.

## SEM-07 Manifest mapping

Each theme's `theme.manifest.json` maps every required contract path (and any optional one it supplies) to one of its own token paths (`semanticMap`). The manifest schema is `libs/theme/schema/theme-manifest.v1.json` (P2.4).

## SEM-08 Extensions

1. Optional theme-specific tokens outside the contract use the theme's own namespace: `--ext-<themeId>-<name>`, `<name>` matching `^[a-z][a-z0-9-]{0,40}$`.
2. An extension never uses `--sem-`, never shadows a contract variable and never collides with another (G6).
3. Shared components (`libs/ui-react`, `libs/chat-widget`) never read `--ext-*` (lint rule, P2.10). Only explicitly opted-in, tested surfaces may, with a fallback.
4. Extension values follow SEM-05; unsupported types are reported, not emitted.
5. Removing or renaming an extension is a major theme version.

## SEM-09 Compatibility

| Change                   | Contract version                                 | Effect on themes                                           |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------------------- |
| New optional token       | minor                                            | none; fallback applies                                     |
| Optional → required      | minor, after one theme release with a G5 warning | themes without it fail G5 from that minor                  |
| Constraint tightened     | minor                                            | themes re-verified; failing versions cannot be re-approved |
| Token removed or renamed | major                                            | migration; all themes regenerated                          |

Deprecated tokens carry `$deprecated` in the machine-readable contract and are still emitted until the next major.

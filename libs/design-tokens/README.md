# @byteflock/design-tokens

Framework-neutral design tokens (ADR-003). Every component in the dashboard and the widget frame binds only to the `--sem-*` variables produced here.

## Layers

| Layer                                                     | Source                            | Emitted as CSS?                                        |
| --------------------------------------------------------- | --------------------------------- | ------------------------------------------------------ |
| Primitives (palette, space, radius, type, shadow, motion) | `tokens/primitives/*.tokens.json` | No. Private; never referenced by components or tenants |
| Semantic (`--sem-<category>-<role>[-<state>]`)            | `tokens/semantic/*.tokens.json`   | Yes                                                    |
| Scale sets (density, type scale)                          | `tokens/sets/*.tokens.json`       | Yes, as `--sem-density-factor` and `--sem-type-scale`  |

Sources are DTCG 2025.10 and use only `$value`, `$type`, `$description`, `$deprecated` and `$extensions`. Dimensions and durations use the object form, for example `{ "value": 8, "unit": "px" }`.

## Outputs

Committed in `src/generated/` (D-23) and never edited by hand:

| File               | Use                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `css/semantic.css` | Light values on `:root`; dark under `[data-appearance="dark"]`; `[data-density]` and `[data-type-scale]` blocks |
| `ts/tokens.ts`     | `SEMANTIC_VARIABLE_NAMES`, `SEMANTIC_DEFAULTS_LIGHT`, `SEMANTIC_DEFAULTS_DARK`, `SCALES`                        |
| `json/*.json`      | The same values as JSON fixtures                                                                                |

Import them as `@byteflock/design-tokens` (TypeScript), `@byteflock/design-tokens/css/semantic.css` and `@byteflock/design-tokens/scales`.

Appearance is driven by the `data-appearance` attribute, set by the consumer: the dashboard during SSR, the frame at bootstrap. `system` mode is resolved by the consumer, so the CSS contains no `prefers-color-scheme` query.

## Changing a token

1. Edit the source under `tokens/`.
2. Run `pnpm nx run @byteflock/design-tokens:build`.
3. Commit the source and `src/generated/` together. `pnpm verify` runs `build:check`, which fails when they disagree.

Adding a semantic colour role that tenants may set also needs a theme contract change in `libs/theme` (P1.3).

## Looking at the tokens

Open `preview/index.html` in a browser, straight from disk. It shows every colour role and the radius, elevation, density and type-scale values. Toggles switch light and dark, density and type scale.

## Tests

`pnpm nx test @byteflock/design-tokens` checks that the build is deterministic, that no primitive names leak into the CSS, that every theme colour role exists in both appearances, that the scale tables cover the theme contract's enums, and that the sources stay within the DTCG subset with every alias resolving.

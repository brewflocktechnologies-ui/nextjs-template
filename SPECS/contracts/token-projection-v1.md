# Contract: design-token projection to theme v1 (PROJ)

Source: P2.3. This is **layer B** of the design-token import. It reads the token inventory produced by layer A (`contracts/token-extraction-v1.md`, P2.2) and fills a `theme.v1` theme (`contracts/theme-contract-v1.md`) in the theme editor. It adds no field to the theme and changes nothing in it.

**Principle: lossless extraction, explicit lossy projection.** `theme.v1` holds 13 opaque colour roles in two appearances and a few named presets, so projection must drop and convert things. Every drop and conversion is listed, with its source token, and approved by the user according to its severity. Nothing is lost silently. The inventory itself is never changed by projection.

## PROJ-01 Inputs

1. The token inventory and reports from layer A.
2. The **base theme**: the theme currently in the editor. It supplies every value projection does not set.
3. The user's answers from earlier steps (theme choice, role mapping, approvals).

Projection is a pure function of these three. The same inputs give the same theme.

## PROJ-02 Where it runs

The projection logic lives in `libs/theme`, exported from its own entry `@byteflock/theme/import`, so the widget frame never loads it and the dashboard loads it only on the theme pages. It runs in the browser. Only the resulting theme reaches the server, through the existing draft and publish routes, which validate again.

## PROJ-03 Steps

The editor's import flow runs these steps in order. Each step can be cancelled; cancelling at any step leaves the form unchanged.

| Step | What the user sees                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| 1    | Extraction summary from layer A: files and classes, token counts, errors and warnings, bundle download      |
| 2    | Theme choice: which source theme becomes `light` and which becomes `dark` (PROJ-04)                         |
| 3    | Role mapping: which token becomes each of the 13 colour roles (PROJ-05)                                     |
| 4    | Presets taken from tokens (PROJ-06)                                                                         |
| 5    | Projection report: every conversion and drop, by severity, with approvals where required (PROJ-07, PROJ-08) |
| 6    | Apply to the form, or cancel                                                                                |

Steps with nothing to decide are shown as a one-line summary and need no click, so a file that follows the convention (PROJ-05 rule 1) needs one click: Apply. This is one click more than the single-file baseline, which fills the form as soon as the file is picked; the Apply step is deliberate, so the user sees the report before the form changes.

## PROJ-04 Choosing light and dark

Layer A finds themes and keeps their original identifiers; layer B decides which one fills `color.light` and which fills `color.dark`.

**Evidence, strongest first:**

| Level | Evidence                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Tool metadata names the mode `light` or `dark` (or a recognised equivalent)                                                           |
| 2     | Colour values: the background-like token (the one mapped, or likely to map, to `surface`) is dark in one theme and light in the other |
| 3     | Group names: `light`, `dark`, `night`, `day` and similar                                                                              |
| 4     | File and folder names: `dark.json`, `light/`                                                                                          |

Names (levels 3 and 4) are hints only.

Level 2 runs before role mapping (step 3), so it uses the **likely** `surface` token: the best `surface` suggestion by the synonym table (PROJ-05 rule 2) in each theme. If the user later maps `surface` to a different token and that token's lightness contradicts the light and dark choice, step 3 says so and offers to go back to step 2.

**Confidence:**

- **Confident:** level 1 names both modes; or every available signal from levels 2 to 4 agrees.
- **Ask the user:** any two signals disagree (for example a theme named `dark` whose background is white); two themes exist but nothing says which is dark; or there are more than two themes.
- **No themes:** the shared tokens are offered for one appearance, chosen by the same evidence; the other appearance keeps the base theme's values.
- **One theme:** assigned to the appearance its evidence suggests, asking if unclear; the other appearance keeps the base theme.
- **More than two themes:** the user picks the light and dark sources; the rest are listed as not projected.

The step always shows the decision and its reason ("dark: from Figma metadata", "dark: background lightness, confirmed by you").

## PROJ-05 Role mapping

Each of the 13 `ColorRoles` gets a token from the chosen theme (or `shared`), or stays with the base theme.

1. **Exact convention, no question.** A token whose `themePath` (EXTRACT-09) is `color.<role>` in the chosen theme maps directly, with the role in camelCase or kebab-case. This covers both a single tree with `color.light.<role>` and `color.dark.<role>` (the theme segment is removed by `themePath`) and separate theme files holding `color.<role>`.
2. **Suggestions otherwise,** using, in order: a synonym table of common names (`brand`, `bg`, `background`, `surface`, `text`, `fg`, `border`, `error`, `positive` and so on, kept in `libs/theme` and grown from real exports); `on-X` / `X` pairs found by name; and contrast between candidate pairs as a tiebreaker. Each suggestion shows its confidence and reason.
3. **Namespace tags rank, they do not filter.** Between equally good name matches, `semantic` beats `unknown`, which beats `primitive`. A primitive with a strong name match (a `background` token holding a raw value) is still suggested. **Component tokens are never suggested automatically** (a component colour is not a global role); the user may still pick one by hand.
4. **The user confirms** every mapping that is not an exact convention match. They can change any suggestion or leave a role unset.
5. **Unset roles** keep the base theme's value. The report lists them.
6. The value used is the token's **resolved value in the chosen theme context**. A token with an error status (EXTRACT-14) cannot be mapped.

## PROJ-06 Presets and other token types

| Theme field                                                                 | Projected from                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shape.radius`                                                              | A string token naming a preset; or a dimension token chosen by the user, snapped to the nearest radius preset                                                                                                                    |
| `typography.fontFamily`                                                     | A `fontFamily` token whose first family matches one of the five curated fonts, by a case-insensitive name table kept in `libs/theme` (for example `Source Sans 3` and `Source Sans Pro` → `source-sans`, `system-ui` → `system`) |
| `typography.scale`, `elevation`, `density`, `appearance.mode`, `launcher.*` | A string token naming a preset                                                                                                                                                                                                   |
| `brand.name`                                                                | A string token                                                                                                                                                                                                                   |
| `brand.logoAssetId`                                                         | Always from the base theme; a token file cannot name an uploaded asset                                                                                                                                                           |

Every other token (spacing, typography composites, shadows, motion, breakpoints, component tokens, other colours) is listed as **not projected**, grouped by namespace and type, with counts.

## PROJ-07 Blocking rules

Projection blocks (the Apply button stays disabled) only when:

1. a token chosen in step 3 or 4 has an error status in the inventory;
2. a conflict affecting a chosen token is unresolved;
3. a reference used by a chosen token resolves against the wrong theme;
4. the candidate theme fails `validateTheme`;
5. an approval required by PROJ-08 is missing.

Errors in tokens projection does not use are shown as warnings in step 5, not blockers. Contrast (THEME-06) is not a projection error: the editor shows violations as it does for typed values, and publish stays blocked until they are fixed.

## PROJ-08 Lossy conversions and approvals

| Conversion                                                    | Severity | Approval                   |
| ------------------------------------------------------------- | -------- | -------------------------- |
| Colour already `#rrggbb` or exact sRGB                        | none     | —                          |
| Colour with alpha < 1: alpha dropped                          | warning  | Required, per role         |
| Colour outside sRGB with a `hex` fallback: fallback used      | info     | —                          |
| Colour outside sRGB without a fallback: converted and clamped | warning  | Required, per role         |
| Dimension snapped to a radius preset                          | info     | —                          |
| Font family not in the curated list                           | info     | — (field keeps base value) |
| Role left unset (base value kept)                             | info     | —                          |
| Theme beyond light and dark not projected                     | info     | —                          |
| Token types and namespaces not projected                      | info     | —                          |

Approvals are one checkbox per warning group in step 5, listing the affected roles with original and projected values side by side. Approving changes only the projection; the inventory and bundle keep the original values.

## PROJ-09 Output

The output is one candidate `theme.v1` document: projected values over the base theme. It passes `validateTheme` before the Apply button is enabled. Applying replaces the editor state only; saving and publishing stay separate actions. The projection report stays visible after applying until the user leaves the page or imports again.

## PROJ-10 Fixtures

`libs/theme/fixtures/projection/` holds cases that start from an inventory fixture (EXTRACT-16) plus scripted user answers, with the expected candidate theme or blocking reasons. At minimum: the convention case (no questions); themes chosen by metadata; a mismatch that must ask; unnamed modes decided by colour and confirmed; three themes; synonym mapping; an `on-X` pair; a component colour that must not be suggested; an alpha colour needing approval; a dimension radius; an unknown font; an error in an unused token (warning only); an error in a used token (blocks).

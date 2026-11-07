# Contract: tenant theme v1 (THEME)

Source: ARCH-001 §7, §8, Appendix B (ADR-003, ADR-004). Authored in P1.3; consumed by P1.4, P1.5, P1.6. The single source of truth after P1.3 is `libs/theme/src/schema/theme.v1.ts`; this document is its specification and must not drift from it (CI compares the emitted JSON Schema with the committed one; a reviewer compares both with this table on contract changes).

## THEME-01 Grammar rules

1. Typed, enumerated values only. No free-text CSS anywhere.
2. `additionalProperties: false` on every object, at every level.
3. Colours match `^#[0-9a-f]{6}$`; the editor normalises to lower case before validation; the validator does not accept upper case.
4. Fonts are curated identifiers, never URLs.
5. `schemaVersion` is a const integer; `revision` is a monotonic integer assigned by the publish step.
6. Strings are bounded; `brand.name` rejects control characters (`\u0000-\u001f`, `\u007f`).
7. Contrast rules are **policy**, enforced at publish time and shown in the editor, not encoded in the schema.

## THEME-02 Field list

| Path                    | Type / grammar                                                    | Required | Tenant-editable (Q-002 default) |
| ----------------------- | ----------------------------------------------------------------- | -------- | ------------------------------- |
| `schemaVersion`         | const `1`                                                         | yes      | no                              |
| `revision`              | integer ≥ 1                                                       | yes      | system                          |
| `appearance.mode`       | `'light' \| 'dark' \| 'system'`                                   | yes      | yes                             |
| `color.light`           | `ColorRoles`                                                      | yes      | yes                             |
| `color.dark`            | `ColorRoles`                                                      | yes      | yes                             |
| `typography.fontFamily` | `'system' \| 'inter' \| 'roboto' \| 'source-sans' \| 'noto-sans'` | yes      | yes                             |
| `typography.scale`      | `'sm' \| 'md' \| 'lg'`                                            | yes      | yes                             |
| `shape.radius`          | `'none' \| 'sm' \| 'md' \| 'lg' \| 'full'`                        | yes      | yes                             |
| `elevation`             | `'flat' \| 'low' \| 'medium'`                                     | yes      | yes                             |
| `density`               | `'compact' \| 'comfortable' \| 'spacious'`                        | yes      | yes                             |
| `brand.name`            | string, 1–60 chars, no control chars                              | yes      | yes                             |
| `brand.logoAssetId`     | `^[a-z0-9]{8,32}$`                                                | optional | yes                             |
| `launcher.position`     | `'bottom-right' \| 'bottom-left'`                                 | yes      | yes                             |
| `launcher.shape`        | `'circle' \| 'pill'`                                              | yes      | yes                             |
| `launcher.icon`         | `'chat' \| 'help' \| 'message'`                                   | yes      | yes                             |

`ColorRoles` is an object with exactly these required keys, each a colour: `primary`, `onPrimary`, `surface`, `onSurface`, `surfaceVariant`, `onSurfaceVariant`, `outline`, `accent`, `onAccent`, `success`, `warning`, `danger`, `focusRing`.

## THEME-03 Resolver

`resolveTheme(theme: Theme, options: { appearance: 'light' | 'dark' }): ResolvedVars` where `ResolvedVars = Record<`--sem-${string}`, string>`.

- Colours pass through unchanged (already validated).
- Enums map to numeric or token values taken from `@acme/design-tokens` (for example `shape.radius: 'md'` → `--sem-radius-md` value `8px`; `density` → the spacing scale multiplier; `typography.scale` → the type scale set).
- `fontFamily` maps to a fixed font-stack string from a table in `libs/theme/src/fonts.ts` (for example `inter` → `"Inter", system-ui, sans-serif`). The stack string is a constant from code, never derived from input.
- The resolver emits **only** keys from the published list `libs/theme/src/resolved-keys.ts`. A unit test asserts the emitted key set equals that list for every valid fixture.
- The resolver never emits `url(`, `expression(`, `;`, `}`, `{`, `<`, `>`, `\n`, or `\r` in any value (unit test over all fixtures and a property-based test over random valid themes).
- Resolution is pure and deterministic; snapshot tests cover every valid fixture in both appearances.

`appearance: 'system'` is resolved by the **consumer** (dashboard emits both blocks under `prefers-color-scheme`; the frame listens to `matchMedia`), never by the resolver.

## THEME-04 Shape guard (frame)

`isSupportedTheme(doc: unknown): doc is Theme` in `libs/theme/src/guard.ts`: checks `schemaVersion ∈ {1}` (and `N-1` when it exists), that `color.light`/`color.dark` are objects whose values match the colour regex, and that every enum field holds a listed value. No JSON Schema validator ships to the frame; the guard is hand-written, ≤ 2 KB minified, and tested against the same fixtures as the full validator (it must accept every valid fixture and reject every malicious fixture; it may accept some _invalid_ fixtures that only violate bounds or extra-key rules, and the test records which).

## THEME-05 Validation placement

| Where                              | What                                                          | Library                                                       |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| Dashboard editor (client)          | Full schema + contrast                                        | TypeBox compiled validator (or Ajv 2020 in the fallback case) |
| Publish step (server stub in P1.6) | Full schema + contrast + policy (tenant-editable fields only) | same                                                          |
| Dashboard SSR                      | Full schema before `resolveTheme()`                           | same                                                          |
| Frame                              | `isSupportedTheme` shape guard                                | hand-written                                                  |

## THEME-06 Publish-time policy (contrast)

WCAG 2.2 AA (≥ 4.5:1) for the pairs (`onPrimary`,`primary`), (`onSurface`,`surface`), (`onSurfaceVariant`,`surfaceVariant`), (`onAccent`,`accent`) in **both** colour sets; `focusRing` against `surface` ≥ 3:1. Implemented in `libs/theme/src/policy.ts` as `checkContrastPolicy(theme): PolicyViolation[]`. The editor shows violations live; publish refuses when the list is non-empty.

Because the tenant theme also styles the agent dashboard (Q-013, D-20), the policy additionally requires, in **both** colour sets:

- `outline` against `surface` ≥ 3:1 (WCAG 1.4.11 non-text contrast for borders and inputs);
- `primary` against `surface` ≥ 3:1 (primary buttons and links as UI components);
- `danger`, `success`, `warning` against `surface` ≥ 3:1 (status icons and borders);
- `onSurface` against `surfaceVariant` ≥ 4.5:1 (text on panels and table rows).

The dashboard must not render body text in `danger`, `success` or `warning`; those colours are for icons, borders and badges with their own `on*`-style text colour.

## THEME-07 Migrations

`migrate(doc: unknown): Theme` in `libs/theme/src/migrate.ts` upgrades `schemaVersion N-1 → N`. In Phase 1 there is only v1, so `migrate` validates and returns, but the function, its test harness and the `fixtures/migrated/` folder exist so that v2 has a place to land. Publish refuses unsupported versions with a specific error code.

## THEME-08 Fixtures

`libs/theme/fixtures/`:

| Folder       | Contents                                                                                                                                                                                                | Expected outcome                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `valid/`     | `acme-light.json`, `globex-dark.json`, `initech-compact.json` (the tenant trio from `validation/tenant-fixtures.md`), `minimal.json`, `all-enums-max.json`                                              | validate, resolve, snapshot                                     |
| `invalid/`   | missing required role, upper-case colour, out-of-range revision, unknown font id, 61-char brand name, `revision: 0`, extra key at root, extra key in `color.light`                                      | rejected by validator with a path-bearing error                 |
| `malicious/` | colour `#fff;}body{display:none`, `url(javascript:…)` in colour, `expression(alert(1))`, newline in `brand.name`, 10 000-char string, `__proto__` key, `constructor.prototype` key, nested extra object | rejected **before** resolution; `isSupportedTheme` also rejects |
| `migrated/`  | placeholder `v1-from-v1.json`                                                                                                                                                                           | `migrate` returns an equal document                             |

Every fixture file is used by tests; a test enumerates the folders and fails if a file is not covered.

## THEME-09 Lifecycle

Draft (dashboard, in-memory/local in Phase 1) → Preview (real frame at `/v1/frame/?mode=preview&key=…`, accepts `theme.preview` only from the dashboard origin) → Validate (schema + policy) → Publish (`revision = previous + 1`; write immutable `/v1/themes/<tenantId>/<revision>.json`; then update `/v1/config/<widgetKey>.json` pointer) → Rollback (pointer to an earlier revision). Order matters: the theme document must exist before the pointer moves.

## THEME-10 Versioning

`schemaVersion` bumps only on breaking changes. The frame accepts `N` and `N-1`. Publish migrates stored drafts. The dashboard refuses to publish an unsupported version. Changes to `libs/theme/schema/theme.v1.json` require the `CONTRACT-CHANGE:` PR trailer and a migration note (ARCH-001 §15.3).

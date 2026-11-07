# @byteflock/theme

The tenant theme contract, version 1 (ADR-004, `SPECS/contracts/theme-contract-v1.md`). It is a framework-neutral library: no React, Lit or Next.js.

## What is in it

| Export                                                        | Use                                                                                                                   | Where it runs                       |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `ThemeV1`, `Theme`, enum arrays (`FONT_FAMILIES`, `RADII`, …) | The contract, authored in TypeBox in `src/schema/theme.v1.ts`                                                         | Everywhere                          |
| `validateTheme(doc)`                                          | Full schema validation with JSON-pointer error paths. Uses TypeBox's `Value` API, so no code generation and no `eval` | Dashboard editor, publish step, SSR |
| `validateAndResolve(doc, { appearance })`                     | Validate, then resolve; untrusted input never reaches the resolver                                                    | Dashboard                           |
| `resolveTheme(theme, { appearance })`                         | Theme → the 18 `--sem-*` variables in `RESOLVED_KEYS`, from token scales                                              | Dashboard and frame                 |
| `isSupportedTheme(doc)`                                       | Small hand-written shape guard                                                                                        | Frame                               |
| `checkContrastPolicy(theme)`                                  | WCAG 2.2 contrast rules, including the dashboard pairs (D-20)                                                         | Editor and publish step             |
| `migrate(doc)`                                                | Upgrades stored themes to the current schema version                                                                  | Publish step                        |

The widget frame imports only the TypeBox-free entries:

```ts
import { isSupportedTheme, RESOLVED_KEYS } from '@byteflock/theme/guard'; // 970 B gzip
import { resolveTheme } from '@byteflock/theme/resolve'; // 889 B gzip
```

A bundle test fails if either entry pulls in a schema library or the guard exceeds 4 KB gzip.

## The JSON Schema

`schema/theme.v1.json` is emitted from the TypeBox source and committed. It is the contract the Java backend validates. Never edit it by hand:

```bash
pnpm nx run @byteflock/theme:build         # re-emit after changing src/schema/theme.v1.ts
pnpm nx run @byteflock/theme:build:check   # fails when the committed schema is stale (in pnpm verify)
```

A pull request that changes the schema needs a `CONTRACT-CHANGE:` line and a note under `docs/contract-changes/`.

## Fixtures

`fixtures/` holds the cases every test runs against: `valid/` (the three local tenants, `minimal`, `all-enums-max`), `invalid/`, `malicious/` and `migrated/`. A test fails if a fixture file is added without being covered. The local tenants are described in `validation/tenants.json`; `tools/scripts/generate-widget-fixtures.mjs` turns them into the widget's config and theme documents.

## Changing the contract

1. Change `src/schema/theme.v1.ts` (and `src/schema/constants.ts` for enums).
2. Run the build to re-emit the schema; update fixtures and the resolver if the change adds a field.
3. A breaking change bumps `SCHEMA_VERSION`, adds a step to `migrate.ts` and keeps the previous version in `SUPPORTED_SCHEMA_VERSIONS` (THEME-10).
4. Write the contract-change note.

## Tests

`pnpm nx test @byteflock/theme` (76 tests): TypeBox and Ajv 2020 agree on every fixture; malicious input is rejected before resolution; resolver key set, value safety and snapshots; a property test over random valid themes; guard behaviour, including its documented leniencies; contrast ratios; migrations; tenant-table consistency; frame bundle sizes.

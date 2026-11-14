# Design-token repository audit

|              |                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Status       | Draft for product-owner review (Stage A of the design-token architecture brief)                 |
| Date         | 2026-11-14                                                                                      |
| Branch       | `feat/p2.2-token-import` at `5e19f45`, clean apart from the owner's own uncommitted edits       |
| Method       | Read-only inspection of files, `pnpm nx show projects`, installed `package.json` versions, grep |
| Not modified | No source code, configuration or dependency was changed for this audit                          |

Every finding names its file. "Verified" means read in the code or configuration; "Unverified" means stated in documents but not exercised (no browser run, no CI run) for this audit.

## 1. Workspace

| Item            | Value                                                                  | Evidence                                   |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| Repository root | `C:\CODE\nextjs-template` (git root and Nx root)                       | `git rev-parse`, `nx.json`                 |
| Workspace       | pnpm workspace, packages `apps/*`, `libs/*`                            | `pnpm-workspace.yaml`                      |
| Supply chain    | 7-day minimum release age; install scripts denied                      | `pnpm-workspace.yaml`, ADR-011             |
| Nx plugins      | js/typescript, next, eslint, playwright, jest, vite, vitest, storybook | `nx.json`                                  |
| Targets         | Inferred by plugins; no `project.json` files                           | `AGENTS.md`, `nx show project`             |
| Project graph   | Committed and checked (`pnpm policy:check`)                            | `tools/scripts/policy/expected-graph.json` |

### Projects

| Project                          | Path                       | Role in theming                                                                                 |
| -------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| `@byteflock/design-tokens`       | `libs/design-tokens`       | Platform DTCG source and Style Dictionary build of `--sem-*` defaults                           |
| `@byteflock/theme`               | `libs/theme`               | `theme.v1` contract, validator, contrast policy, resolver, frame guard, single-file DTCG import |
| `@byteflock/ui-react`            | `libs/ui-react`            | React components; generates the shared Tailwind v4 bridge                                       |
| `@byteflock/chat-widget`         | `libs/chat-widget`         | Lit components and `ThemeController`                                                            |
| `@byteflock/admin-dashboard`     | `apps/admin-dashboard`     | Next.js dashboard: theme editor, SSR theme, Postgres access                                     |
| `@byteflock/widget`              | `apps/widget`              | Lit frame on its own origin; static config and theme documents                                  |
| `@byteflock/widget-playground`   | `apps/widget-playground`   | Host-page fixtures and widget Playwright/visual tests                                           |
| `@byteflock/admin-dashboard-e2e` | `apps/admin-dashboard-e2e` | Dashboard Playwright, including visual snapshots                                                |

## 2. Installed versions (verified)

| Tool                         | Version                                                        | Source                            |
| ---------------------------- | -------------------------------------------------------------- | --------------------------------- |
| Node                         | 24.20.0                                                        | `node -v`                         |
| pnpm                         | 11.28.10                                                       | `pnpm -v`, `packageManager`       |
| Nx and `@nx/*`               | 24.0.0                                                         | root `package.json`, resolved     |
| TypeScript                   | 6.0.3                                                          | resolved                          |
| Tailwind CSS                 | 4.3.3; `@tailwindcss/postcss` 4.3.3, `@tailwindcss/vite` 4.3.3 | root devDependencies              |
| Next.js                      | 16.4.3 (`~16.4.3`)                                             | resolved                          |
| Lit                          | `^3.3.3` (exact resolved version not read)                     | `apps/widget`, `libs/chat-widget` |
| Storybook                    | 10.6.5 (react-vite, web-components-vite)                       | root                              |
| Style Dictionary             | 5.7.1 (exact pin)                                              | `libs/design-tokens/package.json` |
| TypeBox                      | 0.34.52                                                        | `libs/theme/package.json`         |
| Design Token Kit (CLI, Core) | **Not installed**; not referenced anywhere                     | grep of every `package.json`      |
| Other DTCG libraries         | None (no Terrazzo, Tokens Studio packages)                     | grep                              |

No Tailwind v3 configuration exists: there is no `tailwind.config.*` in the repository (`git ls-files`). The only PostCSS file is `apps/admin-dashboard/postcss.config.mjs`.

## 3. Token source and build (verified)

| Item                               | Finding                                                                                                                                                                                                           | File                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Canonical source                   | DTCG JSON for the platform default only: `primitives/` (colour, motion, radius, shadow, space, typography), `semantic/` (light, dark, elevation, motion, shape, space, typography), `sets/` (density, type-scale) | `libs/design-tokens/tokens/**`         |
| Build                              | Style Dictionary 5, DTCG subset (`$value`, `$type`, `$description`, `$deprecated`, `$extensions`; no Resolver module)                                                                                             | `style-dictionary.config.mjs`, ADR-003 |
| Outputs (committed, stale-checked) | `css/semantic.css` (58 distinct `--sem-*` variables; light on `:root`, dark on `:root[data-appearance="dark"]`), `json/semantic.light.json`, `json/semantic.dark.json`, `json/scales.json`, `ts/tokens.ts`        | `libs/design-tokens/src/generated/**`  |
| Naming                             | `--sem-<category>-<role>[-<state>]`; primitives are private; components bind only to `--sem-*`                                                                                                                    | ADR-003                                |
| Component tokens                   | Deferred: none exist                                                                                                                                                                                              | ADR-003                                |

## 4. Tenant theme model (verified)

| Item         | Finding                                                                                                                                                                                                                     | File                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Contract     | `theme.v1` (TypeBox → JSON Schema 2020-12): 13 colour roles × light/dark, plus enumerated presets (font id, type scale, radius, elevation, density, launcher), brand name, logo asset id                                    | `libs/theme/src/schema/theme.v1.ts`, `SPECS/contracts/theme-contract-v1.md` THEME-02 |
| Grammar      | Typed, enumerated values only; no free-text CSS; `additionalProperties: false`; colours `^#[0-9a-f]{6}$`                                                                                                                    | THEME-01, ADR-004                                                                    |
| Resolver     | `resolveTheme(theme, {appearance})` emits only the 18 allow-listed keys in `RESOLVED_KEYS` (13 colours, `--sem-radius-md`, `--sem-elevation-surface`, `--sem-density-factor`, `--sem-type-scale`, `--sem-font-family-sans`) | `libs/theme/src/resolve.ts`, `resolved-keys.ts`                                      |
| Policy       | WCAG contrast pairs checked at publish (THEME-06, D-20)                                                                                                                                                                     | `libs/theme/src/policy.ts`                                                           |
| Frame guard  | Hand-written shape guard (no schema library in the frame)                                                                                                                                                                   | `libs/theme/src/guard.ts`, THEME-04                                                  |
| Import       | Single-file DTCG → `theme.v1` (convention `color.light.<role>`), validated                                                                                                                                                  | `libs/theme/src/import-dtcg.ts` (commit `8f8905b`)                                   |
| Import specs | P2.2 (extraction) and P2.3 (projection) specified; P2.2 approved, implementation reverted on request                                                                                                                        | `SPECS/phases/P2.2-*.md`, `P2.3-*.md`                                                |

## 5. Tailwind CSS v4 usage (verified)

| Item                       | Finding                                                                                                                                                                                                                                                                                     | File                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Entry                      | `@import 'tailwindcss'`, then `@byteflock/design-tokens/css/semantic.css`, then `@byteflock/ui-react/shadcn-bridge.css`; `@source` lines for `libs/ui-react/src` and the app                                                                                                                | `apps/admin-dashboard/src/app/global.css`                                                                           |
| Shared mapping             | One generated `@theme inline` block mapping utilities to shadcn variables, which map to `--sem-*`: colours, `--radius-*` from `--sem-radius-md`, `--font-sans`, `--shadow-md`, `--spacing` (× `--sem-density-factor`), `--text-*` (× `--sem-type-scale`); `dark:` follows `data-appearance` | `libs/ui-react/src/generated/shadcn-bridge.css` (from `src/theme/shadcn-map.json` by `scripts/generate-bridge.mjs`) |
| Per-tenant Tailwind config | None; tenant values arrive only as `--sem-*` values                                                                                                                                                                                                                                         | —                                                                                                                   |
| Widget                     | Does not use Tailwind. Lit components use `static styles` with `var(--sem-*)`                                                                                                                                                                                                               | `libs/chat-widget/src/elements/*.ts`                                                                                |

## 6. Runtime delivery (verified in code; not exercised in a browser for this audit)

| Path          | Finding                                                                                                                                                                                                                                                                                                                                  | File                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Dashboard SSR | Every request: request context from the database → published `theme.v1` → full validation → `resolveTheme` → one nonce-bearing `<style>` in the root layout; `system` emits both appearances under `prefers-color-scheme`; invalid stored themes fall back to platform defaults; `force-dynamic`, authenticated HTML `private, no-store` | `apps/admin-dashboard/src/app/layout.tsx`, `src/server/tenant-theme.ts`, ADR-005                |
| Widget frame  | Loads `/v1/config/<widgetKey>.json` (holds `tenantId`, `themeRevision`), then `/v1/themes/<tenantId>/<revision>.json`; shape guard, resolver, then `ThemeController` sets allow-listed variables on the frame document root; keys outside `RESOLVED_KEYS` are rejected                                                                   | `apps/widget/src/frame/main.ts:145-186`, `libs/chat-widget/src/controllers/theme-controller.ts` |
| Shadow DOM    | Components use `var(--sem-*)` inside their shadow roots; custom properties inherit through shadow boundaries, so values set on the frame root reach them (CSS inheritance; not re-tested here)                                                                                                                                           | `libs/chat-widget/src/elements/*.ts`                                                            |
| Caching       | Themes `immutable`; configs `max-age=60, stale-while-revalidate=600`                                                                                                                                                                                                                                                                     | `apps/widget/src/headers.config.ts`                                                             |
| Preview       | Frame accepts `theme.preview` only from the dashboard origin in preview mode                                                                                                                                                                                                                                                             | ADR-007, THEME-09                                                                               |

## 7. Storage, versioning and authorization (verified)

| Item           | Finding                                                                                                                       | File                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Backend        | Postgres 17 in Docker, used only by the dashboard's Next.js server                                                            | ADR-012, `compose.yaml`                                |
| Tables         | `theme_drafts (tenant_id PK)`, `theme_revisions (tenant_id, revision) PK`, `tenants.published_revision` FK                    | `apps/admin-dashboard/db/migrations/0001_init.sql`     |
| Immutability   | `theme_revisions` has no UPDATE, DELETE or TRUNCATE for any role; revision numbers assigned by trigger under an advisory lock | same file, lines 87-120                                |
| Isolation      | Forced row-level security with `tenant_isolation` policies on theme tables; app role cannot bypass RLS                        | same file, lines 174-188; `check-db-safety`            |
| Publication    | After commit, `materialise.ts` writes the theme document, then the config pointing at it                                      | `apps/admin-dashboard/src/server/store/materialise.ts` |
| Rollback       | `rollback` moves the published pointer to an earlier revision                                                                 | `apps/admin-dashboard/src/data/themes.ts`              |
| Theme identity | A theme is owned by one tenant: there is no theme id separate from tenant id                                                  | DDL above                                              |

## 8. Component variable usage (verified by grep, `var(--sem-…)` in source)

Of 58 generated `--sem-*` variables, 16 are referenced by source code (directly or through the bridge): `on-surface`, `surface`, `outline`, `font-family-sans`, `surface-variant`, `on-surface-variant`, `radius-md`, `primary`, `on-primary`, `focus-ring`, `elevation-surface`, `accent`, `on-accent`, `danger`, `density-factor`, `type-scale`. `success` and `warning` are tenant roles held to contrast policy but not referenced by component styles yet.

Defined but unreferenced (42): the remaining colours (`backdrop`, `on-primary-container`, `outline-variant`, `surface-container`), the font-size, font-weight and line-height scales, motion, `radius-none/sm/lg/full`, `elevation-flat/low/medium` and `space-0…12`. Tailwind's own scales (`--text-*`, `--spacing`) are derived from `--sem-type-scale` and `--sem-density-factor` instead.

## 9. Quality gates (verified in scripts; latest CI result not checked)

| Gate                                                                                                                                        | Where                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm verify` (lint, test, typecheck, build, Storybook, widget bundle assertions, playground smoke, visual, measure, Lighthouse by profile) | `tools/scripts/verify.mjs`, `.github/workflows/ci.yml`, `nightly.yml`                            |
| Generated files up to date (tokens, schema, bridge, fixtures)                                                                               | verify step "Generated files up to date"                                                         |
| Policy checks (pinned actions, ADR immutability, CODEOWNERS, supply chain, tags, graph, contract-change trailer)                            | `tools/scripts/policy/*`                                                                         |
| Theme fixtures: valid, invalid, malicious, migrated                                                                                         | `libs/theme/fixtures/**`, THEME-08                                                               |
| Visual snapshots: dashboard (3 tenants) and widget frame                                                                                    | `apps/admin-dashboard-e2e/src/visual.spec.ts`, `apps/widget-playground/src/tests/visual.spec.ts` |
| Database safety (RLS, allowlist of tables without `tenant_id`)                                                                              | `check-db-safety`                                                                                |

## 10. Tenants and design systems in the repository

The fixtures hold three tenants (`t_acme`, `t_globex`, `t_initech`; `SPECS/validation/tenant-fixtures.md`). The five Figma design systems in the brief (default plus tenants A–D) are **not** in the repository, and no Design Token Kit export is available. Their structure is unverified.

## 11. External facts (checked 2026-11-14 against primary sources)

| Topic                  | Verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Source                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Design Token Kit       | Figma plugin plus `@design-token-kit/cli` and `@design-token-kit/core` 3.2.0 (Apache-2.0, first published 2026-06-10). Exports DTCG 2025.10. Default mode → `tokens.json`; each other mode → an overlay file such as `tokens.dark.json` or `tokens.brand-a.json`; brands are modes. Enforces component → semantic → primitive references; keeps aliases as `{path}`; supports `$ref` JSON Pointer. CLI emits CSS (`:root`, `:root[data-theme]`, names from token paths) and a Tailwind v4 `@theme` block | design-token-kit.github.io docs; registry.npmjs.org |
| DTCG 2025.10           | First stable version (Final Community Group Report, 2025-10-28); colour objects in 14 spaces with optional `alpha` and 6-digit `hex`; dimensions `px`/`rem` only; `$root`, `$extends`, `$ref`; Resolver module published and stable                                                                                                                                                                                                                                                                      | w3.org/community/reports/design-tokens              |
| Style Dictionary 5.7.1 | 2025.10 colour objects, dimension objects, shadow `inset`, `$root` fixes; no documented `$ref`, `$extends` or Resolver support (issue #1590 open)                                                                                                                                                                                                                                                                                                                                                        | styledictionary.com, CHANGELOG                      |
| Tailwind 4.3.3         | `@theme inline` makes utilities use the referenced value; documented for variables referencing other variables. Latest is 4.3.5                                                                                                                                                                                                                                                                                                                                                                          | tailwindcss.com/docs/theme, CHANGELOG               |

## 12. Could not verify in this audit

1. Design Token Kit details not documented: the `$extensions` metadata it writes, colour serialisation (object or hex), units, typography and shadow value shapes, and its Figma Community metadata (the listing refused automated access).
2. The real Figma exports of the five design systems.
3. Shadow DOM delivery and theme leakage in a running browser.
4. The latest CI result on GitHub.
5. Live database contents.

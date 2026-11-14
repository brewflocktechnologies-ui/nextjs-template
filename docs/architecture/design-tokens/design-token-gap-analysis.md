# Design-token gap analysis

|        |                                                                     |
| ------ | ------------------------------------------------------------------- |
| Status | Draft for product-owner review                                      |
| Date   | 2026-11-14                                                          |
| Input  | `design-token-repository-audit.md` (evidence) and the owner's brief |

Classifications: **Done** (already implemented correctly), **Partial**, **Missing**, **Conflict** (incorrect or conflicting with the target), **Verify** (needs verification), **N/A**.

## 1. Summary

The repository already has most of the plumbing the brief asks for: DTCG as the source, one shared Tailwind v4 `@theme inline` mapping onto semantic variables, light and dark, per-request SSR theme delivery, an isolated widget runtime, immutable versioned theme documents with rollback, and strong validation and visual gates. What it does not have is the brief's **unit of theming**: today a theme is a small typed document owned by one tenant (`theme.v1`, 13 colours plus presets), not an independent DTCG design system that several tenants can share. Closing that gap needs one architectural decision that conflicts with an accepted ADR (ADR-004, THEME-01), a registry that separates theme from tenant, and a generator that maps each design system onto the platform contract. Almost everything else can be reused.

## 2. Gap table

| Area                   | Existing implementation                                                                        | Target                                             | Class                | Recommended action                                                                                                                       | Risk                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Nx organisation        | 8 projects with tags and a committed graph; targets inferred                                   | Extensible without a project per tenant            | Done                 | Keep. Theme sources live as data in one project; no new project per theme                                                                | Low                                        |
| DTCG sources           | Platform default only (`libs/design-tokens/tokens`)                                            | One DTCG source set per design system, canonical   | Partial              | Add a theme source folder per theme id, with a manifest; keep the platform default as the first registered theme                         | Medium: real export layouts unknown        |
| Theme registry         | None. Theme identity = tenant id                                                               | Registry-driven, theme separate from tenant        | Missing              | Postgres tables for themes, immutable theme versions and tenant assignments (contract proposal §3)                                       | High: data migration of existing revisions |
| Theme manifests        | None                                                                                           | Versioned manifest per theme                       | Missing              | `theme.manifest.json` with a JSON Schema (contract proposal §2)                                                                          | Low                                        |
| Semantic contract      | `theme.v1` (18 resolved keys) plus 58 platform `--sem-*` defaults; 16 referenced by components | One governed contract every theme satisfies        | Partial              | Define platform semantic contract v1 from actual component usage (16 required) plus governed optional tokens; keep `--sem-*` names       | Medium                                     |
| Tenant-authored values | Typed, enumerated only; never CSS (THEME-01)                                                   | Full design systems with extensions, generated CSS | **Conflict**         | Superseding ADR (ADR-014 draft): CSS is generated only by the platform from validated typed values; tenants never supply CSS             | High: security (T-03)                      |
| Tailwind v4            | One shared generated `@theme inline` bridge; no v3; no per-tenant config                       | One shared mapping, independent of tenant values   | Done                 | Keep `shadcn-bridge.css`; extend `shadcn-map.json` only when the contract adds a token components use                                    | Low                                        |
| Generated CSS          | Platform defaults only (`semantic.css`); tenant values resolved at runtime from `theme.v1`     | Per-theme, per-mode artifacts                      | Missing              | Generator on Style Dictionary 5 (already pinned) with a thin contract adapter; artifacts are resolved variable maps plus a CSS rendering | Medium                                     |
| Light/dark             | Both everywhere; `data-appearance`; `system` handled by consumers                              | Per-theme modes                                    | Done (for one theme) | Reuse; each theme declares its mode files in the manifest                                                                                | Low                                        |
| Dashboard integration  | SSR, nonce'd style tag, fallback on invalid                                                    | SSR theme delivery without flash                   | Done                 | Change only the data source: artifact of the tenant's assigned theme version instead of `resolveTheme(theme.v1)`                         | Medium                                     |
| Widget integration     | Fetches theme by `tenantId/revision`, guard, allow-listed keys                                 | Isolated runtime theme                             | Partial              | Fetch by `themeId/version`; extend the allow-list to the contract keys; keep the guard                                                   | Medium: guard size limit (≤ 2 KB)          |
| Shadow DOM             | Variables on the frame root, inherited into shadow roots                                       | Explicit style delivery                            | Done (by design)     | Add a Playwright assertion that computed styles inside shadow roots use the theme (G9)                                                   | Low                                        |
| Validation             | `theme.v1` schema, contrast policy, malicious fixtures, guard                                  | Automated gates G1–G8                              | Partial              | Add manifest, reference, mode and contract checks; reuse the contrast policy on generated values                                         | Medium                                     |
| Visual verification    | Snapshots for 3 tenants (dashboard and widget)                                                 | Previews per theme and mode, human approval        | Partial              | Storybook theme switcher over registered themes; Playwright snapshots per theme × mode; approval record in the registry                  | Medium: snapshot churn                     |
| Versioning             | Immutable `theme_revisions` per tenant, rollback, immutable static documents                   | Immutable releases per theme, rollback             | Partial              | Move immutability to theme versions; assignments carry history so rollback is a pointer move                                             | Medium                                     |
| Import (P2.2/P2.3)     | Single-file importer; specs for multi-file extraction and projection                           | Figma → DTCG → validation → mapping                | Partial              | Re-scope P2.2/P2.3 as the self-service channel into the same registry, after the curated path works                                      | Medium                                     |
| Design Token Kit       | Not installed                                                                                  | Plugin exports used as source                      | Verify               | Treat plugin output as input files only; no CLI dependency until its output is verified against a real export                            | Medium                                     |

## 3. Conflicts in detail

### 3.1 ADR-004 / THEME-01 versus independent design systems

ADR-004 (Accepted) and THEME-01 allow tenant-facing values only as typed, enumerated fields and forbid free-text CSS, so injection is impossible by construction (threat T-03). The brief asks for per-theme design systems with their own primitives, components and extensions, generated into CSS. An accepted ADR is immutable; changing this needs a new ADR that supersedes ADR-004's grammar decision for theme sources while keeping its guarantee:

- tenants (and import files) never supply CSS text;
- every emitted value is serialised by the platform from a typed canonical value (colour, dimension, number, font family from a list), never passed through;
- variable names come from the contract and a namespaced extension grammar, never from input.

Drafted as ADR-014 in `design-token-adr-proposal.md`.

### 3.2 Contract scope versus what components use

The brief's suggested categories (typography sizes, spacing, shadow, opacity, focus) are wider than today's component needs: components reference 16 variables, and Tailwind scales are derived from two multipliers. Requiring every theme to supply 58+ tokens would force designers to fill values nothing reads. The contract proposal makes the 16 referenced variables plus `success` and `warning` **required**, and the rest **optional with platform fallbacks**, so the required set grows only when a component needs it.

### 3.3 Tenant ownership versus shared themes

`theme_revisions` and RLS assume a theme belongs to one tenant. Shared themes need platform-scoped tables (no `tenant_id`), which `check-db-safety` refuses unless allow-listed. Tenants read only the artifact of the version assigned to them, through a scoped query.

## 4. Minimum changes

1. ADR-014 and the contract, manifest and registry schemas (documents and JSON Schemas only).
2. Generator and validators in `libs/design-tokens` and `libs/theme`, proving equivalence first: the platform default expressed as theme `platform-default` must regenerate today's `semantic.css` values exactly.
3. Registry tables and a migration that turns each tenant's published `theme.v1` revisions into a theme with versions, keeping them byte-identical.
4. Dashboard and widget read the assigned artifact; the variable allow-list grows to the contract keys.
5. Gates and previews per registered theme.
6. Onboard the four tenant design systems when their exports are available.

Not needed: a new Nx project per theme, any change to Tailwind configuration, any component change for onboarding a theme, renaming `--sem-*`.

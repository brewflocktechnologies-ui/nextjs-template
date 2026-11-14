# Design-token implementation roadmap

|        |                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------- |
| Status | Proposal. No phase starts until the owner approves the architecture and marks the phase `Approved` |
| Date   | 2026-11-14                                                                                         |

Phases are additive and reversible; each ends with `pnpm verify` green and an evidence file. Phase IDs are provisional (to become `SPECS/phases/` files).

## T0 — Decisions and contract (documents only)

|                |                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------- |
| Objective      | Accept or change ADR-014 to ADR-017; freeze `platform-semantic-v1`, manifest and artifact schemas  |
| Reuse          | ADR-003, ADR-004, THEME-06 policy, `RESOLVED_KEYS`                                                 |
| New files      | `docs/adr/ADR-014…017` (Proposed), `SPECS/contracts/platform-semantic-v1.md`, `SPECS/phases/T1…T6` |
| Tests / gates  | `pnpm policy:check` (ADR immutability, contract-change trailer)                                    |
| Rollback       | Documents only                                                                                     |
| Human approval | **Yes**: ADRs, contract, open questions in the ADR proposal                                        |

## T1 — Contract, schemas and generator, proven on the platform default

|                |                                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Objective      | Manifest, contract and artifact schemas; adapter; `platform-default` theme regenerates today's values exactly                                                                                                                                                                                                                                                            |
| Reuse          | `libs/design-tokens/tokens/**`, Style Dictionary 5.7.1, `libs/theme/src/policy.ts`, resolver safety tests                                                                                                                                                                                                                                                                |
| Modify         | `libs/design-tokens/package.json` (targets), `tools/scripts/verify.mjs` (one step), `libs/theme/src/resolved-keys.ts` (from contract data)                                                                                                                                                                                                                               |
| New            | `libs/theme/schema/{theme-manifest,platform-semantic,theme-artifact}.v1.json`, `libs/theme/src/contract/**`, `libs/theme/src/generate/**` (platform-neutral generator, own entry), `libs/design-tokens/scripts/themes/**` (thin Nx scripts), `libs/design-tokens/themes/platform-default/theme.manifest.json`, `libs/design-tokens/generated/themes/platform-default/**` |
| Dependencies   | None new                                                                                                                                                                                                                                                                                                                                                                 |
| Nx targets     | `validate*`, `generate*`, `compare`, `verify` on `design-tokens`                                                                                                                                                                                                                                                                                                         |
| Tests          | Fixture matrix (valid, invalid, malicious DTCG; overlay modes; `$ref`; cycles; alpha; out-of-gamut; extensions); property test on the serialiser; equivalence test against `semantic.css`                                                                                                                                                                                |
| Gates          | G1–G8                                                                                                                                                                                                                                                                                                                                                                    |
| Rollback       | Remove the new targets; nothing reads artifacts yet                                                                                                                                                                                                                                                                                                                      |
| Human approval | Evidence review                                                                                                                                                                                                                                                                                                                                                          |

## T2 — Real design systems

|                |                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------- |
| Objective      | Import the five Design Token Kit exports as themes; record their real shape; adjust adapter |
| Reuse          | T1                                                                                          |
| New            | `libs/design-tokens/themes/{tenant-a…d}/**`, fixture per producer version                   |
| Tests / gates  | G1–G8 per theme; contrast results recorded                                                  |
| Rollback       | Remove theme folders                                                                        |
| Human approval | **Yes**: each `semanticMap`, every lossy conversion                                         |
| Blocker        | Requires the exports (risk R-02, R-18)                                                      |

## T3 — Registry and migration

|                |                                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Objective      | `themes`, `theme_versions`, `tenant_theme_assignments`; migrate each tenant's `theme.v1` revisions to `tenant-<id>` theme versions                                |
| Reuse          | Revision trigger pattern, RLS conventions, `materialise.ts`, `withScope`                                                                                          |
| Modify         | `tools/scripts/policy/check-db-safety.mjs` allowlist, `materialise.ts` (write `/v1/themes/<themeId>/<version>.json`), widget config writer (`themeId`, `version`) |
| New            | `apps/admin-dashboard/db/migrations/0002_theme_registry.sql`, `src/data/platform/themes.ts`, platform UI to approve and assign                                    |
| Tests          | Migration byte-equality per tenant; constraints (unapproved cannot be assigned, immutability); RLS isolation with a shared theme; G11                             |
| Rollback       | Old tables untouched; assignments can be dropped; forward-only migration (a new one reverts)                                                                      |
| Human approval | **Yes**: migration dry-run report                                                                                                                                 |

## T4 — Dashboard reads artifacts

|           |                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Objective | SSR injects the assigned artifact; editor-authored themes publish as `theme-v1` versions                                     |
| Modify    | `src/server/tenant-theme.ts`, theme editor publish path, `ThemeStyleTag` input type                                          |
| Tests     | Existing dashboard e2e and visual snapshots unchanged for migrated tenants; new tenant on a shared theme; fallback; CSP test |
| Gates     | G9, G10                                                                                                                      |
| Rollback  | Feature switch back to `resolveTheme(theme.v1)` (kept until T6)                                                              |

## T5 — Widget reads artifacts

|           |                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------- |
| Objective | Frame fetches by `themeId/version`; guard checks artifact shape and contract allow-list                   |
| Modify    | `apps/widget/src/frame/main.ts`, `libs/theme/src/guard.ts` (artifact guard), `ThemeController` allow-list |
| Tests     | Playground suite, shadow-root computed-style assertions, bundle budget (guard ≤ 2 KB)                     |
| Gates     | G9, G10; widget bundle assertions                                                                         |
| Rollback  | Config documents keep the old `tenantId/revision` fields until T6                                         |

## T6 — Gates in CI, previews and cleanup

|                |                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Objective      | Storybook theme switcher over registered themes; per-theme snapshot set; nightly full matrix; retire the duplicate path |
| Modify         | `libs/ui-react/.storybook/*`, `libs/chat-widget/.storybook/*`, visual specs, `verify.mjs` profiles                      |
| Tests          | All registered themes, light and dark                                                                                   |
| Gates          | G1–G11 in `pnpm verify`; report section per theme                                                                       |
| Rollback       | Profiles only                                                                                                           |
| Human approval | Final verification report                                                                                               |

## T3b — Upload channel (owner decision 2: both channels from the start)

|                |                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Objective      | Tenant and platform admins upload DTCG files plus a manifest (or build one in a mapping step) from the dashboard; sources stored in `theme_sources` |
| Reuse          | The P2.2/P2.3 specs (intake, classification, limits, mapping UI, lossy approvals) re-scoped onto the registry; the T1 generator, called server-side |
| Modify         | `SPECS/phases/P2.2-*.md`, `P2.3-*.md` (re-scope: output is a theme source and manifest, not a `theme.v1` projection), theme settings pages          |
| New            | Upload route (`requireTenantTarget`), `src/data/themes-upload.ts`, mapping step reusing the P2.3 role-mapping design                                |
| Tests          | Same gate fixtures as T1 through the upload path; byte-identical artifacts for the same source via repository and upload; limits; no CSS accepted   |
| Gates          | G1–G11                                                                                                                                              |
| Rollback       | Upload route behind a feature switch                                                                                                                |
| Human approval | **Yes**: re-scoped P2.2/P2.3 specs; each uploaded version's approval                                                                                |

## Order and dependencies

T0 → T1 → T3 → (T3b and T4 in parallel) → T5 → T6. T2 (real design systems) runs as soon as the exports exist, after T1. Nothing is deleted before T6, and only after its evidence is accepted.

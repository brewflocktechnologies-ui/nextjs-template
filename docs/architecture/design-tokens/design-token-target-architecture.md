# Design-token target architecture

|           |                                                                                            |
| --------- | ------------------------------------------------------------------------------------------ |
| Status    | Proposal for product-owner approval (Stage B). Depends on ADR-014 to ADR-017 (drafts)      |
| Date      | 2026-11-14                                                                                 |
| Companion | Audit, gap analysis, contract proposal, roadmap, ADR proposal, risk register (same folder) |

## 1. Shape in one paragraph

Each design system is a **theme**: a folder of DTCG files exported from Figma, plus a manifest. A platform **generator** validates the files, resolves references per mode, maps the theme's own token names onto the **platform semantic contract** (`--sem-*`, unchanged names) and writes one immutable **artifact** per theme version: resolved variable maps for light and dark, extensions, and a report of every conversion. A human approves the version in a **registry** in Postgres, which assigns versions to tenants. The dashboard injects the assigned artifact during SSR, and the widget loads it in its frame. Shared components and the **one Tailwind v4 mapping** read only `--sem-*`, so a new theme never changes code.

## 2. Data flow

```
Figma ─► Design Token Kit plugin ─► DTCG files (+ manifest)          canonical source, reviewed by PR
                                         │
                       nx run design-tokens:validate-theme            G1–G6
                                         │
                       nx run design-tokens:generate-theme            one generator module (libs/theme),
                       or dashboard server (upload channel)            same code for both channels
                                         │
                    artifact.json (+ preview CSS, report)             generated, deterministic (G7, G8)
                                         │
                 previews: Storybook theme switcher, Playwright       G9, G10 (human approval)
                                         │
             registry: theme_versions (approved, immutable)           G11
                                         │
          tenant_theme_assignments (tenant → themeId@version)         authoritative mapping
                 │                                     │
   Dashboard SSR: nonce'd <style> from artifact    Widget: /v1/themes/<themeId>/<version>.json
   (per request, private, no-store)                → guard → ThemeController on the frame root
                 │                                     │
        Tailwind v4 @theme inline → --sem-*        Lit static styles → var(--sem-*)
```

## 3. Proposed repository structure

Only additions are shown; everything existing stays.

```
libs/design-tokens/
├── tokens/                         existing platform default sources (unchanged)
├── themes/                         NEW: canonical theme sources, one folder per theme id
│   ├── platform-default/
│   │   └── theme.manifest.json     points at ../../tokens/** (no copy of the sources)
│   ├── tenant-a/
│   │   ├── theme.manifest.json
│   │   └── tokens/tokens.json, tokens/tokens.dark.json
│   └── …                           any number; no code or config per theme
├── scripts/
│   ├── build.mjs                   existing
│   └── themes/                     NEW: thin Nx scripts (read files, call the libs/theme generator, write)
└── generated/themes/               NEW, committed and stale-checked like src/generated
    └── <themeId>/<version>/artifact.json, preview.css, report.json, report.md

libs/theme/
├── schema/                         + theme-manifest.v1.json, platform-semantic.v1.json, theme-artifact.v1.json
├── src/contract/                   NEW: contract data, artifact guard, extension rules (shared by
│                                   generator, dashboard and frame); RESOLVED_KEYS grows from the contract
└── src/generate/                   NEW: platform-neutral generator (load, overlay, resolve, canonicalise,
                                    map, check, serialise); separate entry so the frame never loads it

libs/ui-react/src/theme/shadcn-map.json   existing shared Tailwind mapping (extended only by contract)

apps/admin-dashboard/
├── db/migrations/0002_theme_registry.sql NEW: themes, theme_versions, tenant_theme_assignments
├── src/data/platform/themes.ts            NEW: registry functions (PlatformContext first)
└── src/server/tenant-theme.ts             changed: reads the assigned artifact

apps/widget/public/v1/themes/<themeId>/<version>.json   materialised artifacts (immutable)

docs/architecture/design-tokens/           these documents
SPECS/contracts/platform-semantic-v1.md    contract (after approval)
SPECS/evidence/<phase>.md                   verification and approval evidence
```

Separation:

| Kind                       | Where                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Canonical sources          | `libs/design-tokens/tokens/**` (platform default), `libs/design-tokens/themes/<id>/**`                                       |
| Contract and configuration | `libs/theme/schema/*.json`, `SPECS/contracts/platform-semantic-v1.md`, `shadcn-map.json`                                     |
| Generated artifacts        | `libs/design-tokens/generated/themes/**`, `libs/ui-react/src/generated/shadcn-bridge.css`, `apps/widget/public/v1/themes/**` |
| Runtime code               | `libs/theme/src/contract`, dashboard `tenant-theme.ts`, frame `main.ts`, `ThemeController`                                   |
| Verification evidence      | `reports/` (per `pnpm verify` run), `SPECS/evidence/`, registry `report` and approval columns                                |

No theme gets its own Nx project, Tailwind configuration or component code. The platform default's sources are referenced from its manifest, not copied.

## 4. Generation (ADR-016, amended by owner decision 2)

One platform-neutral TypeScript module in `libs/theme/src/generate/` (no file system, no DOM), called by the Nx target for repository themes and by the dashboard server for uploads. Style Dictionary keeps building the platform default (ADR-003) and serves as the reference in the equivalence test.

1. **Load** the manifest (schema check), then each mode's file list in order; later files overlay earlier ones (Design Token Kit's base plus mode files).
2. **Resolve** `{path}` and `$ref` JSON Pointer references per mode, detecting cycles (Style Dictionary 5.7.1 has no documented `$ref` support, so this is done here in any case).
3. **Canonicalise** values to typed forms: DTCG 2025.10 colour objects in 14 spaces, hex, dimension objects, shadows. Colour-space conversion to sRGB uses a colour library or a small tested implementation, chosen in T1.
4. **Map** contract paths through `semanticMap`; apply platform fallbacks for absent optional tokens.
5. **Check** the contract: types, units, ranges, alpha rules, contrast (THEME-06 pairs, existing `policy.ts`), mode independence, extension names.
6. **Serialise** each value from its canonical form (hex, number plus unit, shadow layers, font stack from the registry). Never copy source strings.
7. **Write** `artifact.json`, `preview.css` (`:root[data-theme="<id>"]` and `[data-appearance="dark"]` blocks, for Storybook and review only), `report.json` and `report.md`, with sorted keys and no time stamps.

Lossy conversions (out-of-sRGB colours, dropped composite parts) are report entries with severity; any warning needs approval at G10. Nothing is converted silently.

Design Token Kit's own CLI is not used for generation: its CSS names come from token paths (`--semantic-color-…`) and its Tailwind output is a per-project `@theme` block, which would duplicate the shared mapping.

## 5. Tailwind v4

- Installed 4.3.3 (latest is 4.3.5; no upgrade without approval).
- Keep the generated `shadcn-bridge.css`: one `@theme inline` block. Tailwind's documentation states that `inline` makes utilities use the referenced value (`var(--sem-…)`) rather than the theme variable, which is the documented pattern for runtime variables (tailwindcss.com/docs/theme).
- Tenant artifacts contain only variable values, never `@theme` or utilities.
- The widget does not use Tailwind; Lit styles read `--sem-*`. If Tailwind were ever used inside shadow roots, `@property` declarations must also exist at the document root (tailwindcss PR #15975); not needed today.

## 6. Runtime

| Concern    | Dashboard                                                                                                        | Widget                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Resolution | Request context from the database → active assignment → artifact (scoped query); never from browser input        | Config document (written by materialisation) names `themeId` and `version`; frame fetches `/v1/themes/<themeId>/<version>.json` |
| Delivery   | Existing nonce'd `<style>` from the artifact's maps; `system` emits both under `prefers-color-scheme`; no flash  | Artifact guard (shape and allow-list), then `ThemeController` sets variables on the frame root; shadow roots inherit            |
| Caching    | `force-dynamic`, `private, no-store` (unchanged); any future cache key = tenant + themeId + version + appearance | Theme documents `immutable` (version in the URL); config `max-age=60`                                                           |
| Fallback   | Invalid or missing artifact → platform default (unchanged behaviour)                                             | Unsupported artifact → embedded defaults (unchanged)                                                                            |
| Isolation  | RLS on assignments; artifact read through a scoped function                                                      | One frame per tenant config; preview only from the dashboard origin                                                             |
| Rollback   | Activate an earlier assignment; materialisation rewrites the config pointer                                      | Old version files stay (immutable)                                                                                              |

## 7. Nx targets (Nx 24, inferred plus `package.json` `nx.targets`)

All on `@byteflock/design-tokens`; `--themeId` selects one theme, omitted means all registered.

| Target                        | Does                                                                    | Inputs                                                  | Outputs                                | Cache |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------- | ----- |
| `validate-schema`             | Manifest and DTCG structure (G1, G2)                                    | `themes/**`, `libs/theme/schema/**`                     | `test-output/reports/themes/validate/` | yes   |
| `validate-references`         | G3                                                                      | same                                                    | same                                   | yes   |
| `validate-modes`              | G4                                                                      | same                                                    | same                                   | yes   |
| `validate-contract`           | G5, G6                                                                  | same + contract                                         | same                                   | yes   |
| `validate` / `validate-theme` | All four                                                                | union                                                   | same                                   | yes   |
| `generate` / `generate-theme` | Writes artifacts (G7)                                                   | `themes/**`, `tokens/**`, `scripts/themes/**`, contract | `generated/themes/**`                  | yes   |
| `compare`                     | Regenerates to a temp folder and diffs against committed artifacts (G8) | as generate + `generated/themes/**`                     | report                                 | yes   |
| `preview`                     | Storybook with the theme switcher over registered artifacts             | artifacts                                               | static build                           | yes   |
| `report`                      | Merges reports                                                          | reports                                                 | `reports/themes.md`                    | no    |
| `verify`                      | `validate` + `compare` + tests                                          | —                                                       | —                                      | —     |

Nx caches per target, not per argument: a change in one theme invalidates the target's cache. To avoid regenerating unchanged themes, the generator skips a theme whose source hash, contract hash and generator version equal the committed artifact's (recorded in `report.json`), so output stays byte-identical. Changing the contract or the generator changes every hash and regenerates all themes. Changes to `shadcn-map.json` already rebuild `ui-react` and its dependants through the graph. `pnpm verify` gains one step calling `design-tokens:verify` (D-26: gates are added once, in `verify.mjs`).

## 8. Quality gates

| Gate                | Tested                                                                                                                     | How                                      | Command                                      | Fails when                              | Evidence                  | Human                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------- | --------------------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| G1 Source integrity | Manifest exists, declared files exist, no undeclared token files, ids unique                                               | Schema + file walk                       | `validate-schema`                            | any missing or extra file, duplicate id | `validate/<id>.json`      | no                                                                        |
| G2 DTCG             | Structure, `$type` values, value shapes for 2025.10                                                                        | Adapter parse + schema                   | `validate-schema`                            | invalid token for its type              | same                      | no                                                                        |
| G3 References       | `{path}` and `$ref` resolve per mode, no cycles, no non-overlay duplicates                                                 | Resolver                                 | `validate-references`                        | unresolved, cyclic, conflict            | same                      | no                                                                        |
| G4 Modes            | light and dark resolve every required path; mode-independent tokens agree                                                  | Per-mode resolution                      | `validate-modes`                             | missing mode value, disagreement        | same                      | no                                                                        |
| G5 Contract         | Every required path mapped, types, units, ranges, alpha rules, contrast                                                    | Contract data + `policy.ts`              | `validate-contract`                          | any violation                           | same                      | no                                                                        |
| G6 Extensions       | `--ext-<themeId>-*` grammar, no `--sem-` shadowing, no collisions; shared components never read `--ext-*`                  | Validator + lint rule                    | `validate-contract`, `pnpm nx lint`          | any collision or reference              | same, lint output         | no                                                                        |
| G7 Generation       | All required variables emitted; serialiser safety (no `url(`, `;`, braces, `<`, newlines)                                  | Unit and property tests                  | `generate-theme`, `test`                     | missing variable, unsafe value          | `report.json`             | no                                                                        |
| G8 Reproducibility  | Regeneration equals committed output; platform default equals today's values                                               | `compare`                                | `compare`                                    | any byte difference                     | diff in report            | no                                                                        |
| G9 Integration      | Dashboard and widget show the assigned theme; computed styles inside shadow roots; two tenants, no leakage; fallback       | Playwright                               | `nx e2e …`, playground suite                 | wrong colour, leakage, no fallback      | Playwright report         | no                                                                        |
| G10 Visual          | Per theme × mode snapshots of a fixed screen set; reviewer checks against the Figma frames listed in the evidence template | Playwright snapshots + Storybook preview | `pnpm visual`                                | snapshot diff without approval          | snapshots, evidence entry | **yes**: reviewer name, date, notes recorded in `theme_versions.approval` |
| G11 Release         | SemVer valid and greater than the previous, artifact hash matches, approval present, rollback target exists                | Registry constraints + check script      | migration constraints, `check-theme-release` | any missing                             | registry row, evidence    | **yes** (G10 record)                                                      |

## 9. Onboarding a theme

| Step                                          | Automated                          | Human                                       |
| --------------------------------------------- | ---------------------------------- | ------------------------------------------- |
| 1. Register `themeId` (folder + `themes` row) | —                                  | platform admin                              |
| 2. Add exported DTCG files                    | —                                  | designer or platform admin, by pull request |
| 3. Add manifest with `semanticMap`            | scaffold suggests mappings by name | reviewer confirms                           |
| 4–5. Validate source and contract (G1–G6)     | yes                                | —                                           |
| 6. Generate (G7, G8)                          | yes                                | —                                           |
| 7. Integration tests (G9)                     | yes                                | —                                           |
| 8. Visual preview (G10)                       | snapshots generated                | reviewer approves                           |
| 9. Approval record                            | —                                  | yes                                         |
| 10. Publish immutable version (G11)           | yes                                | —                                           |
| 11. Assign to tenants                         | —                                  | platform admin in the dashboard             |

**Upload channel** (owner decision 2): steps 2–3 happen in the dashboard instead of a pull request. Files and manifest are stored in `theme_sources`; the dashboard server runs the same generator (one platform-neutral module in `libs/theme`), so the same source produces the same artifact by either channel. Steps 4–11 are identical.

**Sharing:** several tenants hold assignments to the same `themeId@version`. **Upgrade:** a new version is approved, then assignments move (per tenant or all). **Rollback:** reactivate the previous assignment; artifacts are never deleted.

## 10. Relationship with existing work

- `theme.v1` stays a source format (`source.format: "theme-v1"`), so the editor and today's tenant data keep working; publishing from the editor creates a new version of the tenant's own theme (owner decision 3).
- P2.2/P2.3 (import from tenant files) are re-scoped as the upload channel (roadmap T3b), built alongside the repository channel.
- Generation runs in one platform-neutral TypeScript module in `libs/theme` (ADR-016 as amended by owner decision 2), used by the Nx target and by the dashboard server.
- The DTCG Resolver module (2025.10, stable) could later replace the manifest's `modes` lists; Style Dictionary does not implement it yet, so the manifest stays the resolver for now.

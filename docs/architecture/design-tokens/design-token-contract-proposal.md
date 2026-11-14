# Design-token contract proposal

|        |                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------- |
| Status | Proposal. Becomes binding only through ADR-014 and a contract file under `SPECS/contracts/`       |
| Date   | 2026-11-14                                                                                        |
| Scope  | Platform semantic contract, theme manifest, theme registry, extension rules, compatibility policy |

## 1. Platform semantic contract (`platform-semantic-v1`)

### 1.1 Principles

1. The contract names **outputs**, not inputs: the `--sem-*` variables shared components read. Names stay as they are today (ADR-003), so no component changes.
2. A design system keeps its own token names and structure. Its manifest maps each contract path to one of its own tokens (§2.3). The generator resolves that token in each mode.
3. **Required** tokens are exactly what shared components read today (audit §8) plus the two status colours already under contrast policy. **Optional** tokens have a platform fallback from `platform-default`. A token moves from optional to required only when a shared component starts reading it, with a minor contract version.
4. Every value is typed. The generator serialises CSS from the canonical typed value; it never copies source text.

### 1.2 Required tokens

| Contract path              | Variable                         | DTCG type    | Per mode | Constraint                                                                                           |
| -------------------------- | -------------------------------- | ------------ | -------- | ---------------------------------------------------------------------------------------------------- |
| `color.primary`            | `--sem-color-primary`            | `color`      | yes      | sRGB-representable; ≥ 3:1 against `color.surface`                                                    |
| `color.on-primary`         | `--sem-color-on-primary`         | `color`      | yes      | ≥ 4.5:1 against `color.primary`                                                                      |
| `color.surface`            | `--sem-color-surface`            | `color`      | yes      | opaque                                                                                               |
| `color.on-surface`         | `--sem-color-on-surface`         | `color`      | yes      | ≥ 4.5:1 against `surface` and `surface-variant`                                                      |
| `color.surface-variant`    | `--sem-color-surface-variant`    | `color`      | yes      | opaque                                                                                               |
| `color.on-surface-variant` | `--sem-color-on-surface-variant` | `color`      | yes      | ≥ 4.5:1 against `surface-variant`                                                                    |
| `color.outline`            | `--sem-color-outline`            | `color`      | yes      | ≥ 3:1 against `surface`                                                                              |
| `color.accent`             | `--sem-color-accent`             | `color`      | yes      | —                                                                                                    |
| `color.on-accent`          | `--sem-color-on-accent`          | `color`      | yes      | ≥ 4.5:1 against `accent`                                                                             |
| `color.success`            | `--sem-color-success`            | `color`      | yes      | ≥ 3:1 against `surface`                                                                              |
| `color.warning`            | `--sem-color-warning`            | `color`      | yes      | ≥ 3:1 against `surface`                                                                              |
| `color.danger`             | `--sem-color-danger`             | `color`      | yes      | ≥ 3:1 against `surface`                                                                              |
| `color.focus-ring`         | `--sem-color-focus-ring`         | `color`      | yes      | ≥ 3:1 against `surface`                                                                              |
| `font.family.sans`         | `--sem-font-family-sans`         | `fontFamily` | no       | family names only; generator appends a platform fallback stack; fonts must be platform-hosted (§1.5) |
| `radius.md`                | `--sem-radius-md`                | `dimension`  | no       | `px` or `rem`, 0–48 px                                                                               |
| `elevation.surface`        | `--sem-elevation-surface`        | `shadow`     | yes      | 1–3 layers; colours sRGB with alpha allowed                                                          |
| `scale.density`            | `--sem-density-factor`           | `number`     | no       | 0.75–1.5                                                                                             |
| `scale.type`               | `--sem-type-scale`               | `number`     | no       | 0.875–1.25                                                                                           |

These 18 are the same keys the resolver allow-lists today (`RESOLVED_KEYS`), so every existing consumer keeps working. Contrast constraints are THEME-06 and D-20, unchanged. Alpha is allowed only where stated; elsewhere a colour with alpha < 1 fails G5 (it is not flattened silently).

### 1.3 Optional tokens (platform fallback when absent)

All other `--sem-*` variables generated today: `color.surface-container`, `color.outline-variant`, `color.on-primary-container`, `color.backdrop` (alpha allowed), `font.size.*`, `font.weight.*`, `line-height.*`, `radius.none|sm|lg|full`, `elevation.flat|low|medium`, `motion.duration.*`, `motion.easing.standard`, `space.0…12`. Same types and units as the platform default. A theme that supplies one gets it validated like a required token.

### 1.4 Modes

- Required modes: `light` and `dark`. A theme without a dark design supplies its light values for both, explicitly (the manifest maps both modes to the same files); the generator never copies one mode into the other on its own.
- Mode-independent tokens (marked "no" above) must resolve to the same value in both modes, or the generator reports which mode won (G4).
- `appearance` (`light | dark | system`) is a tenant setting on the assignment, not part of the theme.

### 1.5 Supported values

| Type         | Accepted source forms                                                                                       | Emitted                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color`      | DTCG colour object in `srgb`, `srgb-linear`, `display-p3`, `oklch`, `oklab`, `hsl`, `hwb`; hex strings      | `#rrggbb` or `#rrggbbaa` when exact in sRGB; otherwise the colour converted to sRGB **only with a recorded lossy-conversion entry** (G7) and approval |
| `dimension`  | `{ value, unit }` with `px` or `rem`                                                                        | same unit; no unit conversion                                                                                                                         |
| `number`     | number                                                                                                      | number                                                                                                                                                |
| `fontFamily` | string or array of strings                                                                                  | quoted family names plus platform fallback stack; only families in the platform font registry (THEME-02 fonts today); others fail G5                  |
| `shadow`     | DTCG shadow object or array                                                                                 | `offsetX offsetY blur spread color` per layer                                                                                                         |
| references   | `{path}` and `$ref` JSON Pointer (DTCG 2025.10; Design Token Kit emits both) within the theme's own sources | resolved per mode before emitting; cycles and missing targets fail G3                                                                                 |

### 1.6 Naming and extensions

See §4.

## 2. Theme manifest (`theme.manifest.json`)

### 2.1 Example

```json
{
  "$schema": "../../schema/theme-manifest.v1.json",
  "manifestVersion": 1,
  "themeId": "tenant-a",
  "displayName": "Tenant A",
  "version": "1.2.0",
  "contract": "platform-semantic-v1",
  "source": {
    "format": "dtcg-2025.10",
    "producer": { "name": "Design Token Kit Figma plugin", "version": "3.2.0" },
    "files": ["tokens/tokens.json", "tokens/tokens.dark.json"]
  },
  "modes": {
    "light": ["tokens/tokens.json"],
    "dark": ["tokens/tokens.json", "tokens/tokens.dark.json"]
  },
  "semanticMap": {
    "color.primary": "action.primary.default",
    "color.on-primary": "action.primary.on",
    "color.surface": "surface.default",
    "font.family.sans": "font.family.body",
    "radius.md": "radius.medium"
  },
  "extensions": {
    "namespace": "tenant-a",
    "tokens": {
      "brand-gradient-start": "brand.gradient.start"
    }
  },
  "fonts": ["inter"]
}
```

### 2.2 Fields

| Field             | Required | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifestVersion` | yes      | Schema version of this file (const 1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `themeId`         | yes      | `^[a-z][a-z0-9-]{1,40}$`, unique in the registry, never reused                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `displayName`     | yes      | 1–60 characters                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `version`         | yes      | SemVer. Patch: values only. Minor: optional tokens or extensions added. Major: extension removed or renamed                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `contract`        | yes      | Contract id and major version the theme satisfies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `source.format`   | yes      | `dtcg-2025.10` (others later, for example `theme-v1` for editor-authored themes)                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `source.producer` | no       | Export tool and version, for traceability only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `source.files`    | yes      | Every source file, relative to the manifest; G1 fails if one is missing or an extra token file is present                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `modes`           | yes      | `light` and `dark`, each an ordered list of files merged in that order: a later file **overrides** paths of an earlier one, as Design Token Kit's base-plus-mode-file exports require (`tokens.json` + `tokens.dark.json`); every override is listed in the report, and a path defined twice **within one file list without being an overlay** (two non-overlay files) is a conflict (G3). Brands exported as Figma modes (`tokens.brand-a.json`) become separate themes, each with its own manifest pointing at the shared base file |
| `semanticMap`     | yes      | Contract path → source token path, for every required token; optional ones may be listed                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `extensions`      | no       | §4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `fonts`           | no       | Platform font ids the theme uses                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Generation metadata (generator version, source hashes, output hashes) and approval are **not** written into the manifest: they belong to the registry record (§3), so the manifest stays a hand-reviewed source file.

## 3. Theme registry (Postgres, ADR-012)

Registry metadata, versions and tenant assignment are separate tables.

| Table                      | Scope    | Key columns                                                                                                                                                                                                                        | Rules                                                                                                          |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `themes`                   | platform | `theme_id` PK, `display_name`, `source_origin` (`repository`, `upload`), `owner_tenant_id` (null for shared themes), `status` (`active`, `deprecated`, `retired`), `created_at`                                                    | No `tenant_id` column; added to the `check-db-safety` allowlist with a reason; one origin per theme            |
| `theme_sources`            | platform | (`theme_id`, `version`, `path`) PK, `sha256`, `content` (original bytes)                                                                                                                                                           | Only for `upload` themes; immutable; `repository` themes keep their sources in git, referenced by commit       |
| `theme_versions`           | platform | (`theme_id`, `version`) PK, `contract`, `manifest` jsonb, `sources_sha256`, `artifact` jsonb, `artifact_sha256`, `generator_version`, `report` jsonb, `approval` (`pending`, `approved`, `rejected`), `approved_by`, `approved_at` | Immutable after approval (same trigger pattern as `theme_revisions`); only `approved` versions can be assigned |
| `tenant_theme_assignments` | tenant   | `tenant_id`, `theme_id`, `version`, `appearance`, `assigned_by`, `assigned_at`, `active`                                                                                                                                           | One active row per tenant; history kept; forced RLS on `tenant_id`; rollback = activate an earlier row         |

Lifecycle: **registered** (row in `themes`) → **version pending** (generated, gates G1–G9 passed) → **approved** (G10 human record) → **assigned** (one or more tenants) → **deprecated** (no new assignments; existing ones keep working) → **retired** (no assignments left; versions kept for audit).

Tenants read only through a scoped function returning the artifact of their active assignment. Browser-supplied theme ids are never trusted: the dashboard resolves the assignment from the request context; the widget config document carries the `themeId` and `version` written by materialisation.

Migration of today's data: each tenant with published `theme.v1` revisions becomes theme `tenant-<tenantId>` (`source_origin: upload`, `owner_tenant_id` set) with source format `theme-v1`; each revision becomes a version (1.0.0, 1.1.0, …) with the same document; the tenant is assigned its published version. Revisions stay in place until the migration is verified.

Repository themes reach the registry through a sync step (`pnpm db:sync-themes`, run by `pnpm stack` and deployment): it registers each committed theme version and its committed artifact, refusing any version whose artifact hash differs from a fresh generation. Approval and assignment always happen in the registry.

Owner-tenant themes (from the editor or an upload) are visible only to their tenant and platform admins; shared themes (`owner_tenant_id` null) only to platform admins, which assign them.

Fonts: `fontFamily` values must name families in the platform font registry (`libs/theme/src/fonts.ts` today, extended with self-hosted files by the platform); unknown families fail G5.

## 4. Extension contract

1. Extensions are optional theme-specific tokens outside the contract, for example a marketing gradient.
2. Each theme has one namespace, equal to its `themeId`. Extension variables are `--ext-<themeId>-<name>`, `<name>` matching `^[a-z][a-z0-9-]{0,40}$`.
3. An extension can never use the `--sem-` prefix, never shadow a contract variable, and never collide with another extension (G6).
4. Shared components in `libs/ui-react` and `libs/chat-widget` must not reference `--ext-*` (lint rule). Only theme-specific surfaces, behind an explicit, tested opt-in, may read them, with a fallback.
5. Extension values follow §1.5 types; unsupported types are reported, not emitted.
6. Removing or renaming an extension is a major theme version.

## 5. Compatibility and deprecation policy

| Change                                      | Contract version                                      | Effect on themes                                                    |
| ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| New optional token                          | minor                                                 | None; fallback applies                                              |
| Optional → required                         | minor, with a deprecation window of one theme release | Themes without it get a G5 warning, then an error in the next minor |
| Constraint tightened (for example contrast) | minor                                                 | Themes re-verified; failing ones cannot be re-approved              |
| Token removed or renamed                    | major                                                 | Requires a migration and all themes re-generated                    |

Deprecated tokens carry `$deprecated` in the contract file and are still emitted until the next major. The contract file lives at `SPECS/contracts/platform-semantic-v1.md` with a machine-readable copy `libs/theme/schema/platform-semantic.v1.json`; changing it needs a `CONTRACT-CHANGE:` trailer (existing policy check).

## 6. JSON Schemas to add (after approval)

- `libs/theme/schema/theme-manifest.v1.json`: §2.
- `libs/theme/schema/platform-semantic.v1.json`: §1 as data (path, variable, type, mode-dependent, constraints, required).
- `libs/theme/schema/theme-artifact.v1.json`: `{ themeId, version, contract, modes: { light: { "--sem-…": "…" }, dark: {…} }, extensions: {…}, report }`. This is the only thing the dashboard and widget read.

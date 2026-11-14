# ADR-015: Theme registry separate from tenants

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Proposed                                                              |
| Date     | 2026-11-14                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §8; SPECS/DECISIONS.md D-24, D-30; ADR-012, ADR-013          |

## Context and problem statement

Today a theme belongs to one tenant: `theme_revisions` is keyed by `(tenant_id, revision)` and protected by tenant RLS. Several tenants must be able to use one theme, themes must be versioned and released independently, and only approved versions may reach a tenant. The question is where theme identity, versions and tenant assignment live.

## Decision drivers

- Theme identity separate from tenant identity; one approval per theme version.
- The tenant-to-theme mapping is authoritative on the server; browser input never selects a theme.
- Tenant isolation stays enforced by the database.
- Immutable versions and rollback, as today.

## Considered options

1. Separate Postgres tables for themes, immutable theme versions, uploaded sources and tenant assignments.
2. Keep `theme_revisions` per tenant and copy shared themes into each tenant.
3. Registry as files in the repository only.

## Decision outcome

**Chosen option:** option 1, because it is the only option with one approval per version, sharing without copies and runtime assignment without a deploy.

- `themes` (platform scope: `theme_id`, `source_origin` `repository | upload`, `owner_tenant_id` null for shared themes, `status`), `theme_versions` (immutable after approval: manifest, source and artifact hashes, artifact, report, approval), `theme_sources` (original bytes of uploaded sources only), `tenant_theme_assignments` (tenant scope, forced RLS, history; one active row per tenant).
- Each theme has exactly one source origin: repository themes keep their sources in git and are registered by a sync step that refuses artifacts that do not regenerate identically; uploaded themes keep theirs in `theme_sources` (D-30).
- Only approved versions can be assigned (database constraint). Rollback activates an earlier assignment.
- Tenants read only their active assignment's artifact through a scoped function. Materialisation writes `/v1/themes/<themeId>/<version>.json`, and the widget config names `themeId` and `version`.
- Existing `theme.v1` revisions migrate to `tenant-<tenantId>` themes with identical documents; the old tables stay until the migration is verified.

### Consequences

- Good: sharing, independent releases, approval enforced by the database.
- Bad: two platform-scoped tables without `tenant_id` join the `check-db-safety` allowlist, each with a reason.
- Neutral / follow-ups: owner-tenant themes are visible to their tenant and platform admins; shared themes only to platform admins.

## Verification

<!-- verification -->

To be filled by P2.6: migration byte-equality per tenant, constraint tests (unapproved versions cannot be assigned, approved versions cannot change), RLS isolation with a shared theme.

<!-- /verification -->

## Links

- Related: ADR-012, ADR-013, ADR-014
- Contract: `docs/architecture/design-tokens/design-token-contract-proposal.md` §3
- Evidence: `SPECS/evidence/P2.6.md`

# ADR-012: Local data backend (Postgres in Docker, Next.js server as data layer)

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Proposed                                                              |
| Date     | 2026-11-11                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §8.5, §8.6, §9; SPECS/DECISIONS.md D-13, D-24                |

## Context and problem statement

Phase 1 had no backend. Tenants came from `validation/tenants.json`, theme drafts were JSON files under `.local/drafts/`, and published themes and widget configs were files in the widget's static folder (D-13). Phase 2 needs tenants, users, roles, theme revisions, widget settings and tenant dashboard config to live in a real store that enforces tenant isolation, so the dashboard can serve a super admin and many tenants from one process. The question is what that store is, who talks to it, and how isolation is enforced.

## Decision drivers

- No cross-tenant reads or writes, enforced below the application code as well as in it
- Runs on the product owner's Windows 11 machine with one prerequisite
- Few new dependencies (ADR-011), each justified
- Keeps the widget reading static, immutable documents (ADR-007, THEME-09)
- Can be replaced by a production backend later without changing the dashboard's data-access API

## Considered options

1. **Postgres in Docker Compose; the dashboard's Next.js server queries it through `pg` with SQL migrations; row-level security on every tenant table.**
2. **A separate backend service** (a new Node service, or the chatplatform Java services and their Postgres and Flyway setup); the dashboard calls it over HTTP or gRPC.
3. **An ORM or query builder** (Drizzle, Prisma, Kysely) over Postgres instead of `pg` with plain SQL.
4. **SQLite** file in the repository's `.local/` folder.

## Decision outcome

**Chosen option:** option 1, because it gives a real relational store with database-enforced tenant isolation for the smallest change: no new service, no new network hop, and the existing `src/data/**` API stays the seam a production backend can replace later.

- **Runtime:** Postgres 17, one Compose service in `compose.yaml` at the repository root, image pinned by tag and digest, host port 5440, named volume. Databases `byteflock` (stack) and `byteflock_test` (tests).
- **Access:** only the dashboard server, through `pg` with parameterised queries. `pg` may be imported only under `apps/admin-dashboard/src/server/db/**` (lint). No ORM, no query builder.
- **Isolation:** every table with a `tenant_id` column has row-level security enabled and forced. The application role `byteflock_app` is not the table owner and has no `BYPASSRLS`. Every query runs in a transaction opened by `withScope(ctx, fn)`, which sets `app.scope` and `app.tenant_id` with `SET LOCAL`, so a pooled connection never carries one request's scope into the next.
- **Schema changes:** forward-only SQL files in `apps/admin-dashboard/db/migrations/`, applied by a Node runner that records each file and its checksum. An applied file must not be edited.
- **Published documents:** Postgres is the source of truth. After a publish commits, the theme and widget config files are materialised into the widget's static folder in THEME-09 order. `pnpm db:materialise` rebuilds them from the database.
- **Tooling:** Node scripts (`pnpm db:up`, `db:down`, `db:migrate`, `db:seed`, `db:reset`, `db:materialise`) that call `docker compose`; no shell scripts (Windows first-class).

### Consequences

- Good: Tenant isolation holds even if application code forgets a `WHERE tenant_id` clause.
- Good: The data-access API that P1.6 built (`getPublishedTheme`, `saveDraft`, `publish`, `rollback`, …) keeps its signatures; only the implementation changes.
- Good: SQL migrations are readable by anyone, including a future Java backend team.
- Bad: Docker Desktop becomes a prerequisite for `pnpm stack` and `pnpm verify` on Windows.
- Bad: Hand-written SQL and row mappers mean more code than an ORM would generate, and no compile-time query checking.
- Bad: Materialisation after commit can leave the widget one revision behind if a file write fails; repaired by `db:materialise`. Acceptable in development only.
- Neutral / follow-ups: Production storage for published documents (object storage or a CDN origin), connection pooling and backups are later phases. A separate backend service can replace the dashboard's data layer behind the same `src/data/**` API.

## Verification

<!-- verification -->

To be filled by P2.1: Postgres image tag and digest, `pg` version, migration list, the RLS test (P2.1-AC02), the immutability test (P2.1-AC03), the pooled-connection interleaving test, and the materialisation repair test (P2.1-AC10).

<!-- /verification -->

## Links

- Related: ADR-005 (tenant context; superseded by ADR-013), ADR-007 (widget isolation), ADR-011 (dependency policy), ADR-013 (request scope)
- Spec: `SPECS/phases/P2.1-tenant-data-backend-and-platform-scope.md`
- Evidence: `SPECS/evidence/P2.1.md`

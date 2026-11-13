# ADR-013: Request scope (platform and tenant), authorization helper and default chrome

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Proposed                                                              |
| Date     | 2026-11-11                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §9; SPECS/DECISIONS.md D-12, D-20, D-25; supersedes ADR-005  |

## Context and problem statement

ADR-005 gave every request one tenant: `{ tenantId, userId, roles, locale }`, read from a signed development cookie, with authorization left to a backend that did not exist yet. Phase 2 adds a super admin who works across every tenant, and a database (ADR-012) that now holds users and roles. The dashboard must know which kind of user is asking, decide what each one may do, and choose which design the chrome shows, without weakening any of ADR-005's isolation and caching rules.

## Decision drivers

- No cross-tenant leakage, for tenant users and in what a super admin is shown
- One place that decides authorization, testable as a matrix
- Role changes take effect without re-issuing sessions
- The super admin's own interface stays stable and never looks like a tenant's
- Keep ADR-005's caching posture and `proxy.ts` limits unchanged

## Considered options

1. **A discriminated request context (`platform` or `tenant`) loaded from the database per request, one `authorize()` helper, and the platform default design on the chrome for platform scope.**
2. **Super admin as a tenant role** (`roles: ['super_admin']` inside a normal tenant context, switching `tenantId` to act on other tenants).
3. **Platform scope that adopts the viewed tenant's design** on the whole chrome while a super admin is on that tenant's pages.

## Decision outcome

**Chosen option:** option 1, because a separate scope cannot be confused with a tenant membership, a single helper makes every permission visible in one test, and keeping the chrome on the default design (D-25) always shows the super admin who they are acting as.

- **Context shape:** `{ scope: 'tenant', tenantId, userId, roles, locale }` or `{ scope: 'platform', userId, roles: ['super_admin'], locale }`. A user with `platform_role = 'super_admin'` always gets platform scope.
- **Session:** the development cookie carries only `{ userId, tenantId | null, iat }` (signature and dev-only rules of D-12 unchanged). The server loads the user, platform role and membership from Postgres on every request. A deleted user or a removed membership yields no context on the next request.
- **Authorization:** `authorize(ctx, tenantId, action)` is called by every route handler and server action before data access. Tenant scope is allowed only for its own `tenantId`, and only for the actions its role permits (`agent`: read-only). Platform scope is allowed for every action. A refusal throws `ForbiddenError` (HTTP 403). Database row-level security (ADR-012) receives the same scope, so the database enforces it too.
- **Data access:** functions in `src/data/**` keep `tenantId` first; platform-only functions live in `src/data/platform/**` and take a platform context first (lint rule `data-access-tenant-first`, extended).
- **Chrome (D-25):** platform scope always emits the platform default variables on `:root`. A tenant's design appears only inside a labelled preview container, styled by a nonce'd rule scoped to `[data-tenant-preview="<tenantId>"]`, and in the widget preview frame. Tenant scope keeps D-20: the full chrome uses the tenant's published theme.
- **Routing:** platform users are redirected from tenant routes (`/`, `/settings/**`) to `/platform`; tenant users get 404 on `/platform/**`.
- **Unchanged from ADR-005:** `server-only` request context, no module-level tenant state, `proxy.ts` only routes and sets the nonce, `cacheComponents: false`, `private, no-store` on authenticated HTML, `qk(tenantId, …)` query keys.

### Consequences

- Good: Every permission is in one function and one test matrix.
- Good: Roles live in the database, so revoking access needs no cookie rotation.
- Good: A super admin can never mistake the dashboard for a tenant's, because the chrome never changes.
- Bad: One database read per request to build the context; acceptable locally, and a production session adapter may cache it per session.
- Bad: The super admin sees a tenant's dashboard design only in the preview area, not on real pages.
- Neutral / follow-ups: The production session adapter (real login) replaces the development cookie behind the same context shape. An audit log for super-admin changes is a follow-up.

## Verification

<!-- verification -->

To be filled by P2.1: the authorization matrix test (P2.1-AC04), default-chrome and scoped-preview tests (P2.1-AC05, P2.1-AC06), routing tests (P2.1-AC08), role-change test (P2.1-AC09), and the P1.6 isolation tests (T-04) still green on Postgres.

<!-- /verification -->

## Links

- Supersedes: ADR-005 (on acceptance; ADR-005's status line then reads "Superseded by ADR-013")
- Related: ADR-012 (local data backend)
- Spec: `SPECS/phases/P2.1-tenant-data-backend-and-platform-scope.md`
- Evidence: `SPECS/evidence/P2.1.md`

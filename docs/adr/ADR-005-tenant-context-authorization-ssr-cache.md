# ADR-005: Tenant context, authorization boundary and SSR cache rules

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Accepted (P1.6, 2026-11-07, Madhusudan C P)                           |
| Date     | 2026-11-07                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §9; D-12, D-20                                               |

## Context and problem statement

The dashboard renders tenant-specific themes during SSR in a shared Node process. A cache or singleton mistake would show one tenant the data or theme of another.

## Decision drivers

- No cross-tenant leakage
- Authorization stays with the backend
- A development session that lets SSR theming be built before real auth exists

## Considered options

1. Explicit request context with Cache Components off in Phase 1
2. Enable Cache Components with per-tenant keys from the start

## Decision outcome

**Chosen option:** Proposed: option 1, accepted at P1.6 once the two-tenant isolation test exists.

- `getRequestContext()` in a `server-only` module; a signed development session cookie adapter that refuses to load in production (D-12).
- Data-access functions take `tenantId` explicitly; the backend API is the authorization boundary; `proxy.ts` only checks cookie presence, redirects and sets the nonce.
- `cacheComponents: false`; authenticated HTML is `Cache-Control: private, no-store`; `use cache` only behind the lint rule and isolation test.
- The root layout emits the full resolved tenant theme in one nonce-bearing style tag (D-20).

### Consequences

- Good: Isolation is testable with two tenants in one process
- Bad: No caching of authenticated routes in Phase 1
- Neutral: The production session adapter is a later ADR.

## Verification

<!-- verification -->

P1.6 on 2026-11-07, branch `p1.6-themed-vertical-slice`. Evidence: `SPECS/evidence/P1.6.md`. Accepted by the product owner with P1.6 on 2026-11-07.

**Tenant context.** `getRequestContext()` (`src/server/request-context.ts`, `server-only`) derives `{ tenantId, userId, roles, locale }` from the session on every request; pages redirect to `/dev/session` without one, route handlers answer 401. No module-level state holds tenant data. In development the session is the signed `dev-session` cookie (HMAC-SHA256, D-12); the dev adapter throws if it is ever loaded in production and is only loaded with `await import()` behind `isDevOnly()`. The production adapter is a placeholder: no sessions, so authenticated pages fail closed.

**Authorization boundary.** The backend authorizes (Phase 1 has none; the data-access stub stands in). `proxy.ts` only routes: it checks that a session cookie is present, adds a per-request nonce header and `Cache-Control: private, no-store`, and imports nothing but `next/server` and `src/server/proxy-allowlist.ts` (lint rule `byteflock/proxy-allowlist`). It never verifies the cookie or reads data. Every data-access function in `src/data/**` takes `tenantId` first (rule `byteflock/data-access-tenant-first`).

**SSR theme (D-20).** The root layout resolves the tenant's published theme after full validation and emits one nonce'd `<style>` with all 18 resolved variables; `system` tenants also get the dark block under `prefers-color-scheme: dark`. A theme that fails validation falls back to the platform defaults at the data layer, with a development-only banner (T-03).

**Caching posture.** `cacheComponents: false`; every authenticated segment exports `dynamic = 'force-dynamic'`; route handlers send `private, no-store`; `/healthz` sends `no-store`. Rule `byteflock/no-request-apis-in-cached-scope` forbids `cookies()`, `headers()` and `next/headers` in any file with a `"use cache"` directive. `next dev` always sends `no-store` for pages; production sends Next's `private, no-cache, no-store, max-age=0, must-revalidate` for dynamic pages.

**State ownership.** TanStack Query 5: one `QueryClient` per server request (`React.cache`) and one per browser session; the editor prefetches on the server and hydrates with `HydrationBoundary`. Keys come only from `qk(tenantId, …)` (rule `byteflock/qk-only`), so cached data always carries its tenant.

**Verified by:** T-04 (two tenants rendered in sequence in one process, the third render equals the first), T-03 (malicious stored theme renders the defaults), header tests, the production-build test (no `/dev/session`), the publish and rollback unit tests, and the four rule tests (`tools/eslint-byteflock`).

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

# ADR-005: Tenant context, authorization boundary and SSR cache rules

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Proposed                                                              |
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

To be filled by P1.6-T10.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

# ADR-007: Widget conversation isolation, loader and bridge

|          |                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Status   | Proposed                                                                                                           |
| Date     | 2026-11-07                                                                                                         |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer)                                              |
| Source   | ARCH-001 §10, Appendix A, Appendix C; SPECS/contracts/bridge-protocol-v1.md, public-endpoints-and-headers.md; D-21 |

## Context and problem statement

Conversation content must be confidential from JavaScript on the tenant host page (PO-010), while the widget must survive hostile CSS and strict customer CSPs.

## Decision drivers

- Confidentiality by origin boundary
- Two-directive customer CSP
- Safe failure on unsupported or hostile hosts

## Considered options

1. Hybrid: framework-free launcher on the host page plus a Lit frame on the platform origin
2. Shadow DOM widget on the host page
3. Full iframe including the launcher

## Decision outcome

**Chosen option:** Proposed: the hybrid, accepted when PoC-A passes ARCH-001 §17.1.

- Loader and launcher are plain TypeScript with no network, no `innerHTML` and no storage; the frame fetches config and theme from its own origin.
- Bridge protocol v1 as in BRIDGE-01 to BRIDGE-09; production mode ignores theme messages; preview mode accepts them only from the dashboard origin.
- Frame headers, sandbox attribute and the two-directive customer CSP as in ENDP-03 to ENDP-05.
- Amended by D-21: each widget key carries `allowedOrigins`; the frame refuses to bootstrap on unlisted parents. `frame-ancestors *` stays because one static document serves every key.

### Consequences

- Good: Host-page scripts cannot read conversation DOM
- Bad: Screenshot-based session tools can still capture pixels
- Neutral: Residual risks T-13 and screenshot recording to be signed at PoC-A; T-05 is mitigated in P1.5 by D-21.

## Verification

<!-- verification -->

To be filled by PoC-A-T13, then P1.5-T11.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

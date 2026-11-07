# ADR-002: Application and library boundaries

|          |                                                                         |
| -------- | ----------------------------------------------------------------------- |
| Status   | Accepted                                                                |
| Date     | 2026-11-07                                                              |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer)   |
| Source   | ARCH-001 §6.1-§6.3; SPECS/contracts/boundary-rules.md; D-03, D-04, D-16 |

## Context and problem statement

React must never reach widget bundles, Lit must never reach the dashboard, and shared libraries must stay framework-neutral where they define contracts. These rules must be decided before generators run, because tags shape every generator call.

## Decision drivers

- Prevent framework leakage into the host-page widget
- Keep the theme contract framework-neutral
- Mechanical enforcement instead of review vigilance

## Considered options

1. Three tag dimensions (type, scope, platform) with module-boundary constraints and restricted imports
2. Folder conventions only
3. Separate repositories per deployable

## Decision outcome

**Chosen option:** Option 1, because lint can enforce it on every PR and Nx supports it natively.

- Eight day-one projects: `admin-dashboard`, `admin-dashboard-e2e`, `widget`, `widget-playground`, `design-tokens`, `theme`, `ui-react`, `chat-widget` (D-16), under `apps/` and `libs/` (D-03).
- Tags `type:app|lib`, `scope:dashboard|widget|shared`, `platform:react|lit|neutral`, exactly one per dimension per project.
- Constraints and restricted imports exactly as in `SPECS/contracts/boundary-rules.md` BOUND-02 and BOUND-03.
- New projects only when a trigger in ARCH-001 §6.1 fires (BOUND-06).

### Consequences

- Good: Leakage becomes a lint error, not a production incident
- Bad: Per-tag ESLint fragments add configuration to maintain
- Neutral: The template web app and its e2e project are renamed rather than regenerated (D-04).

## Verification

<!-- verification -->

To be filled by P1.1-T11: final tag table and constraint block pasted here.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

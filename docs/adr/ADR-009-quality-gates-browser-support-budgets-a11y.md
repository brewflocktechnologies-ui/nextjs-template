# ADR-009: Quality gates, browser support, budgets and accessibility

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Accepted                                                              |
| Date     | 2026-11-07                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §14                                                          |

## Context and problem statement

Phase 1 delivers a foundation that later features build on; its gates must tighten as each part exists, with budgets derived from measurement rather than guesses.

## Decision drivers

- Gates become blocking exactly when the thing they check exists
- Budgets from measured baselines
- Accessibility as a merge condition

## Considered options

1. Staged gates per ARCH-001 §14.2 with measured budgets
2. All gates blocking from day one
3. Gates advisory until Phase 1 exit

## Decision outcome

**Chosen option:** Option 1.

- Gate schedule as in ARCH-001 §14.2 and the phase specs.
- WCAG 2.2 AA. Dashboard and frame target Baseline Widely Available browsers; the launcher must never break an unsupported host.
- Budgets equal the PoC-A baseline plus 15 percent, ratcheted down on each reduction; raising one needs `BUDGET-EXCEPTION:`.

### Consequences

- Good: No gate blocks work before it can pass
- Bad: Early phases rely more on review
- Neutral: Moderate axe findings and visual regression become blocking at P1.7.

## Verification

<!-- verification -->

To be filled by P1.5-T11 records budgets; P1.7 reviews.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

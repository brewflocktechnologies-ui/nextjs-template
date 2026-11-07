# ADR-010: AI-DLC and specification governance

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Accepted                                                              |
| Date     | 2026-11-07                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §15; D-09                                                    |

## Context and problem statement

AI agents implement most of Phase 1 under human review. Decisions, specs and contracts must not drift silently.

## Decision drivers

- Human approval before AI implementation
- Mechanical controls over prose rules
- Evidence instead of claims

## Considered options

1. Three gates with phase specs, evidence files and CI policy checks
2. Free-form tickets

## Decision outcome

**Chosen option:** Option 1.

- `AGENTS.md` is canonical; `CLAUDE.md` imports it.
- Specs live in `SPECS/` for Phase 1 (D-09); OpenSpec adoption is decided at the P1.7 retrospective.
- Gates: G1 architecture and ADRs, G2 phase spec approval in `SPECS/STATUS.md`, G3 PR review with evidence.
- CI policy checks: pinned actions, ADR immutability and CODEOWNERS from P1.0; contract diff from P1.3; dependency diff and test-count ratchet from P1.7.

### Consequences

- Good: A phase cannot start or finish without a human decision on record
- Bad: More paperwork per phase
- Neutral: The format is reviewed in the P1.7 retrospective.

## Verification

<!-- verification -->

**P1.7 review (2026-11-07).** The workflow held for all of Phase 1: no phase started without product-owner approval in `SPECS/STATUS.md`, agents never set `Approved` or `Accepted`, and every phase has an evidence file with commands, negative runs and deviations. ADR immutability, contract-change, dependency-diff and test-count controls are mechanical (`pnpm policy:check`). The retrospective is `docs/architecture/retrospective-phase-1.md`; it recommends keeping `SPECS/` instead of adopting the OpenSpec layout (D-09) and proposes six changes to `SPECS/00-conventions.md` for Phase 2, pending discussion with the product owner.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

# ADR-011: Dependency and supply-chain policy

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Accepted                                                              |
| Date     | 2026-11-07                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §13 T-09, §18; D-02                                          |

## Context and problem statement

The widget runs on customer pages, so a compromised dependency would reach customers directly. The repository becomes open source after launch.

## Decision drivers

- Delay adoption of freshly published packages
- Allowlist install scripts
- Pinned CI actions
- Licence compatibility for an open-source release

## Considered options

1. pnpm 11 settings plus Renovate cooldown and SHA-pinned actions
2. npm with ignore-scripts and manual review

## Decision outcome

**Chosen option:** Option 1 (D-02).

- pnpm 11 with `minimumReleaseAge: 10080` (7 days), `strictDepBuilds: true`, an explicit `allowBuilds` list, and `--frozen-lockfile` in CI.
- Renovate with a 7-day `minimumReleaseAge` and digest pinning for GitHub Actions.
- Every `uses:` in workflows pinned to a 40-character commit SHA with a version comment.
- One sentence per new dependency in the PR; licence allowlist MIT, BSD, Apache-2.0, ISC, 0BSD, others need `LICENSE-EXCEPTION:` (enforced from P1.7).

### Consequences

- Good: A malicious release has a week to be caught before it can land
- Bad: Urgent security fixes may need a manual override of the cooldown
- Neutral: OIDC for deployments is added when deployments exist.

## Verification

<!-- verification -->

To be filled by P1.1-T11: final `pnpm-workspace.yaml` settings pasted here.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

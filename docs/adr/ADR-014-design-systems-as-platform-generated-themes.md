# ADR-014: Independent design systems as platform-generated themes

|          |                                                                                        |
| -------- | -------------------------------------------------------------------------------------- |
| Status   | Accepted                                                                               |
| Date     | 2026-11-14                                                                             |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer)                  |
| Source   | ARCH-001 §7, §8, §13 T-03; SPECS/DECISIONS.md D-30; `docs/architecture/design-tokens/` |

## Context and problem statement

ADR-004 limits tenant themes to `theme.v1`: 13 colour roles in two appearances plus enumerated presets, so that tenant input can never become CSS (threat T-03). The product now needs independent Figma design systems (a platform default and four tenant systems today, more later), each with its own primitive, semantic and component tokens and light and dark modes, delivered to the dashboard and the widget and shareable between tenants. The question is how such design systems become runtime themes without giving up T-03's guarantee.

## Decision drivers

- No tenant- or file-supplied text ever reaches a stylesheet (T-03).
- Shared components stay unchanged and tenant-agnostic.
- Any number of themes without code or configuration changes.
- DTCG information is preserved; every lossy conversion is reported and approved.

## Considered options

1. Platform-generated themes from typed tokens: DTCG design systems validated, mapped onto a platform semantic contract and serialised by the platform from canonical typed values.
2. Widen `theme.v1` with typed fields (typography, spacing, shadow): keeps ADR-004 but cannot hold an independent design system or share it between tenants.
3. Accept tenant CSS files: simple, but breaks T-03 and hands tenants arbitrary selectors.

## Decision outcome

**Chosen option:** option 1, because it supports independent, shareable design systems while keeping injection impossible by construction: neither names nor values are ever copied from input.

- Variable names come only from the platform semantic contract (`--sem-*`, `SPECS/contracts/platform-semantic-v1.md`) and the extension grammar `--ext-<themeId>-<name>`.
- Values are re-serialised from canonical typed values: colours as hex, dimensions as a number plus an allow-listed unit, numbers, shadow layers, font families from the platform font registry. The resolver's existing output tests (no `url(`, `expression(`, `;`, braces, angle brackets, newlines) apply to every artifact.
- Artifacts are immutable, versioned, approved by a person and assigned to tenants through the registry (ADR-015).
- `theme.v1` remains a supported source format (`theme-v1`), so the theme editor and existing tenant data keep working; publishing from the editor creates a new version of the tenant's own theme (D-30).
- When accepted, this ADR supersedes ADR-004's grammar decision (THEME-01 rule 1 and THEME-02 as the only tenant theme format). ADR-004's lifecycle, immutability, contrast policy and resolver allow-list stay in force.

### Consequences

- Good: unlimited themes, sharing between tenants, full design systems, no component changes for onboarding.
- Bad: a second theme path exists until `theme.v1` is only a source format; platform-scoped registry tables need a reasoned RLS exception.
- Neutral / follow-ups: the contract, not the tenant, decides which tokens shared components can read; ADR-004 gets a "Superseded by ADR-014" link only when this ADR is accepted.

## Verification

<!-- verification -->

To be filled by P2.4 (generator) and P2.6 (registry): malicious-fixture suite over DTCG sources (CSS in names, descriptions, values, extensions), property test over random valid tokens, platform-default equivalence test, two-tenant isolation test with a shared theme.

<!-- /verification -->

## Links

- Supersedes (when accepted): ADR-004, grammar decision only
- Related: ADR-015, ADR-016, ADR-017
- Architecture: `docs/architecture/design-tokens/design-token-target-architecture.md`
- Evidence: `SPECS/evidence/P2.4.md`, `SPECS/evidence/P2.6.md`

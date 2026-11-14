# ADR-017: One shared Tailwind v4 mapping

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Proposed                                                              |
| Date     | 2026-11-14                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | SPECS/DECISIONS.md D-30; ADR-003, ADR-006                             |

## Context and problem statement

With any number of themes, utilities must stay identical for every tenant, and Tailwind CSS v4 (4.3.3) must remain the only utility framework. The repository already generates one `@theme inline` block (`libs/ui-react/src/generated/shadcn-bridge.css`, from `src/theme/shadcn-map.json`) mapping utilities onto `--sem-*`. The question is whether themes may add Tailwind configuration of their own.

## Decision drivers

- No Tailwind configuration per tenant or theme; no other utility framework.
- Onboarding a theme never changes styling code.
- Runtime theme values through CSS custom properties.

## Considered options

1. Keep the one generated bridge; themes supply only variable values.
2. Generate a Tailwind `@theme` block per theme (as Design Token Kit's CLI can).

## Decision outcome

**Chosen option:** option 1, because Tailwind's `@theme inline` makes utilities use the referenced variable (documented for variables that reference other variables, tailwindcss.com/docs/theme), so one mapping serves every theme, and per-theme blocks would duplicate it.

- `shadcn-bridge.css` stays the only utility mapping and references only `--sem-*`.
- Theme artifacts never contain `@theme`, utilities or selectors beyond the platform's own blocks.
- A new utility needs a contract token first, then a `shadcn-map.json` entry.
- The widget keeps plain Lit styles reading `--sem-*`; Tailwind is not used inside its shadow roots.

### Consequences

- Good: onboarding never touches Tailwind; utilities behave the same for every tenant.
- Bad: designers cannot add utilities through tokens; extensions are read only by opted-in surfaces.
- Neutral / follow-ups: no Tailwind upgrade (4.3.5 is out) without approval.

## Verification

<!-- verification -->

To be filled by P2.10: the bridge's stale check stays green while themes are added; a lint rule stops shared components from reading `--ext-*`.

<!-- /verification -->

## Links

- Related: ADR-003, ADR-006, ADR-014
- Evidence: `SPECS/evidence/P2.10.md`

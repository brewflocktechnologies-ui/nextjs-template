# ADR-003: Token source and build

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Accepted                                                              |
| Date     | 2026-11-07                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §7                                                           |

## Context and problem statement

The dashboard and the widget frame must render from the same semantic design vocabulary, while tenants only ever influence semantic values through the theme contract.

## Decision drivers

- A single framework-neutral source of truth
- Deterministic, reviewable outputs
- Standard format that design tools can read

## Considered options

1. DTCG 2025.10 subset built with Style Dictionary 5 into committed outputs
2. Hand-written CSS variables
3. Tailwind theme as the source

## Decision outcome

**Chosen option:** Option 1, because DTCG is the first stable token format and Style Dictionary reads it natively.

- DTCG 2025.10 using only `$value`, `$type`, `$description`, `$deprecated`, `$extensions`; the Resolver module is not used.
- Style Dictionary 5 pinned to an exact version; outputs `css/semantic.css`, `ts/tokens.ts`, JSON fixtures; generated files committed with a CI stale check.
- Layers: primitives (private) → semantic `--sem-<category>-<role>[-<state>]` → component tokens (deferred). Components bind only to `--sem-*`.
- Light and dark are two semantic sets in one CSS file, selected by `data-appearance` (P1.2 spec).

### Consequences

- Good: Tenant input never reaches primitive tokens
- Bad: Style Dictionary support for DTCG 2025.10 is reported partial; the used subset must be confirmed
- Neutral: Component tokens are deferred until a component needs one.

## Verification

<!-- verification -->

To be filled by P1.2-T06: Style Dictionary version, DTCG features confirmed, outputs list.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

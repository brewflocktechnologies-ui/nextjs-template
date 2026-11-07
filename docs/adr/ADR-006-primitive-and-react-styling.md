# ADR-006: Primitive library and React styling

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Proposed                                                              |
| Date     | 2026-11-07                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §11                                                          |

## Context and problem statement

The dashboard needs accessible complex primitives (combobox, multi-select, nested dialogs, data tables) that work under a nonce-only style CSP and are themed only through semantic tokens.

## Decision drivers

- Native coverage of the hard components
- Nonce-only CSP support
- AI agents produce correct code with few corrections

## Considered options

1. Base UI through shadcn
2. Radix through shadcn

## Decision outcome

**Chosen option:** Proposed: Base UI preferred, decided by PoC-B.

- shadcn components generated on the chosen primitive inside `ui-react`.
- Tailwind CSS 4 with a generated `shadcn-bridge.css` mapping shadcn variables to `--sem-*` inside `@theme inline`.
- `@radix-ui/*` imports are banned unless this ADR selects Radix.

### Consequences

- Good: Semantic tokens own the variable names; shadcn never leaks into Lit
- Bad: Agents know Radix better; mitigated by the import ban and AGENTS.md
- Neutral: Acceptance waits for PoC-B.

## Verification

<!-- verification -->

To be filled by PoC-B-T12.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

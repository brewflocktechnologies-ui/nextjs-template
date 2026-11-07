# ADR-004: Theme contract, grammar and lifecycle

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Proposed                                                              |
| Date     | 2026-11-07                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §8, Appendix B; SPECS/contracts/theme-contract-v1.md; D-20   |

## Context and problem statement

Tenants customise the widget and the dashboard. Their input crosses into SSR style tags and the widget frame, so it must be typed, bounded and validated identically by the frontend and the future Java backend.

## Decision drivers

- No free-text CSS from tenants
- One schema shared byte-for-byte with the backend
- Small validation footprint in the widget frame

## Considered options

1. TypeBox 0.34 as the schema source emitting JSON Schema 2020-12
2. Zod 4 with `toJSONSchema`
3. Hand-written JSON Schema plus separate TypeScript types

## Decision outcome

**Chosen option:** Proposed: TypeBox 0.34 with Zod 4 as the recorded fallback, decided by PoC-C on day one of P1.3.

- Grammar and field list exactly as THEME-01 and THEME-02; `additionalProperties: false` everywhere; curated font ids; enums for shape, elevation, density and scale.
- Pure resolver to an allow-listed set of `--sem-*` keys; a hand-written shape guard in the frame.
- Contrast policy enforced at publish time, extended with dashboard pairs because the tenant theme styles the full dashboard (D-20).
- Lifecycle Draft → Preview → Validate → Publish → Rollback; theme documents are immutable and published before the config pointer moves.

### Consequences

- Good: Injection is impossible by construction rather than by escaping
- Bad: Every new tenant-facing option needs a schema change with a contract-change trailer
- Neutral: Acceptance waits for PoC-C.

## Verification

<!-- verification -->

To be filled by P1.3-T14: PoC-C outcome, chosen library and version.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

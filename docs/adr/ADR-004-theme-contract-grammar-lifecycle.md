# ADR-004: Theme contract, grammar and lifecycle

|          |                                                                                 |
| -------- | ------------------------------------------------------------------------------- |
| Status   | Proposed (PoC-C passed with TypeBox; awaiting product-owner acceptance of P1.3) |
| Date     | 2026-11-07                                                                      |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer)           |
| Source   | ARCH-001 §8, Appendix B; SPECS/contracts/theme-contract-v1.md; D-20             |

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

P1.3 on 2026-11-07, branch `p1.3-theme-contract`. Evidence: `SPECS/evidence/P1.3.md`. Status stays **Proposed** until the product owner accepts P1.3.

**PoC-C result: TypeBox 0.34.52 is chosen.** Zod 4 was not tried, because the friction threshold (more than two non-trivial workarounds, or an emitted schema that differs from Appendix B) was not reached.

| PoC-C check                                                               | Result                                                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| THEME-02 authored in TypeBox, JSON Schema 2020-12 emitted                 | yes: `libs/theme/schema/theme.v1.json`, `additionalProperties: false` on all 9 objects |
| Same outcome in TypeBox and in Ajv 8.20 (Draft 2020-12) for every fixture | yes: 5 valid accepted, 8 invalid and 8 malicious rejected by both                      |
| Guard + resolver size for the frame                                       | 970 B (guard) and 889 B (resolver) gzip, without TypeBox                               |

TypeBox workarounds (two, both minor):

1. A typed helper for unions of string literals. The first attempt typed every enum field as `unknown`; this was caught by typecheck and fixed.
2. Contract constants live in a separate TypeBox-free file, so the frame entries do not pull TypeBox in. TypeBox `Type.*` values cannot be imported for their data alone.

Decisions recorded with the implementation:

- Validation uses TypeBox's `Value` API (no code generation) so it runs under the dashboard's CSP; the faster compiled validator can be added server-side later if needed.
- The resolver emits 18 allow-listed variables (THEME-11); `--sem-elevation-surface` was added to the design tokens for the tenant's elevation choice.
- The contrast policy includes the D-20 dashboard pairs. The Initech fixture's `onAccent` was darkened to pass (3.77:1 → about 5.6:1); the tenant's accent colour is unchanged.
- The guard rejects prototype-pollution keys at any depth.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

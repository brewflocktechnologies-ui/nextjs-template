# Phase status board

States: `Not started` → `Approved` → `In progress` → `Implemented` → `Verified` → `Validated` → `Accepted` (also `Blocked`, `Deferred`). See `00-conventions.md`.

**Rule:** a phase moves to `Approved` only by the product owner writing their name and the date in the Approval column. Agents never set `Approved` or `Accepted`.

| Spec    | State       | Approval (name, date)      | Started    | Evidence                               | Accepted (name, date)      | Notes                                                                                                                           |
| ------- | ----------- | -------------------------- | ---------- | -------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| P0      | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P0.md](evidence/P0.md)       | Madhusudan C P, 2026-11-07 | D-02 migrate, D-06 byteflock, Q-013 full theme, Q-014 allowlist, Q-015 idle                                                     |
| P1.0    | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P1.0.md](evidence/P1.0.md)   | Madhusudan C P, 2026-11-07 | GitHub items deferred (D-22)                                                                                                    |
| P1.1    | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P1.1.md](evidence/P1.1.md)   | Madhusudan C P, 2026-11-07 | Verified locally (D-22); manual step results not recorded                                                                       |
| PoC-A   | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/POC-A.md](evidence/POC-A.md) | Madhusudan C P, 2026-11-07 | Verified locally (D-22); manual step results not recorded                                                                       |
| P1.2    | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P1.2.md](evidence/P1.2.md)   | Madhusudan C P, 2026-11-07 | Verified locally (D-22); manual step results not recorded                                                                       |
| P1.3    | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P1.3.md](evidence/P1.3.md)   | Madhusudan C P, 2026-11-07 | Verified locally (D-22); manual step results not recorded                                                                       |
| PoC-B   | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/POC-B.md](evidence/POC-B.md) | Madhusudan C P, 2026-11-07 | Verified locally (D-22); manual step results not recorded                                                                       |
| P1.4    | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P1.4.md](evidence/P1.4.md)   | Madhusudan C P, 2026-11-07 | Verified locally (D-22); manual step results not recorded                                                                       |
| P1.5    | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P1.5.md](evidence/P1.5.md)   | Madhusudan C P, 2026-11-07 | Verified locally (D-22); frame JS budget exception accepted                                                                     |
| P1.6    | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P1.6.md](evidence/P1.6.md)   | Madhusudan C P, 2026-11-07 | Verified locally (D-22); manual step results not recorded                                                                       |
| P1.7    | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P1.7.md](evidence/P1.7.md)   | Madhusudan C P, 2026-11-07 | Verified locally (D-22); CI, nightly and ARCH v1.0 still open for P1 exit                                                       |
| P1 exit | In progress |                            |            |                                        |                            | Open: CI green on Linux and Windows (D-22), nightly run, ARCH-001 v1.0 (owner); see evidence/P1-exit.md                         |
| P2.1    | In progress | Madhusudan C P, 2026-11-11 | 2026-11-11 | [evidence/P2.1.md](evidence/P2.1.md)   |                            | D-24, D-25; open questions take the spec defaults                                                                               |
| P2.2    | Approved    | Madhusudan C P, 2026-11-14 |            |                                        |                            | Spec drafted 2026-11-13 (import layer A); implementation reverted 2026-11-14 at the owner's request; re-scoped into P2.7 (D-30) |
| P2.3    | Not started |                            |            |                                        |                            | Spec drafted 2026-11-13 (import layer B); re-scoped into P2.7 (D-30)                                                            |
| P2.4    | Accepted    | Madhusudan C P, 2026-11-14 | 2026-11-14 | [evidence/P2.4.md](evidence/P2.4.md)   | Madhusudan C P, 2026-11-14 | Accepted on the owner's instruction before independent verification and manual validation (recorded in the evidence)            |
| P2.5    | Not started |                            |            |                                        |                            | Spec drafted 2026-11-14; Needs the Figma (Design Token Kit) exports                                                             |
| P2.6    | Not started |                            |            |                                        |                            | Spec drafted 2026-11-14; D-30; needs ADR-015 accepted                                                                           |
| P2.7    | Not started |                            |            |                                        |                            | Spec drafted 2026-11-14; Re-scoped P2.2 and P2.3; depends on P2.6                                                               |
| P2.8    | Not started |                            |            |                                        |                            | Spec drafted 2026-11-14; Depends on P2.6                                                                                        |
| P2.9    | Not started |                            |            |                                        |                            | Spec drafted 2026-11-14; Depends on P2.6                                                                                        |
| P2.10   | Not started |                            |            |                                        |                            | Spec drafted 2026-11-14; Depends on P2.8, P2.9                                                                                  |

## Product-owner answers to open questions

Record here when answered; otherwise the defaults in `DECISIONS.md` apply.

| Question                        | Answer                                                                                        | Date       | Affects              |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ---------- | -------------------- |
| D-02 (pnpm migration)           | Migrate to pnpm 11                                                                            | 2026-11-07 | P1.1                 |
| D-06 (brand / package scope)    | `byteflock` (`@byteflock/*`, `byteflock-chat-v1`, `window.ByteflockChat`); rename is P1.1-T00 | 2026-11-07 | P1.1 and all later   |
| Q-013 (dashboard theming scope) | Full tenant theme on the dashboard chrome (D-20)                                              | 2026-11-07 | THEME-06, P1.6       |
| Q-014 (domain allowlist)        | Yes, per-widgetKey `allowedOrigins` in Phase 1 (D-21)                                         | 2026-11-07 | ENDP-02a, P1.5, P1.6 |
| Q-015 (proactive messaging)     | Yes, frame created hidden at idle (default confirmed)                                         | 2026-11-07 | PoC-A, P1.5          |

## ADR status tracker

| ADR     | Title                                                   | Status                                                            | Set by phase               |
| ------- | ------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------- |
| ADR-001 | Nx + pnpm workspace and toolchain                       | Accepted (P0, 2026-11-07)                                         | P0 accepts, P1.1 verifies  |
| ADR-002 | Application and library boundaries                      | Accepted (P0, 2026-11-07)                                         | P0 accepts, P1.1 verifies  |
| ADR-003 | Token source and build                                  | Accepted (P0, 2026-11-07); verified at P1.2                       | P1.2 verified              |
| ADR-004 | Theme contract, grammar, lifecycle                      | Accepted (P1.3, 2026-11-07): TypeBox                              | P1.3 accepts (after PoC-C) |
| ADR-005 | Tenant context, authorization boundary, SSR cache rules | Accepted (P1.6, 2026-11-07)                                       | P1.6 accepts               |
| ADR-006 | Primitive and React styling                             | Accepted (PoC-B, 2026-11-07): Base UI                             | PoC-B                      |
| ADR-007 | Widget conversation isolation, loader and bridge        | Accepted (PoC-A, 2026-11-07); hardened in P1.5                    | PoC-A; P1.5 hardens        |
| ADR-008 | Storybook and component testing                         | Accepted (P0, 2026-11-07)                                         | P1.4 / P1.5 add notes      |
| ADR-009 | Quality gates, browser support, budgets, accessibility  | Accepted (P0, 2026-11-07)                                         | P1.5 budgets, P1.7 reviews |
| ADR-010 | AI-DLC and specification governance                     | Accepted (P0, 2026-11-07)                                         | P1.7 reviews               |
| ADR-011 | Dependency and supply-chain policy                      | Accepted (P0, 2026-11-07)                                         | P1.1 verifies              |
| ADR-012 | Local data backend (Postgres in Docker)                 | Proposed (P2.1-T01, 2026-11-11)                                   | P2.1 accepts               |
| ADR-013 | Request scope, authorization helper, default chrome     | Proposed (P2.1-T01, 2026-11-11); supersedes ADR-005 on acceptance | P2.1 accepts               |

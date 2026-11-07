# Phase status board

States: `Not started` → `Approved` → `In progress` → `Implemented` → `Verified` → `Validated` → `Accepted` (also `Blocked`, `Deferred`). See `00-conventions.md`.

**Rule:** a phase moves to `Approved` only by the product owner writing their name and the date in the Approval column. Agents never set `Approved` or `Accepted`.

| Spec    | State       | Approval (name, date)      | Started    | Evidence                             | Accepted (name, date)      | Notes                                                                       |
| ------- | ----------- | -------------------------- | ---------- | ------------------------------------ | -------------------------- | --------------------------------------------------------------------------- |
| P0      | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P0.md](evidence/P0.md)     | Madhusudan C P, 2026-11-07 | D-02 migrate, D-06 byteflock, Q-013 full theme, Q-014 allowlist, Q-015 idle |
| P1.0    | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P1.0.md](evidence/P1.0.md) | Madhusudan C P, 2026-11-07 | GitHub items deferred (D-22)                                                |
| P1.1    | Accepted    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P1.1.md](evidence/P1.1.md) | Madhusudan C P, 2026-11-07 | Verified locally (D-22); manual step results not recorded                   |
| PoC-A   | Approved    | Madhusudan C P, 2026-11-07 |            |                                      |                            | Can run parallel to P1.2/P1.3                                               |
| P1.2    | Verified    | Madhusudan C P, 2026-11-07 | 2026-11-07 | [evidence/P1.2.md](evidence/P1.2.md) |                            | Verified locally (D-22); manual check: preview page                         |
| P1.3    | Not started |                            |            |                                      |                            | Includes PoC-C (day 1)                                                      |
| PoC-B   | Approved    | Madhusudan C P, 2026-11-07 |            |                                      |                            | Can run parallel to PoC-A/P1.2                                              |
| P1.4    | Not started |                            |            |                                      |                            |                                                                             |
| P1.5    | Not started |                            |            |                                      |                            | Adds the domain allowlist (D-21)                                            |
| P1.6    | Not started |                            |            |                                      |                            | Full tenant theme (D-20); widget domain settings (D-21)                     |
| P1.7    | Not started |                            |            |                                      |                            |                                                                             |
| P1 exit | Not started |                            |            |                                      |                            | ARCH-001 v1.0 Accepted                                                      |

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

| ADR     | Title                                                   | Status                     | Set by phase                |
| ------- | ------------------------------------------------------- | -------------------------- | --------------------------- |
| ADR-001 | Nx + pnpm workspace and toolchain                       | Accepted (P0, 2026-11-07)  | P0 accepts, P1.1 verifies   |
| ADR-002 | Application and library boundaries                      | Accepted (P0, 2026-11-07)  | P0 accepts, P1.1 verifies   |
| ADR-003 | Token source and build                                  | Accepted (P0, 2026-11-07)  | P0 accepts, P1.2 verifies   |
| ADR-004 | Theme contract, grammar, lifecycle                      | Proposed                   | P1.3 accepts (after PoC-C)  |
| ADR-005 | Tenant context, authorization boundary, SSR cache rules | Proposed                   | P1.6 accepts                |
| ADR-006 | Primitive and React styling                             | Proposed                   | PoC-B accepts               |
| ADR-007 | Widget conversation isolation, loader and bridge        | Proposed (amended by D-21) | PoC-A accepts, P1.5 hardens |
| ADR-008 | Storybook and component testing                         | Accepted (P0, 2026-11-07)  | P1.4 / P1.5 add notes       |
| ADR-009 | Quality gates, browser support, budgets, accessibility  | Accepted (P0, 2026-11-07)  | P1.5 budgets, P1.7 reviews  |
| ADR-010 | AI-DLC and specification governance                     | Accepted (P0, 2026-11-07)  | P1.7 reviews                |
| ADR-011 | Dependency and supply-chain policy                      | Accepted (P0, 2026-11-07)  | P1.1 verifies               |

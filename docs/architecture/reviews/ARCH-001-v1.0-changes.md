# ARCH-001 v0.3 → v1.0: changes to fold in

P1.7-T10. The architecture owner produces v1.0; agents do not edit `ARCHITECTURE-001-saas-frontend-foundation.md` (AGENTS.md). This list collects everything Phase 1 decided or learned that v1.0 should state, with where each is recorded. When v1.0 is written, move v0.3 to `docs/architecture/reviews/` and sign §20.2.

## Product-owner answers (P0)

| Item  | v1.0 should say                                                                                           | Source               |
| ----- | --------------------------------------------------------------------------------------------------------- | -------------------- |
| Q-013 | The tenant theme styles the full dashboard chrome (§9.2 "if Q-013 is answered…" becomes the design)       | D-20, P1.6           |
| Q-014 | Per-widget-key `allowedOrigins` exists in Phase 1; T-05 is mitigated, not a residual (§13, §10)           | D-21, P1.5, ENDP-02a |
| Q-015 | The frame is created at idle by default (measured: about 1.3 s saved on open)                             | PoC-A, baselines.md  |
| Brand | Scope `@byteflock`, element prefix `byteflock-`, global `ByteflockChat` (replaces the `acme` placeholder) | D-06                 |

## Decisions that change the text

| Decision   | v1.0 should say                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| D-01       | The workspace started from the existing template, not `create-nx-workspace`                                          |
| D-02       | pnpm 11 (`minimumReleaseAge` 10080, `allowBuilds`) from P1.1                                                         |
| D-03, D-04 | `libs/` for libraries; `admin-dashboard` replaces `web`                                                              |
| D-05       | Nx 24.0.0, Next 16.4.3, TypeScript 6.0.3 (and the versions in ADR-001's verification block)                          |
| D-07       | Libraries are consumed from source (`exports` → `src/index.ts`, `workspace:*`, project references)                   |
| D-08       | No Nx Cloud; remote cache deferred with numbers (ADR-001, P1.7)                                                      |
| D-09       | `SPECS/` is the specification home; OpenSpec not adopted (retrospective) — replaces `openspec/` in §6.1 and §15.1    |
| D-10, D-11 | Local stack ports and tenants                                                                                        |
| D-12, D-13 | Dev session adapter and dev publish stub are the only development-only code                                          |
| D-15       | Widget build shape: loader, hashed launcher, frame (§10)                                                             |
| D-16       | Eight day-one projects (adds `admin-dashboard-e2e`) — §6.1 and exit item 1                                           |
| D-17       | CI: full set on Linux, widget build and smoke on Windows; plus the `visual` job (P1.7)                               |
| D-22       | Phase 1 was verified with the local gate `pnpm verify`; CI and branch protection start when the repository is pushed |
| D-23       | Committed generated files live under `src/generated/`                                                                |

## PoC outcomes

- **PoC-A (ADR-007 Accepted):** hybrid launcher + cross-origin Lit frame confirmed; Option C not needed. Launcher layout on a shadow-root wrapper; `launcherTheme.shape`; launcher served with `Access-Control-Allow-Origin: *`; residuals T-13 and screenshot recording signed.
- **PoC-B (ADR-006 Accepted):** shadcn on Base UI; Radix not used. CSP with nonces works through `CSPProvider`.
- **PoC-C (ADR-004 Accepted):** TypeBox 0.34; validation through the `Value` API (no `eval`); the frame uses a hand-written guard and a TypeBox-free resolver entry.

## Facts learned in implementation

- `theme.preview` cannot carry shadow values (BRIDGE-02 value grammar); the elevation variable is not previewed.
- The frame JS budget needed a recorded exception once the production frame existed (ADR-009).
- `next dev` always sends `Cache-Control: no-store` for pages; production sends `private, no-cache, no-store, …` (§9.1, exit item 5).
- Storybook's a11y addon cannot block by severity; all violations block (stricter than §14.2).
- Dashboard CSP: the nonce is in place on the theme style, but no CSP header is sent yet; a candidate for Phase 2.

## ADR statuses for §18

ADR-001 to ADR-011 are all Accepted (see `SPECS/STATUS.md`). None is superseded. ADR-009 and ADR-010 have P1.7 review sections in their verification blocks.

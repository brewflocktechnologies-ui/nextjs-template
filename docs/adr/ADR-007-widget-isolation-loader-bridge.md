# ADR-007: Widget conversation isolation, loader and bridge

|          |                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Status   | Proposed (PoC-A passed; awaiting residual-risk sign-off)                                                           |
| Date     | 2026-11-07                                                                                                         |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer)                                              |
| Source   | ARCH-001 §10, Appendix A, Appendix C; SPECS/contracts/bridge-protocol-v1.md, public-endpoints-and-headers.md; D-21 |

## Context and problem statement

Conversation content must be confidential from JavaScript on the tenant host page (PO-010), while the widget must survive hostile CSS and strict customer CSPs.

## Decision drivers

- Confidentiality by origin boundary
- Two-directive customer CSP
- Safe failure on unsupported or hostile hosts

## Considered options

1. Hybrid: framework-free launcher on the host page plus a Lit frame on the platform origin
2. Shadow DOM widget on the host page
3. Full iframe including the launcher

## Decision outcome

**Chosen option:** Proposed: the hybrid, accepted when PoC-A passes ARCH-001 §17.1.

- Loader and launcher are plain TypeScript with no network, no `innerHTML` and no storage; the frame fetches config and theme from its own origin.
- Bridge protocol v1 as in BRIDGE-01 to BRIDGE-09; production mode ignores theme messages; preview mode accepts them only from the dashboard origin.
- Frame headers, sandbox attribute and the two-directive customer CSP as in ENDP-03 to ENDP-05.
- Amended by D-21: each widget key carries `allowedOrigins`; the frame refuses to bootstrap on unlisted parents. `frame-ancestors *` stays because one static document serves every key.

### Consequences

- Good: Host-page scripts cannot read conversation DOM
- Bad: Screenshot-based session tools can still capture pixels
- Neutral: Residual risks T-13 and screenshot recording to be signed at PoC-A; T-05 is mitigated in P1.5 by D-21.

## Verification

<!-- verification -->

PoC-A on 2026-11-07, branch `poc-a-widget-isolation`. Evidence: `SPECS/evidence/POC-A.md`. Status stays **Proposed** until the product owner signs the residual risks below (ARCH-001 §20.2).

Results against ARCH-001 §17.1 (automated in `apps/widget-playground/src/tests`, run in Chromium, Firefox 153 and WebKit; Chromium also against the production build):

| #   | Criterion                                                                                                            | Result                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Hostile script cannot read composer text                                                                             | pass: `contentDocument` is null, `contentWindow.document` throws SecurityError, no key events reach the host        |
| 2   | rrweb snapshot contains no frame content                                                                             | pass                                                                                                                |
| 3   | Bridge negative cases dropped and counted                                                                            | pass (unit tests for origin and source; Playwright for envelope, type, payload, theme.preview in production, flood) |
| 4   | Two-directive customer CSP, Trusted Types enforced without a policy                                                  | pass                                                                                                                |
| 5   | Keyboard: Tab, Enter opens and focuses the composer, Esc closes and returns focus; accessible name with unread count | pass in all three engines (Firefox needed `window.focus()` in the frame)                                            |
| 6   | Mobile: full viewport, composer visible with a shrunken viewport                                                     | pass (keyboard approximated by resizing; real-device check is manual)                                               |
| 7   | Curated font in the frame; system font in the launcher under hostile typography                                      | pass                                                                                                                |
| 8   | Failure modes of §10.10                                                                                              | pass: frame blocked, config timeout, invalid theme, unsupported version, missing config, re-mount once              |
| 9   | Two instances themed independently                                                                                   | pass                                                                                                                |
| 10  | Measurements recorded                                                                                                | `docs/architecture/baselines.md`                                                                                    |
| 11  | Frame headers, sandbox, COOP with postMessage                                                                        | pass                                                                                                                |

Decisions taken during the PoC, now part of this ADR's design:

- The launcher keeps all layout on a wrapper inside its shadow root: host-page `!important` rules can reach the host element but not the wrapper.
- `launcherTheme` carries `shape` (circle or pill), added to BRIDGE-02.
- The launcher module is served with `Access-Control-Allow-Origin: *` because it is imported as a module from the customer's page.
- The launcher, not the frame, chooses panel or full-screen layout from the host viewport.
- Q-015: the frame is created at idle by default; measured cost of creating it on first open is about 1.3 s on the slow profile.
- Option C (launcher inside the frame) was not needed: criteria 5 and 6 pass with the hybrid.

Residual risks for sign-off:

- **T-13** A host page can cover or restyle the launcher's host element (for example `display: none !important`); the launcher uses the maximum z-index and wins ties, but the host owns its page.
- **Screenshot-based recording** tools capture what is displayed on screen; DOM-based recorders such as rrweb see nothing.
- **T-05** is mitigated in P1.5 by the per-widget-key domain allowlist (D-21), not in PoC-A.

**P1.5 hardening** (2026-11-07, branch `p1.5-frame-foundation`, evidence `SPECS/evidence/P1.5.md`):

- **Frame on the library.** The frame now composes the `@byteflock/chat-widget` elements and uses `ThemeController`, `ConsentController` and `InMemoryTransport`. The provisional theme mapper is gone; the frame uses the contract guard and resolver from `@byteflock/theme/guard` and `@byteflock/theme/resolve`, so the frame and the dashboard resolve themes identically.
- **T-05 mitigated (D-21).** Every config lists `allowedOrigins` (1–20 exact origins). The frame checks the parent origin before `ready` and again when the channel pins, renders nothing and posts nothing when it is not listed, and sends one `ORIGIN_NOT_ALLOWED` beacon. Preview mode from the build-time dashboard origin is always allowed. Playwright covers the refusal, the preview exception and a refused production embed on the dashboard origin, in Chromium and once in Firefox. A config that fails to load leaves the allowlist unknown; the frame then runs with embedded defaults, as before.
- **Consent gates storage (Q-006).** Only `consent-controller.ts` may use browser storage (lint-enforced). The one persisted value is `byteflock.visitorId`, written after consent, or at once when the tenant does not require consent; withdrawing consent removes it. Playwright inspects the frame's storage before and after consent.
- **Q-015 applied.** The frame is still created at idle by default.
- **Merge-blocking from P1.5.** The widget unit tests, the playground suite (Chromium), the chat-widget story tests, the bundle budgets and the production header test (T-12, `vite preview` of the build). CI is deferred (D-22), so `pnpm verify` is the gate.

Residual risks after P1.5, unchanged from the PoC-A sign-off: **T-13** (the host page owns its launcher host element) and **screenshot-based recording**. T-05 is now mitigated by D-21.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

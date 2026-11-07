# Evidence — PoC-A Widget isolation

|                    |                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Spec               | `SPECS/phases/POC-A-widget-isolation.md`                                                                              |
| Branch / commits   | `poc-a-widget-isolation`: `7c282c4` (widget), `0418bb2` (playground, tests, docs); stacked on P1.2; not pushed (D-22) |
| Implementing agent | Claude Code session, model `claude-opus-5-5`                                                                          |
| Environment        | Windows 11, Node 24.20.0, pnpm 11.28.10, Vite 8.3.5, Playwright 1.62.1 (Chromium, Firefox 153, WebKit)                |
| Dates              | approved, implemented and verified 2026-11-07                                                                         |

## Tasks

| Task      | State                   | Note                                                                                                     |
| --------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| PoC-A-T01 | done                    | `apps/widget/src/bridge/protocol.ts`, 59 unit tests                                                      |
| PoC-A-T02 | done                    | `src/loader.ts`: classic IIFE, feature detection, queue, declarative element                             |
| PoC-A-T03 | done                    | `src/launcher/`: Shadow DOM, adopted stylesheets, idle frame creation, 5 s ready timeout, re-mount once  |
| PoC-A-T04 | done                    | `v1/frame/index.html`, `src/frame/main.ts`, `elements.ts`, `gate.ts` (11 unit tests), `config.ts`        |
| PoC-A-T05 | done                    | `src/frame/provisional-theme.ts`, marked PROVISIONAL                                                     |
| PoC-A-T06 | done                    | Stubs for the three tenants and the broken set in `validation/widget-fixtures/v1`; Inter woff2           |
| PoC-A-T07 | done                    | Dev plugin: headers, directory index, dev loader, `wk_slow`, telemetry sink with `GET /v1/dev/telemetry` |
| PoC-A-T08 | done                    | `scripts/build.mjs` (frame, hashed launcher, loader, `_headers`) and `assert-bundle.mjs`                 |
| PoC-A-T09 | done                    | 11 fixture pages plus the playground index                                                               |
| PoC-A-T10 | done                    | 27 Playwright scenarios in `apps/widget-playground/src/tests`                                            |
| PoC-A-T11 | done                    | `measure.spec.ts` (@measure) and `docs/architecture/baselines.md`                                        |
| PoC-A-T12 | not needed              | Criteria 5 and 6 pass with the hybrid design, so Option C was not built                                  |
| PoC-A-T13 | done, awaiting sign-off | ADR-007 verification block filled; status stays Proposed until the residuals below are signed            |
| PoC-A-T14 | done                    | `docs/developer-guide/embedding.md`                                                                      |

## Acceptance criteria (ARCH-001 §17.1 in brackets)

| Criterion | Level                 | Result                           | Proof                                                                                                  |
| --------- | --------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| AC01 [1]  | `[auto]`              | pass                             | `T-01 hostile script cannot read composer text`                                                        |
| AC02 [2]  | `[auto]` + doc        | pass                             | `T-01 rrweb recording contains no frame content`; screenshot caveat in ADR-007 and the embedding guide |
| AC03 [3]  | `[auto]`              | pass                             | Unit: `protocol.spec.ts`, `gate.spec.ts`; Playwright: `bridge.spec.ts`                                 |
| AC04 [4]  | `[auto]`              | pass                             | `T-08 strict CSP with Trusted Types`                                                                   |
| AC05 [5]  | `[auto]` + `[manual]` | auto pass; screen reader pending | `Enter opens and focuses the composer…` in all three engines                                           |
| AC06 [6]  | `[auto]` + `[manual]` | auto pass; device check pending  | `mobile (PoC-A-AC06)` in Chromium and WebKit                                                           |
| AC07 [7]  | `[auto]`              | pass                             | `the curated font renders in the frame…`, `hostile CSS does not reach…`                                |
| AC08 [8]  | `[auto]`              | pass                             | `failures.spec.ts` (5 tests) and the re-mount test                                                     |
| AC09 [9]  | `[auto]`              | pass                             | `two instances are themed and operated independently`                                                  |
| AC10 [10] | `[measure]`           | done                             | `docs/architecture/baselines.md`                                                                       |
| AC11 [11] | `[auto]`              | pass                             | `frame response headers` tests; `ready` arriving proves COOP does not break postMessage                |
| AC12      | `[auto]`              | pass                             | `launcher-rules.spec.ts`                                                                               |
| AC13      | `[auto]`              | pass                             | `assert-bundle.mjs` in every widget build                                                              |
| AC14      | `[manual]`            | pending                          | Sign the residuals below; ADR-007 then becomes Accepted                                                |
| AC15      | `[manual]`            | pending                          | Runbook PoC-A steps 1–11                                                                               |

## Verification — implementing agent

`pnpm verify --quick` and the e2e step of a full run on the working tree that became `0418bb2`:

| Step                                      | Result                        |
| ----------------------------------------- | ----------------------------- |
| Policy checks                             | pass                          |
| Format check (all files)                  | pass                          |
| TypeScript project references in sync     | pass                          |
| Generated files up to date                | pass                          |
| Lint, test, typecheck, build (8 projects) | pass, 5 lint warnings (below) |
| End-to-end, Chromium                      | pass                          |

| Suite                                                               | Tests          | Result |
| ------------------------------------------------------------------- | -------------- | ------ |
| `@byteflock/widget` unit (Vitest)                                   | 75             | pass   |
| Playground scenarios, Chromium, dev servers                         | 27             | pass   |
| Playground scenarios, Firefox 153                                   | 26 + 1 skipped | pass   |
| Playground scenarios, WebKit                                        | 26 + 1 skipped | pass   |
| Playground scenarios, Chromium, production build via `vite preview` | 27             | pass   |

The skipped test is the origin-mismatch scenario, which runs in Chromium only by design.

Bundle sizes and timings are in `docs/architecture/baselines.md`.

| Bundle   | gzip     |
| -------- | -------- |
| Loader   | 721 B    |
| Launcher | 5,161 B  |
| Frame JS | 11,639 B |

| Timing, cold cache, 4× CPU, Fast 3G | Median                   |
| ----------------------------------- | ------------------------ |
| Launcher first paint                | 873 ms                   |
| Frame ready, created at idle        | 2,146 ms from navigation |
| Frame ready, created on open        | 1,282 ms after the click |

Lint warnings (non-blocking, intentional): two browser-specific `test.skip`, two short `waitForTimeout` calls that prove an absence (no second warning, no second re-mount), and one `??` fallback flagged as a conditional.

## Independent verification

Not run yet. A fresh clone should run `pnpm verify`, which includes the 27 Chromium scenarios.

## Manual validation

| Runbook step (PoC-A)                                 | Result  | Date | Validator |
| ---------------------------------------------------- | ------- | ---- | --------- |
| 1. Clean page, three tenants                         | pending |      |           |
| 2. Hostile CSS                                       | pending |      |           |
| 3. Hostile script                                    | pending |      |           |
| 4. rrweb                                             | pending |      |           |
| 5. Strict CSP                                        | pending |      |           |
| 6. Two instances                                     | pending |      |           |
| 7. Frame blocked                                     | pending |      |           |
| 8. Slow or broken config                             | pending |      |           |
| 9. Keyboard, plus a screen reader (Narrator or NVDA) | pending |      |           |
| 10. Mobile, device emulation                         | pending |      |           |
| 11. Measurements in `baselines.md`                   | pending |      |           |

## Residual risks for product-owner sign-off (ADR-007)

| Risk                                                            | Status                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| T-13: a host page can cover or hide the launcher's host element | Accepted residual; the launcher uses the maximum z-index and wins ties |
| Screenshot-based recording tools capture what is on screen      | Accepted residual; DOM recorders see nothing                           |
| T-05: a hostile site embeds another tenant's key                | Mitigated in P1.5 by the domain allowlist (D-21), not in PoC-A         |

## New dependencies

| Package                           | Version               | Need                                                                                                                           | Alternative considered                                                                 |
| --------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `lit` (widget)                    | ^3.3.0 (3.3.3)        | Frame shell elements (PO-005)                                                                                                  | None; the frame is Lit by decision                                                     |
| `rrweb` (playground, dev)         | 2.2.0, exact; MIT     | Session-recording fixture for T-01; browser bundle vendored in `public/vendor/` because static fixtures cannot import packages | A hand-written DOM recorder, rejected: the point is to test against a real replay tool |
| `@fontsource/inter` (widget, dev) | 5.3.0, exact; OFL-1.1 | Source of the two Inter woff2 files vendored in `public/v1/fonts/inter/` with their licence                                    | Google Fonts at runtime, rejected: the frame CSP allows only `font-src 'self'`         |

rrweb ships no LICENSE file in its npm package; its licence is MIT per its `package.json`.

## Deviations and findings

**Defects found by the scenarios and fixed:**

- The frame's element import was type-only, so the compiler dropped it and the element never registered. Fixed with a side-effect import; the first frame bundle size (4.8 KB gzip) was wrong for this reason.
- Lit class-field initialisers shadowed the reactive properties. Lit dev mode threw, and production would have silently never updated. Fixed with `declare` plus constructor defaults.
- The hostile page's `* { all: unset !important }` reached the launcher's host element. Layout now lives on a wrapper inside the shadow root.
- Firefox did not focus the composer after Enter. The frame now calls `window.focus()` first.

**Contract and spec changes:**

- `launcherTheme.shape` added to BRIDGE-02.
- The launcher module needs `Access-Control-Allow-Origin: *` (ENDP-01 note).
- `data-frame="open"` and `data-mode="test"` loader attributes added; `data-launcher` (auto/manual) is not implemented (ENDP-06).
- The frame does not send `layout`; the launcher decides from the host viewport (BRIDGE-02 note).

**Other choices:**

- **Q-015:** the frame-creation strategy is a loader attribute, not `features.proactive`, because the launcher cannot read config: the frame does.
- **`wk_slow`:** the dev plugin delays the `wk_slow` key, instead of a `?delay=` parameter the frame could not pass. The broken cases are stub files, not `/v1/dev/*` routes.
- **Telemetry:** a dev and preview endpoint `GET /v1/dev/telemetry` lets tests assert beacons.
- **Wrong-origin and wrong-source messages** are tested as units of `gate.ts`. Staging them reliably in a browser needs a second cross-origin window aimed at a shadow-DOM iframe.
- **Firefox 153 already has `location.ancestorOrigins`,** so the `parent`-parameter fallback is covered by unit tests only.
- **Mobile keyboard** is approximated by resizing the viewport; a real device check remains manual.
- **Fonts:** only Inter ships in PoC-A; the other curated families fall back to their stacks until P1.5.
- **Build plumbing:**
  - TypeScript output for both Vite apps moved to `out-tsc/app`, because the production build empties `dist`.
  - The Playwright configs start the widget and playground with Vite directly.
  - The playground's static fixtures are excluded from ESLint.
- **Vendored rrweb:** a Prettier run had reformatted it; it was restored byte-identical, and Prettier now ignores vendor code.

## Status transitions

| Transition  | By                              | Date       |
| ----------- | ------------------------------- | ---------- |
| Approved    | Madhusudan C P                  | 2026-11-07 |
| Implemented | Claude Code (agent)             | 2026-11-07 |
| Verified    | Claude Code (agent), under D-22 | 2026-11-07 |
| Validated   |                                 |            |
| Accepted    |                                 |            |

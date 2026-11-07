# Measured baselines and budgets

Method (ADR-009, ARCH-001 §14.3): PoC-A records each measurement; P1.5 sets budget = baseline + 15 %, ratcheted down on each reduction. Raising a budget needs `BUDGET-EXCEPTION:` in the PR.

## Widget

Measured on 2026-11-07, branch `poc-a-widget-isolation`, Windows 11, from `pnpm nx run @byteflock/widget:build` (printed by `apps/widget/scripts/assert-bundle.mjs`).

| Measurement                                                    | Raw      | gzip     | brotli   | Budget (gzip) |
| -------------------------------------------------------------- | -------- | -------- | -------- | ------------- |
| `loader.js`                                                    | 1,354 B  | 721 B    | 590 B    | set in P1.5   |
| `launcher.[hash].js`                                           | 14,891 B | 5,161 B  | 4,429 B  | set in P1.5   |
| Frame initial JS (Lit, elements, bootstrap, provisional theme) | 31,059 B | 11,639 B | 10,444 B | set in P1.5   |
| Frame initial CSS                                              | 0 B      | 20 B     | 1 B      | set in P1.5   |

The frame has no CSS file: its styles are Lit constructable stylesheets inside the JavaScript, because the frame CSP blocks `<style>` elements.

| Timing, median of 5                                        | Value    |
| ---------------------------------------------------------- | -------- |
| Launcher first paint, from navigation                      | 873 ms   |
| Frame `ready`, frame created at idle, from navigation      | 2,146 ms |
| Frame `ready`, frame created on first open, from the click | 1,282 ms |

Profile: Chromium (Playwright 1.62.1), CPU 4× slowdown, network 150 ms latency / 1.6 Mbit/s down / 750 kbit/s up, browser cache disabled, built widget served by `vite preview` on localhost. Reproduce with `apps/widget-playground/src/tests/measure.spec.ts` (instructions in its header).

**Q-015 input:** creating the frame at idle makes the panel usable immediately on open; creating it on first open costs the visitor about 1.3 s on this profile. The frame created at idle costs one extra document load (about 12 KB gzip of JavaScript plus config and theme) per page view.

## React (PoC-B, P1.4)

| Measurement                      | gzip | Date | Commit |
| -------------------------------- | ---- | ---- | ------ |
| Dialog + Combobox minimal bundle |      |      |        |

## Dashboard

LCP and INP budgets are set at P1.7, once a representative route exists.

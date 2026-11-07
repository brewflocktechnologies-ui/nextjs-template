# PoC-B — React primitives proof of concept

|                       |                                                                                |
| --------------------- | ------------------------------------------------------------------------------ |
| Status                | see `STATUS.md`                                                                |
| Depends on            | P1.1 `Accepted`                                                                |
| Unblocks              | P1.4 (and ADR-006 acceptance)                                                  |
| Runs in parallel with | PoC-A, P1.2, P1.3                                                              |
| ARCH-001              | §11.1, §11.2 (minimal), §12 (Storybook for React), §17.2                       |
| Contracts             | `contracts/boundary-rules.md` (`@radix-ui/*` ban unless ADR-006 selects Radix) |
| ADRs                  | ADR-006 → _Accepted_ with the chosen primitive                                 |
| Effort                | 2–3 days                                                                       |

## 1. Goal

Decide the React primitive library by building the dashboard's hard cases with Base UI through shadcn inside `libs/ui-react`, under Storybook with interaction tests, accessibility checks and a nonce-only CSP. Repeat only failing items with Radix. The deliverables become the library's first real components.

## 2. Preconditions

- P1.1 accepted; `libs/ui-react` shell exists (React lib, Vitest, tags `type:lib scope:shared platform:react`).
- Node 24; Playwright Chromium installed (for the Storybook Vitest addon browser mode).

## 3. Scope

**In:** Tailwind v4 set up for the library's Storybook only (temporary CSS entry; P1.4 replaces it with the generated bridge), Storybook 10 `react-vite` with `addon-vitest` and `addon-a11y`, shadcn initialised with Base UI, the five PoC items, the agent dry run, measurements, ADR-006.
**Out:** the generated `shadcn-bridge.css` and token wiring (P1.4), DataTable polish beyond sorting/visibility, dashboard integration, theming by tenant (P1.4).

## 4. Decisions applied

ARCH-001 §11.1 (Base UI preferred). Fixed by this spec: Storybook runs on port **4600** (D-10); `@storybook/*` and `storybook` pinned to one exact version; the temporary Tailwind entry `libs/ui-react/.storybook/poc.css` must be deleted by P1.4 (P1.4-AC checks).

## 5. Tasks

| ID        | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Where                                                      | Done when                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| PoC-B-T01 | **Storybook**: `pnpm nx g @nx/storybook:configuration @byteflock/ui-react --uiFramework=@storybook/react-vite` (Nx 24 generator; verify flags with `--help`), add `@storybook/addon-vitest` (browser mode via Playwright Chromium) and `@storybook/addon-a11y`; targets `storybook` (4600), `build-storybook`, `test-storybook` (Vitest workspace project running stories); CI runs `build-storybook` and `test-storybook` from PoC-B (non-blocking until P1.4) | `libs/ui-react/.storybook/**`, `vitest.config.ts`          | A hello story renders; `test-storybook` runs a `play()` test                  |
| PoC-B-T02 | **Tailwind v4** in Storybook only: `@import "tailwindcss"; @source "../src";` in `.storybook/poc.css`, `@tailwindcss/vite` plugin in the Storybook Vite config                                                                                                                                                                                                                                                                                                  | `.storybook/`                                              | Utility classes render in stories                                             |
| PoC-B-T03 | **shadcn init with Base UI**: `pnpm dlx shadcn@latest init -b base` inside `libs/ui-react` (confirm current flag spelling with `--help`), `components.json` pointing at `src/components/ui`; add `dialog`, `popover`, `combobox` (or `command` equivalent for Base UI), `select`, `button`, `input`, `label`, `tooltip`, `table`, `checkbox`; `@base-ui/react` version recorded                                                                                 | `libs/ui-react/src/components/ui/*`                        | Components compile; lint passes (no `@radix-ui/*` import anywhere — BOUND-03) |
| PoC-B-T04 | **Item 1 — Dialog with nested Popover** story + `play()`: open dialog, open popover, Esc closes only popover, Esc closes dialog, focus returns to trigger; axe clean                                                                                                                                                                                                                                                                                            | `src/poc/DialogNestedPopover.stories.tsx`                  | Green                                                                         |
| PoC-B-T05 | **Item 2 — Searchable Combobox** (agents/teams list of 50 items): typing filters; ArrowDown/Up; Enter selects; `aria-activedescendant` or equivalent announced; axe clean                                                                                                                                                                                                                                                                                       | `src/poc/SearchableCombobox.stories.tsx`                   | Green                                                                         |
| PoC-B-T06 | **Item 3 — Multi-select filter in a dialog** (composite: dialog + combobox + chips): select two, close, reopen keeps selection; remove chip by keyboard                                                                                                                                                                                                                                                                                                         | `src/poc/FilterDialog.stories.tsx`                         | Green                                                                         |
| PoC-B-T07 | **Item 4 — DataTable** (TanStack Table + primitives): sort by column header (button, `aria-sort`), toggle column visibility via a Popover with checkboxes; keyboard only                                                                                                                                                                                                                                                                                        | `src/poc/DataTable.stories.tsx`                            | Green; axe clean                                                              |
| PoC-B-T08 | **Item 5 — CSP**: story decorator that applies a `<meta http-equiv="Content-Security-Policy" content="style-src 'nonce-poc'">` to the preview iframe (Storybook `previewHead` with the nonce) and wraps in Base UI's `CSPProvider nonce="poc"`; asserts no `securitypolicyviolation` events during open/close of dialog and popover                                                                                                                             | `src/poc/UnderStrictCSP.stories.tsx`                       | Green                                                                         |
| PoC-B-T09 | **Agent dry run**: in a fresh agent session, ask "add a Tooltip component to ui-react following the existing components and write a story with a play test"; count human corrections needed (wrong import source, Radix habits, missing a11y). Record count and the corrections                                                                                                                                                                                 | evidence                                                   | Recorded (target ≤ 2 corrections)                                             |
| PoC-B-T10 | **Measurements**: gzip size of a minimal page importing Dialog + Combobox (esbuild bundle of a scratch entry); Storybook test run time                                                                                                                                                                                                                                                                                                                          | evidence, `docs/architecture/baselines.md` (React section) | Recorded                                                                      |
| PoC-B-T11 | **Radix fallback** only for failed items: `pnpm dlx shadcn@latest init -b radix` in a scratch branch, repeat the failing story; record comparison; if Radix is chosen, update BOUND-03 (lift the ban) and ADR-006                                                                                                                                                                                                                                               | scratch branch                                             | Recorded or "not needed"                                                      |
| PoC-B-T12 | **ADR-006** _Accepted_: chosen primitive and version, coverage gaps, bundle numbers, CSP result, agent dry-run result, Tailwind v4 decision confirmed                                                                                                                                                                                                                                                                                                           | `docs/adr/ADR-006-*.md`                                    | Updated                                                                       |

Order: T01 → T02 → T03 → T04…T08 (parallel) → T09 → T10 → T11 → T12.

## 6. Acceptance criteria

| ID         | Criterion                                                              | Level                              |
| ---------- | ---------------------------------------------------------------------- | ---------------------------------- |
| PoC-B-AC01 | Five stories with passing `play()` tests under `test-storybook`        | `[auto]`                           |
| PoC-B-AC02 | axe: zero serious/critical across the five stories                     | `[auto]` (addon-a11y in test mode) |
| PoC-B-AC03 | CSP story: zero violations with nonce-only `style-src`                 | `[auto]`                           |
| PoC-B-AC04 | No `@radix-ui/*` import (unless T11 selects Radix and ADR-006 says so) | `[auto]` (lint)                    |
| PoC-B-AC05 | Keyboard paths of items 1–4 verified by a human                        | `[manual]`                         |
| PoC-B-AC06 | Agent dry run recorded with correction count                           | `[agent]`                          |
| PoC-B-AC07 | ADR-006 Accepted with numbers                                          | `[manual]`                         |

## 7. Quality gates introduced

`ui-react:build-storybook` and `ui-react:test-storybook` run in CI from PoC-B; merge-blocking at P1.4 (ARCH-001 §14.2 row 4).

## 8. Verification procedure (agent)

1. `pnpm nx run @byteflock/ui-react:test-storybook` → 5+ stories pass; print the a11y summary.
2. `pnpm nx run @byteflock/ui-react:build-storybook` → `storybook-static` produced.
3. `pnpm nx lint @byteflock/ui-react` → clean; `grep -rn "@radix-ui" libs/ui-react/src` → nothing (or the ADR-006 exception).
4. `pnpm nx run @byteflock/ui-react:storybook` → open `http://localhost:4600`, run the runbook steps.

## 9. Manual validation (human)

`validation/manual-validation-runbook.md` → PoC-B.

## 10. Evidence to record

Versions (`storybook`, `@base-ui/react`, `tailwindcss`, `@tanstack/react-table`, `shadcn` CLI), dependency sentences, the dry-run transcript summary, bundle numbers, CSP finding, any Base UI gaps.

## 11. Exit and approval

PoC-B → `Accepted`; ADR-006 _Accepted_. P1.4 eligible once P1.3 is accepted too.

## 12. Risks and notes

- shadcn's Base UI mode and Nx's `@nx/storybook` generator both evolve quickly; check `--help` and the shadcn changelog on the day. Record exact CLI invocations in evidence.
- The nonce-only CSP story needs the nonce on Storybook's own injected styles too; if Storybook's preview cannot run under that policy, run the CSP check in a plain Vite page inside the Storybook static build (`public/csp-check.html`) and test it with Playwright instead. Record which.
- Keep the PoC stories under `src/poc/`; P1.4 promotes them into `src/components/` and `src/composites/` and deletes `poc/`.

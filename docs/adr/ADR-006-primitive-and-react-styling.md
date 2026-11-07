# ADR-006: Primitive library and React styling

|          |                                                                         |
| -------- | ----------------------------------------------------------------------- |
| Status   | Proposed (PoC-B passed with Base UI; awaiting product-owner acceptance) |
| Date     | 2026-11-07                                                              |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer)   |
| Source   | ARCH-001 §11                                                            |

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

PoC-B on 2026-11-07, branch `poc-b-react-primitives`. Evidence: `SPECS/evidence/POC-B.md`. Status stays **Proposed** until the product owner accepts it (PoC-B-AC07).

**Result: Base UI is chosen.** Every PoC-B item passes with Base UI, so the Radix comparison was not run.

| Item                                      | Result (Storybook `play()` test with axe, Chromium)                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Dialog with nested popover                | pass: Esc closes only the popover, then the dialog; focus returns to the trigger                                     |
| Searchable combobox, 50 items             | pass: filtering, arrow keys, Enter selects; empty state                                                              |
| Multi-select filter in a dialog           | pass after a fix (below): chips by keyboard, selection survives reopening, chip removable by keyboard                |
| Data table (TanStack Table 9.3.1)         | pass: keyboard sorting with `aria-sort`, column visibility from a popover                                            |
| Nonce-only `style-src` with `CSPProvider` | pass: no violations while opening and closing a dialog and a popover; a probe inline style proves the policy is live |

Versions: `@base-ui/react` 1.9.0, shadcn CLI 4.23.0 (`base-nova` style), Tailwind CSS 4.3.3, Storybook 10.6.5 with `@storybook/addon-vitest` and `@storybook/addon-a11y`, Vitest 5.0.5 browser mode with Playwright Chromium.

Bundle: Dialog plus Combobox, React excluded, is 73.7 KB gzip. Tree-shaking works; the weight is Base UI's positioning and filtering plus the shadcn helpers. Dashboard only.

Agent dry run: a fresh agent added a Tooltip story following the conventions with **0 corrections** (target at most 2).

Coverage gaps found and fixed in the generated components (to keep when shadcn components are re-added):

- shadcn's `init` could not resolve the utils alias in this monorepo, wrote `import { cn } from "cn"` and **installed an unrelated npm package named `cn`**. It was removed and the standard helper added at `src/lib/utils.ts`. Every future `shadcn add` must be reviewed for new dependencies.
- shadcn writes self-referencing imports; `scripts/relative-imports.mjs` rewrites them to relative paths, as Nx forbids self-imports.
- Combobox dropdown button: no accessible name (axe `button-name`), and focusable inside an addon that Base UI marks `aria-hidden` while the list is open (axe `aria-hidden-focus`). Now `aria-label="Show options"` and `tabIndex={-1}`; keyboard users open the list from the input.
- Chip remove button: no accessible name. Now `aria-label="Remove"`.
- **Base UI clears all chips of a multi-select combobox on Escape when the list is closed.** In a dialog that throws away the user's selection. The filter composite calls `event.preventBaseUIHandler()` for that case; P1.4's composite must keep it.
- TanStack Table 9.3 registers row models and sort functions inside `tableFeatures(...)` and takes `features`, not `_features`.
- Story tests pre-bundle their dependencies (`optimizeDeps.include`) to avoid a mid-run reload on a cold cache.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

# Evidence — PoC-B React primitives

|                    |                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Spec               | `SPECS/phases/POC-B-react-primitives.md`                                                        |
| Branch             | `poc-b-react-primitives` (stacked on PoC-A); not pushed (D-22)                                  |
| Implementing agent | Claude Code session, model `claude-opus-5-5`; dry run by a separate agent                       |
| Environment        | Windows 11, Node 24.20.0, pnpm 11.28.10, Storybook 10.6.5, Vitest 5.0.5 browser mode (Chromium) |
| Dates              | approved, implemented and verified 2026-11-07                                                   |

## Tasks

| Task      | State                     | Note                                                                                                                                                                           |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PoC-B-T01 | done                      | `@nx/storybook` 24.0.0 configuration; explicit `storybook` (4600), `build-storybook`, `test-storybook` targets; `@storybook/test-runner` removed in favour of the Vitest addon |
| PoC-B-T02 | done                      | Tailwind 4.3.3 in Storybook only, through `.storybook/poc.css` (temporary, mapped to `--sem-*`)                                                                                |
| PoC-B-T03 | done                      | `components.json` written by hand (`base-nova`); `shadcn add` for 10 components plus 2 helpers                                                                                 |
| PoC-B-T04 | done                      | Dialog with nested popover                                                                                                                                                     |
| PoC-B-T05 | done                      | Searchable combobox, plus a no-match story                                                                                                                                     |
| PoC-B-T06 | done                      | Multi-select filter dialog                                                                                                                                                     |
| PoC-B-T07 | done                      | Data table on TanStack Table 9.3.1                                                                                                                                             |
| PoC-B-T08 | done                      | Nonce-only CSP story with `CSPProvider`                                                                                                                                        |
| PoC-B-T09 | done                      | Separate agent added `Tooltip.stories.tsx`: 0 corrections                                                                                                                      |
| PoC-B-T10 | done                      | Bundle in `docs/architecture/baselines.md`                                                                                                                                     |
| PoC-B-T11 | not needed                | No item failed with Base UI, so Radix was not tried                                                                                                                            |
| PoC-B-T12 | done, awaiting acceptance | ADR-006 verification block filled; status Proposed until the product owner accepts                                                                                             |

## Acceptance criteria

| Criterion  | Level      | Result  | Proof                                                                   |
| ---------- | ---------- | ------- | ----------------------------------------------------------------------- |
| PoC-B-AC01 | `[auto]`   | pass    | `test-storybook`: 7 story tests across 6 files                          |
| PoC-B-AC02 | `[auto]`   | pass    | `a11y: { test: 'error' }` on every story; zero violations of any impact |
| PoC-B-AC03 | `[auto]`   | pass    | `UnderStrictCSP` story                                                  |
| PoC-B-AC04 | `[auto]`   | pass    | Lint (BOUND-03); `grep @radix-ui libs/ui-react/src` finds nothing       |
| PoC-B-AC05 | `[manual]` | pending | Runbook PoC-B steps 1–5 in Storybook on http://localhost:4600           |
| PoC-B-AC06 | `[agent]`  | pass    | Dry run below                                                           |
| PoC-B-AC07 | `[manual]` | pending | Accept ADR-006                                                          |

## Verification — implementing agent

`pnpm verify --quick` on the PoC-B working tree:

| Step                                  | Result |
| ------------------------------------- | ------ |
| Policy checks                         | pass   |
| Format check (all files)              | pass   |
| TypeScript project references in sync | pass   |
| Generated files up to date            | pass   |
| Lint, test, typecheck, build          | pass   |
| Storybook builds and story tests      | pass   |

Story tests from a cold Vite and Storybook cache, three runs in a row: 7/7 passed each time, with no reload.

| Measurement                              | Value                                         |
| ---------------------------------------- | --------------------------------------------- |
| Dialog + Combobox bundle, React excluded | 264,965 B raw, 73,706 B gzip, 62,252 B brotli |

## Agent dry run (PoC-B-T09)

A separate agent, given only the repository and the task "add a Tooltip story following the existing components and stories, with a play() test", produced `libs/ui-react/src/poc/Tooltip.stories.tsx`. The story covers Tab focus, the tooltip showing, Esc hiding it, and focus staying on the trigger.

| Measure                      | Result               |
| ---------------------------- | -------------------- |
| Corrections needed           | 0 (target at most 2) |
| Radix or other wrong imports | none                 |
| Accessibility                | axe clean            |
| Lint, typecheck, story tests | pass                 |

The agent's own first run failed in every story. A concurrent edit to `combobox.tsx` made Vite re-optimise a dependency mid-run. This is fixed with `optimizeDeps.include` in `vitest.storybook.config.mts`.

The agent noted, correctly, that "record what you did in the evidence file" conflicts with "create only the story file". The evidence is recorded here.

## Independent verification

Not run yet. A fresh clone should run `pnpm verify`.

## Manual validation

| Runbook step (PoC-B)                        | Result  | Date | Validator |
| ------------------------------------------- | ------- | ---- | --------- |
| 1. Dialog with nested popover, Esc layering | pending |      |           |
| 2. Searchable combobox                      | pending |      |           |
| 3. Multi-select filter in a dialog          | pending |      |           |
| 4. Data table, keyboard, a11y panel         | pending |      |           |
| 5. Strict CSP story                         | pending |      |           |

Start it with `pnpm nx run @byteflock/ui-react:storybook`, then open http://localhost:4600.

## New dependencies

| Package                                                                                              | Version                     | Need                                                       | Alternative considered                                                  |
| ---------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| `storybook`, `@storybook/react-vite`, `@storybook/addon-a11y`, `@storybook/addon-vitest` (dev, root) | 10.6.5, exact               | Stories as component spec and test (ADR-008)               | Unit tests without Storybook, rejected by ADR-008                       |
| `@nx/storybook` (dev, root)                                                                          | 24.0.0                      | Storybook integration at the workspace's Nx version (D-05) | Manual targets only; the plugin is kept for inference                   |
| `@vitest/browser`, `@vitest/browser-playwright` (dev, root)                                          | 5.0.5, exact                | Run stories in Chromium through Vitest                     | The Jest-based Storybook test runner, removed                           |
| `tailwindcss`, `@tailwindcss/vite` (dev, root)                                                       | 4.3.3, exact                | Styling for shadcn components (ADR-006)                    | None; ADR-006 names Tailwind 4                                          |
| `@base-ui/react`                                                                                     | 1.9.0, exact                | Primitives (ADR-006, this PoC)                             | Radix, not needed                                                       |
| `@tanstack/react-table`                                                                              | 9.3.1, exact                | Data table                                                 | A hand-written table, rejected: sorting and visibility are table-stakes |
| `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`                                 | 0.7.1, 2.1.1, 3.7.0, 1.66.0 | Required by the shadcn components                          | None                                                                    |
| `@vitejs/plugin-react`, `@vitest/coverage-v8`, `@vitest/ui`                                          | as added by Nx generators   | React transform and Vitest tooling                         | —                                                                       |

Removed: `cn@0.5.1`, which shadcn installed by mistake (below), and `@storybook/test-runner`, which the Nx generator added.

## Deviations and findings

- **shadcn installed an unrelated npm package.** It could not resolve the utils alias, wrote `from "cn"` in 12 files and added `cn@^0.5.1` from npm. The package was removed, the real helper added and the imports fixed. This is a supply-chain risk to watch on every `shadcn add`.
- **`shadcn init` is skipped.** It assumes an app template; `components.json` is written by hand instead.
- **Self-imports.** shadcn writes `@byteflock/ui-react/...` imports; `scripts/relative-imports.mjs` rewrites them to relative paths, because Nx forbids self-imports. Run it after each `shadcn add`.
- **Three accessibility gaps in generated components fixed** (combobox dropdown button name and focusability, chip remove button name). These are local edits to shadcn files.
- **Base UI clears all chips on Escape** when the list is closed. This is prevented in the filter composite with `preventBaseUIHandler`; P1.4 must carry it into the real composite.
- **TanStack Table 9.3 API:** `features`, with row models and sort functions passed inside `tableFeatures(...)`.
- **Strict-CSP story method:** a meta CSP is added by the story's play function, because Storybook's own preview cannot run under a nonce-only policy from the start. Per PoC-B's risk note, the method is recorded here.
- **Accessibility setting:** axe is set to fail on any violation, not only serious and critical; all stories pass the stricter setting.
- **Build plumbing:**
  - TypeScript DOM types added to `ui-react`'s tsconfigs.
  - ESLint ignores `storybook-static` everywhere.
  - `verify` and `ci.yml` run `build-storybook` and `test-storybook`.
- **Spec correction:** none needed; the spec anticipated the CSP fallback.

## Status transitions

| Transition  | By                              | Date       |
| ----------- | ------------------------------- | ---------- |
| Approved    | Madhusudan C P                  | 2026-11-07 |
| Implemented | Claude Code (agent)             | 2026-11-07 |
| Verified    | Claude Code (agent), under D-22 | 2026-11-07 |
| Validated   |                                 |            |
| Accepted    |                                 |            |

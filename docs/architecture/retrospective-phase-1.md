# Phase 1 retrospective: the AI-DLC workflow

P1.7-T07, 2026-11-07. Phase 1 (P0 to P1.7, PoC-A and PoC-B) was implemented by one Claude Code agent session against the specs in `SPECS/`, with the product owner approving each phase before work and accepting it after. This page is for discussion with the product owner; the Phase 2 changes it proposes are not yet applied.

## What the spec format got right

- **Approval gates worked.** No phase started without an `Approved` row in `STATUS.md`, and none was marked `Accepted` by the agent. The product owner decided scope at nine points, never mid-phase.
- **Task and acceptance IDs made verification mechanical.** Tests carry IDs in their titles (`P1.3-AC04`, `T-05 allowlist`), so the evidence tables point at real test names, and a grep finds the proof for any criterion.
- **Contracts as separate files** (`theme-contract-v1`, `bridge-protocol-v1`, endpoints, boundaries) let later phases build on earlier ones without rereading phase specs. The protocol did not change after PoC-A.
- **Negative runs in every evidence file** (stale generator, lint violation, budget lowered, contract edited) proved that the gates fail when they should, which a green run cannot show.
- **The decision log (`DECISIONS.md`)** absorbed product answers (D-20, D-21, D-22) without editing the architecture document.

## What it got wrong

- **Specs assumed CI.** D-22 deferred push and CI on day two. Every later phase had to translate "required check" and "CI link" into the local gate. Several P1.7 tasks (nightly run, branch protection, remote-cache timing) cannot be completed locally at all.
- **Framework facts went stale.** Next 16 sends `no-store` for pages in development regardless of configuration; Storybook's a11y addon has no severity threshold; Vitest 5's `list` does not expand template names; Nx treats `tools/eslint-rules` as its own convention. Each cost a deviation. The specs named APIs without saying "verify on the day".
- **Budgets from a PoC.** The frame JS budget formula (PoC baseline × 1.15) could not hold once the production frame existed; the exception mechanism worked, but the formula should apply from the first production build.
- **Size of P1.6.** One phase carried the session adapter, SSR theming, an editor with preview, publishing, widget settings, four lint rules and an e2e suite. It had the most deviations and the most test-timing work.

## Deviations per phase

| Phase | Deviations | Main sources                                           |
| ----- | ---------- | ------------------------------------------------------ |
| P0    | 0          | Decisions only                                         |
| P1.0  | 9          | GitHub items deferred (D-22)                           |
| P1.1  | 11         | Nx generator output, pnpm migration details            |
| PoC-A | 9          | Browser behaviour (focus, CSS reach, CSP)              |
| P1.2  | 7          | Generator and formatting interplay                     |
| PoC-B | 10         | shadcn on Base UI specifics, one unwanted npm package  |
| P1.3  | 8          | TypeBox typing, frame bundle split                     |
| P1.4  | 10         | Tailwind/bridge details, React Server Components       |
| P1.5  | 10         | Budget exception, test plumbing, accessibility finding |
| P1.6  | 14         | Next 16 behaviour, dev-server timing in e2e            |

Every deviation is recorded with its reason in the phase evidence file. None changed a contract.

## Agent corrections

- **PoC-B dry run:** a separate agent added a Tooltip story from the README and conventions alone with 0 corrections (target: at most 2).
- **P1.7 onboarding walk:** a fresh agent session reached a running stack 2.2 minutes after cloning, and found seven documentation or tooling problems (one: `stack:check` could never pass after P1.6), all fixed in P1.7.
- **Within the implementing session,** the product owner corrected direction twice (approval after specs; defer push and CI) and never had to reject delivered work.

## OpenSpec (D-09)

**Recommendation: keep `SPECS/` for Phase 2; do not adopt the OpenSpec layout now.** The `SPECS/` structure (phases, contracts, validation, evidence, status) is doing the job OpenSpec would do, the agent tooling reads it without adaptation, and moving would rename every reference in specs, ADRs and evidence for no functional gain. Revisit if several agents or teams need to propose changes concurrently, which is where OpenSpec's change-proposal flow helps.

## Proposed changes to `SPECS/00-conventions.md` for Phase 2

1. Each phase states its environment assumption (local gate or CI) and gives the local equivalent of every CI-only criterion.
2. Specs that name a framework API add "confirm against the installed version's docs" and the docs path, as P1.6 §12 did for `proxy.ts`.
3. Size phases to at most about eight tasks; split anything like P1.6 into a data/server phase and a UI phase.
4. Budgets are set from the first production build of the thing measured, not from a PoC.
5. Evidence files gain a fixed "Flaky or timing-sensitive tests" section, so instability is tracked rather than buried in deviations.
6. Policy checks that need a pull request body also define a local mode (commit trailers since `main`), as `tools/scripts/policy/lib.mjs` now does.

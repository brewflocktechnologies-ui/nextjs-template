# ADR-009: Quality gates, browser support, budgets and accessibility

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Accepted                                                              |
| Date     | 2026-11-07                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §14                                                          |

## Context and problem statement

Phase 1 delivers a foundation that later features build on; its gates must tighten as each part exists, with budgets derived from measurement rather than guesses.

## Decision drivers

- Gates become blocking exactly when the thing they check exists
- Budgets from measured baselines
- Accessibility as a merge condition

## Considered options

1. Staged gates per ARCH-001 §14.2 with measured budgets
2. All gates blocking from day one
3. Gates advisory until Phase 1 exit

## Decision outcome

**Chosen option:** Option 1.

- Gate schedule as in ARCH-001 §14.2 and the phase specs.
- WCAG 2.2 AA. Dashboard and frame target Baseline Widely Available browsers; the launcher must never break an unsupported host.
- Budgets equal the PoC-A baseline plus 15 percent, ratcheted down on each reduction; raising one needs `BUDGET-EXCEPTION:`.

### Consequences

- Good: No gate blocks work before it can pass
- Bad: Early phases rely more on review
- Neutral: Moderate axe findings and visual regression become blocking at P1.7.

## Verification

<!-- verification -->

**Budgets, P1.5** (2026-11-07, evidence `SPECS/evidence/P1.5.md`). Method (ARCH-001 §14.3): budget = ceil(PoC-A baseline × 1.15), gzip. `apps/widget/budgets.json` holds baselines, budgets and written exceptions; `scripts/assert-bundle.mjs` fails the widget build when a bundle exceeds its budget and prints `name: actual / budget`; `tools/scripts/policy/check-budget-exception.mjs` fails when a budget exceeds the formula without a recorded exception, and in a pull request requires a `BUDGET-EXCEPTION:` line when a budget goes up.

| Bundle            | Baseline (PoC-A) | Formula  | Budget                   | Actual at P1.5 |
| ----------------- | ---------------- | -------- | ------------------------ | -------------- |
| `loader.js`       | 721 B            | 830 B    | 830 B                    | 721 B          |
| launcher          | 5,161 B          | 5,936 B  | 5,936 B                  | 5,161 B        |
| Frame initial JS  | 11,639 B         | 13,385 B | **16,000 B** (exception) | 14,573 B       |
| Frame initial CSS | 20 B             | 23 B     | 23 B                     | 20 B           |

The frame exception: P1.5 replaces the PoC frame with the production one (six library elements, consent gate, transport, i18n, the contract guard and resolver). Before the exception the build was trimmed: the `repeat` directive was dropped and a build plugin minifies Lit CSS templates (15,577 B down to about 14,550 B). Lit alone is 6.4 KB of the frame. The budget leaves about 10% headroom over the measured size. P1.7 reviews it.

Accessibility: chat-widget stories run axe through the Storybook Vitest addon with `a11y.test = 'error'`, as ui-react does since P1.4; any violation fails.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

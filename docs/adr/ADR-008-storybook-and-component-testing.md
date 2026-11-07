# ADR-008: Storybook and component testing

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Accepted                                                              |
| Date     | 2026-11-07                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §12                                                          |

## Context and problem statement

React and Lit components need living documentation that also serves as their interaction and accessibility tests.

## Decision drivers

- Stories as executable component specs
- Accessibility checked on every PR
- No framework mixing between React and Lit

## Considered options

1. Two Storybooks (React and web components) with the Vitest addon and the a11y addon
2. One composed Storybook
3. Unit tests without Storybook

## Decision outcome

**Chosen option:** Option 1, because each Storybook stays on its own framework and composition can come later.

- `ui-react` uses `@storybook/react-vite`; `chat-widget` uses `@storybook/web-components-vite`; both add `@storybook/addon-vitest` (browser mode, Playwright Chromium) and `@storybook/addon-a11y`.
- Stories carry `play()` tests and axe checks; serious and critical violations block merges from P1.4 and P1.5.
- The launcher is tested in the playground with Playwright, not in Storybook.
- Unit tests run on Vitest, except the dashboard, which keeps the template Jest setup through `next/jest`.

### Consequences

- Good: One artefact documents and tests each component
- Bad: Two Storybook builds in CI
- Neutral: Composition is deferred until discoverability becomes a problem.

## Verification

<!-- verification -->

To be filled by P1.4-T11 and P1.5-T06 add notes.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

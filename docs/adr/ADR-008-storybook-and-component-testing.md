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

**React half, P1.4** (2026-11-07, branch `p1.4-ui-react-foundation`, evidence `SPECS/evidence/P1.4.md`):

- **Versions.** Storybook 10.6.5 with `@storybook/react-vite`, `@storybook/addon-a11y` and `@storybook/addon-vitest` 10.6.5; Vitest 5 browser mode on Playwright Chromium. The ui-react Storybook runs on port 4600.
- **Stories are tests.** `test-storybook` runs every story in Chromium through the Vitest addon: it renders the story, runs its `play()` interaction test and runs axe. Each component story file has a default story, its states, a keyboard `play()` and `tags: ['a11y']`.
- **Accessibility gate.** `parameters.a11y.test = 'error'`: any axe violation fails the run. The addon has no severity threshold, so moderate and minor violations block too, which is stricter than the P1.4 spec. The `Checks/A11y negative` story (tag `!test`) proves the gate: `A11Y_NEGATIVE=1` runs it alone and it fails.
- **Tenant themes.** A global toolbar resolves the P1.3 fixtures with `resolveTheme` and renders `ThemeStyleTag`; a story can pin a tenant with story-level `globals`.
- **Jest exception.** The dashboard keeps Jest through `next/jest` (P1.1). Its `transpilePackages` lists TanStack Table, which ships ESM only, so Jest transforms it too.

**Lit half, P1.5** (2026-11-07, evidence `SPECS/evidence/P1.5.md`): `@storybook/web-components-vite` 10.6.5 with the same two addons; the chat-widget Storybook runs on port 4700. Stories render the Lit elements in the real DOM; `play()` functions query inside each element's shadow root. A Tenant toolbar applies the P1.3 fixtures with the frame's own `ThemeController`, and a Locale toolbar switches `lang` and `dir` (including `ar`). `Composites/Conversation` runs the message list and composer under Acme, Globex and Initech, matching ui-react's `Composites/FilterDialog`. The configuration is hand-written like ui-react's, not generated.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

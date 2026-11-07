# Contract: project boundaries and tags (BOUND)

Source: ARCH-001 §6.2, §6.3 (ADR-002), §13 T-10. Introduced in P1.1, enforced from P1.1 onward.

## BOUND-01 Day-one projects and tags

| Nx project (= package name) | Path                       | Tags                                          |
| --------------------------- | -------------------------- | --------------------------------------------- |
| `@acme/admin-dashboard`     | `apps/admin-dashboard`     | `type:app` `scope:dashboard` `platform:react` |
| `@acme/admin-dashboard-e2e` | `apps/admin-dashboard-e2e` | `type:app` `scope:dashboard` `platform:react` |
| `@acme/widget`              | `apps/widget`              | `type:app` `scope:widget` `platform:lit`      |
| `@acme/widget-playground`   | `apps/widget-playground`   | `type:app` `scope:widget` `platform:lit`      |
| `@acme/design-tokens`       | `libs/design-tokens`       | `type:lib` `scope:shared` `platform:neutral`  |
| `@acme/theme`               | `libs/theme`               | `type:lib` `scope:shared` `platform:neutral`  |
| `@acme/ui-react`            | `libs/ui-react`            | `type:lib` `scope:shared` `platform:react`    |
| `@acme/chat-widget`         | `libs/chat-widget`         | `type:lib` `scope:widget` `platform:lit`      |

Tags live in each project's `package.json` under `nx.tags`. Every project must carry exactly one tag from each of the three dimensions; a lint-time script (`tools/scripts/check-tags.mjs`) fails CI otherwise.

## BOUND-02 Dependency constraints (`@nx/enforce-module-boundaries`)

```js
depConstraints: [
  { sourceTag: 'platform:neutral', onlyDependOnLibsWithTags: ['platform:neutral'] },
  { sourceTag: 'platform:lit', onlyDependOnLibsWithTags: ['platform:lit', 'platform:neutral'] },
  { sourceTag: 'platform:react', onlyDependOnLibsWithTags: ['platform:react', 'platform:neutral'] },
  { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
  { sourceTag: 'scope:dashboard', onlyDependOnLibsWithTags: ['scope:dashboard', 'scope:shared'] },
  { sourceTag: 'scope:widget', onlyDependOnLibsWithTags: ['scope:widget', 'scope:shared'] },
  { sourceTag: 'type:lib', onlyDependOnLibsWithTags: ['type:lib'] },
  { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:lib', 'type:app'] },
];
```

`type:app` → `type:app` is permitted only so that e2e projects may declare `implicitDependencies` on their app; no app may `import` from another app (BOUND-04 covers that with a restricted-import rule on `apps/*` paths). `enforceBuildableLibDependency` stays `true`. The template's `*` → `*` placeholder constraint is removed.

## BOUND-03 Restricted imports (ESLint `no-restricted-imports`)

| Applies to projects tagged | Forbidden import patterns                                                          | Message                                         |
| -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| `platform:lit`             | `react`, `react-dom`, `react/*`, `react-dom/*`, `next`, `next/*`, `@acme/ui-react` | React/Next must not enter widget bundles (T-10) |
| `platform:react`           | `lit`, `lit/*`, `lit-html`, `lit-element`, `@lit/*`, `@acme/chat-widget`           | Lit must not enter React bundles                |
| all                        | `@radix-ui/*`                                                                      | Forbidden unless ADR-006 selects Radix          |
| all                        | `../../apps/*`, `@acme/admin-dashboard*`, `@acme/widget*` from a `type:lib`        | Libraries never import apps                     |

Implemented as a per-tag ESLint config fragment in the root `eslint.config.mjs`, selected by project tag (a small helper reads the project's `package.json` `nx.tags`). The lint rules are in addition to BOUND-02, which catches package-level dependencies; BOUND-03 catches direct module imports and third-party packages.

## BOUND-04 Project responsibilities (must / must not)

| Project             | Owns                                                                                                                                                                    | Must not                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `admin-dashboard`   | Routes, `getRequestContext()`, data access, SSR brand layer, theme editor and preview, publish stub, dev session adapter                                                | Hold reusable UI; import `chat-widget` or `widget`                                                                            |
| `widget`            | `loader.ts`, `launcher/` (plain TS), `frame/` (Lit app shell, bootstrap, theme fetch), `bridge/protocol.ts`, `public/v1/` stubs, `headers.config.ts`, dev-server plugin | Import React/Next; accept visual input from the host page outside preview mode; perform any network request from the launcher |
| `widget-playground` | Fixture pages, embed snippet, Playwright project for widget scenarios                                                                                                   | Become a product surface; share code with `widget` other than via the public `/v1/` URLs                                      |
| `design-tokens`     | DTCG token sources, Style Dictionary config, generated CSS/TS/JSON outputs                                                                                              | Depend on any framework or on `theme`                                                                                         |
| `theme`             | TypeBox schema, emitted JSON Schema, generated types, `resolveTheme()`, `migrate()`, fixtures                                                                           | Render anything; depend on React/Lit/Next; depend on anything but `design-tokens` and TypeBox                                 |
| `ui-react`          | shadcn components on the chosen primitive, `shadcn-bridge.css`, `ThemeStyleTag`/`useTheme`, composites, Storybook                                                       | Own dashboard features; import Lit; read `cookies()`/`headers()`                                                              |
| `chat-widget`       | Lit elements, `ThemeController`, `TransportController` interface + in-memory fake, `ConsentController`, Storybook                                                       | Import React; perform network calls outside `TransportController`; touch `window.parent` (only `apps/widget/src/bridge` does) |

## BOUND-05 Bundle-level assertions (from P1.5, `[auto]`)

After `@acme/widget:build`, a script (`apps/widget/scripts/assert-bundle.mjs`) fails if any file under `dist/v1/` contains the strings `react.production`, `react-dom`, `__next`, `next/dist`, or `React.createElement`, or if gzip sizes exceed the budgets in `docs/architecture/baselines.md`. The loader output must contain no static `import` statement (only one dynamic `import(` of the launcher URL).

## BOUND-06 Triggers for new projects

New projects are created only when the trigger in ARCH-001 §6.1 ("Create later") fires, and the PR cites the trigger. `libs/widget-contracts` is the most likely first addition (when the dashboard needs bridge types at runtime, which P1.6's preview mode may trigger; if so, P1.6 creates it with tags `type:lib scope:shared platform:neutral`).

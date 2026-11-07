# Releasing the widget

The widget origin serves static files under `/v1/`. A release replaces the hashed assets and the loader; it never changes a published file in place. This checklist is the T-12 control (frame origin compromise) and the P1.7-T06 release process.

## Before

1. `pnpm verify` is green on the release commit (CI once D-22 ends), including the `visual` job.
2. `pnpm nx run @byteflock/widget:build` prints every bundle within budget (`apps/widget/budgets.json`) and ends with `assert-bundle: … budgets met`. A raised budget needs a `BUDGET-EXCEPTION:` line in the pull request.
3. The build output has `dist/v1/loader.js`, one `launcher.<hash>.js`, `frame/index.html` with hashed `frame/assets/*`, `fonts/`, and `dist/_headers`.
4. Headers: `pnpm nx e2e @byteflock/widget-playground -- --project=chromium --grep T-12` passes against `vite preview` of this build.
5. If `apps/widget/src/bridge/protocol.ts` or `libs/theme/schema/**` changed, the pull request carries `CONTRACT-CHANGE:` and a note in `docs/contract-changes/`.

## Deploy

1. Upload `dist/v1/**` except `loader.js` first. Hashed files are new names, so nothing serving today changes.
2. Apply `dist/_headers` on the static host (frame CSP and security headers; `immutable` for hashed files; 60 s for config; 5 minutes for the loader).
3. Upload `loader.js` last. It points at the new launcher hash; within its 5-minute cache lifetime every page picks up the release.
4. Check production: the frame document returns the five security headers, and a test embed reaches `ready`.

## Roll back

- **Widget code:** re-upload the previous `loader.js`. The previous launcher and frame assets are still on the host, because hashed files are never deleted during the deprecation window.
- **A tenant theme:** move `themeRevision` in `config/<widgetKey>.json` back to an earlier revision (THEME-09). Theme documents are immutable.

## Versions and deprecation

- Everything is under `/v1/`. A breaking change to the embed or the bridge ships as `/v2/` with its own loader URL.
- `v1` keeps receiving fixes for a published deprecation window after `v2` ships; hashed `v1` files stay until the window ends.
- The frame accepts theme schema versions `N` and `N-1` (THEME-10).

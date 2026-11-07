# Manual validation runbook

What the product owner does, in a browser, to validate each phase on the local stack. Each phase spec's section 10 points here. Record the outcome (date, tenant, pass/fail, notes) in `evidence/<phase>.md` under "Manual validation".

Conventions: **Expect** lines are what you must see. If you see something else, the phase is not validated; file the observation in the evidence and the phase goes back to `In progress`.

## P1.0 — Governance and CI skeleton

1. Open the repository on GitHub. **Expect:** `main` protected; PR template appears when opening a PR; CODEOWNERS listed under Settings → Code owners (no errors).
2. Open the latest CI run. **Expect:** jobs `lint-test-build (ubuntu)` present and green; no Nx Cloud step; action versions are 40-char SHAs in the workflow file.

## P1.1 — Workspace foundation

1. `pnpm install --frozen-lockfile` from a fresh clone. **Expect:** no prompts, no "ignored build scripts" warning for packages listed in `allowBuilds`.
2. `pnpm nx graph` → opens the browser. **Expect:** exactly eight projects (D-16) and the edges `admin-dashboard → ui-react, theme, design-tokens`, `widget → chat-widget, theme`, `admin-dashboard-e2e → admin-dashboard`, `widget-playground → (none)`, `ui-react → theme, design-tokens`, `chat-widget → theme, design-tokens`, `theme → design-tokens`.
3. `pnpm nx run @byteflock/admin-dashboard:dev` → `http://localhost:3000`. **Expect:** an empty "Admin dashboard" page, no template demo content, no console errors.
4. Open `libs/chat-widget/src/index.ts`, add `import React from 'react'`, run `pnpm nx lint @byteflock/chat-widget`. **Expect:** error naming the restricted import. Revert.

## PoC-A — Widget isolation

Start `pnpm stack` (dashboard may be empty). Open `http://localhost:4300/`.

1. **Clean page, three tenants.** Open `clean.html?key=wk_acme_demo`, then `…globex…`, then `…initech…`. **Expect:** launcher bottom-right blue circle / bottom-left teal pill / bottom-right amber pill; clicking opens a panel whose header colour matches; each has a different radius and font.
2. **Hostile CSS.** `hostile-css.html?key=wk_acme_demo`. **Expect:** page text is huge and RTL and buttons are garish, but the launcher and the open frame look identical to the clean page.
3. **Hostile script.** `hostile-script.html?key=wk_acme_demo`, type "secret-123" into the composer, click **Attack** on the page. **Expect:** the page's attack log shows no occurrence of "secret-123" and reports "no accessible frame document".
4. **rrweb.** `rrweb.html?key=wk_acme_demo`, type into the composer, click **Dump snapshot**. **Expect:** the dumped JSON contains an `iframe` node with no children and no "secret" text.
5. **Strict CSP.** `strict-csp.html?key=wk_acme_demo`, open DevTools console. **Expect:** widget works; zero CSP violation reports mention the widget origin; a deliberate inline `<style>` in the page is blocked (proves the policy is enforced).
6. **Two instances.** `two-instances.html`. **Expect:** two launchers (acme and globex) in opposite corners, each themed independently; opening one does not open the other.
7. **Frame blocked.** `frame-blocked.html?key=wk_acme_demo`. **Expect:** launcher appears, then after ~5 s shows a disabled state with the "Chat unavailable" tooltip; one console warning.
8. **Slow / broken config.** `slow-config.html?case=timeout`, `?case=json`, `?case=version`, `?key=wk_missing`. **Expect:** each time the frame opens with the grey embedded defaults; the widget dev console (4400 terminal) logs one telemetry beacon with the matching code.
9. **Keyboard.** On `clean.html`, press Tab from the page's first link until the launcher is focused, Enter, type, Esc. **Expect:** Enter opens and focus lands in the composer; Esc closes and focus returns to the launcher; the launcher's accessible name reads "Chat with Acme Corp" (from `data-launcher-label`).
10. **Mobile.** DevTools device toolbar 390×844, `mobile.html?key=wk_acme_demo`. **Expect:** full-viewport frame; focusing the composer with the virtual keyboard emulated keeps the composer visible; no page scroll jump.
11. **Measurements.** Open `docs/architecture/baselines.md`. **Expect:** loader, launcher and frame sizes (gz and br), launcher first paint, frame ready time at idle vs on open, with the date and machine noted.

## P1.2 — Design tokens

1. Open `libs/design-tokens/src/generated/css/semantic.css`. **Expect:** `:root { --sem-… }` block and a `[data-appearance="dark"]` block; names follow `--sem-<category>-<role>[-<state>]`; no primitive names (`--blue-500`) appear.
2. Edit a primitive value in `tokens/`, run `pnpm nx run @byteflock/design-tokens:build`, then `git diff`. **Expect:** only the derived semantic outputs changed. Revert.

## P1.3 — Theme contract

1. Open `libs/theme/schema/theme.v1.json`. **Expect:** `additionalProperties: false` under every object; the colour pattern; enums as in THEME-02.
2. Open the three valid fixtures. **Expect:** they match `validation/tenant-fixtures.md` field by field.
3. In the terminal, `pnpm nx test @byteflock/theme`. **Expect:** all malicious fixtures reported as rejected "before resolution".

## PoC-B — React primitives

Open `http://localhost:4600` (ui-react Storybook).

1. **Dialog with nested Popover** story: open the dialog, open the popover inside it, press Esc once. **Expect:** only the popover closes; Esc again closes the dialog; focus returns to the trigger.
2. **Searchable combobox** story: type "glo". **Expect:** filtered to Globex; arrow keys move; Enter selects; screen-reader text region updates (visible in the a11y panel).
3. **Multi-select filter in a dialog** story: select two agents, close, reopen. **Expect:** selection persists; chips removable by keyboard.
4. **DataTable** story: sort a column, hide a column. **Expect:** works by keyboard; a11y panel shows zero serious/critical issues.
5. **CSP story** (`Primitives/UnderStrictCSP`): **Expect:** renders with the page-level nonce-only `style-src`; no console CSP violations.

## P1.4 — React UI foundation

1. Storybook (`pnpm nx run @byteflock/ui-react:storybook`, http://localhost:4600) → "Tenant" toolbar: switch between Acme, Globex, Initech for the `Composites/FilterDialog` story (open the dialog). **Expect:** colours, radius, density change together; dark Globex is dark; text remains readable.
2. A11y panel across all stories (use the "Run all" in the addon or `pnpm nx run @byteflock/ui-react:test-storybook`). **Expect:** zero serious/critical.

## P1.5 — Frame app foundation

1. `http://localhost:4700` (chat-widget Storybook): `Frame/MessageList` and `Frame/Composer` under the three tenant themes. **Expect:** same three visual identities as the React composite (compare side by side with 4600).
2. Playground `clean.html?key=wk_acme_demo` (consent `required`): open the widget, type a message, reload. **Expect:** before consent, DevTools → Application → Storage for `localhost:4400` is empty; after the page calls `ByteflockChat('consent', {granted:true})` (button on the fixture), a visitor id appears; reload keeps it.
3. `clean.html?key=wk_globex_demo` (consent `notRequired`). **Expect:** visitor id present on first open.
4. Open `docs/architecture/baselines.md`. **Expect:** budgets (baseline + 15 %) now listed next to each measurement, and `pnpm nx run @byteflock/widget:build` prints each bundle's size against its budget.
5. Open `docs/developer-guide/embedding.md`. **Expect:** the snippet and the two-directive CSP text; nothing else required.
6. `wrong-domain.html?key=wk_wrong_domain`. **Expect:** the launcher shows "Chat unavailable" after about 5 s, and the widget dev console logs one `ORIGIN_NOT_ALLOWED` beacon. The embedding guide explains `allowedOrigins`.

## P1.6 — Themed vertical slice (the full tenant loop)

Start `pnpm stack`. Follow `local-stack.md` → "Observing the publish loop", then additionally:

1. `/dev/session` → `t_acme`, open `/`. **Expect:** the whole dashboard chrome in Acme's theme (blue primary, Inter font, medium radius), because Q-013 = full theme; page source contains one nonce'd `<style>` with the full `--sem-*` map.
2. Switch to `t_globex` in a **second browser profile or private window**, open `/`. **Expect:** teal accent; first window still blue after reload (no cross-tenant bleed).
3. DevTools → Network → document request on `/`. **Expect:** `Cache-Control: private, no-store`.
4. `/settings/theme` as `t_initech`: set `onPrimary` to the same value as `primary`. **Expect:** live contrast violation shown; **Publish** disabled with the reason.
5. Fix the colour, change the radius to `none`, watch the preview. **Expect:** preview frame (served from 4400) updates live without reload; the playground tab for `wk_initech_demo` does **not** change until Publish.
6. **Publish**, reload the playground tab. **Expect:** new radius visible; `apps/widget/public/v1/config/wk_initech_demo.json` shows `themeRevision: 2`; `themes/t_initech/2.json` exists; `1.json` unchanged.
7. **Rollback** to revision 1 in the dashboard, reload playground. **Expect:** old radius; config pointer back to 1; `2.json` still exists.
8. In production mode (playground page, not preview), run in the console: `document.querySelector('iframe').contentWindow.postMessage({v:1,type:'theme.preview',id:'x',payload:{vars:{'--sem-color-primary':'#ff0000'}}}, '*')`. **Expect:** nothing changes.
9. `pnpm stack:reset`, `git status`. **Expect:** clean under `apps/widget/public/v1/`.
10. `/settings/widget` as `t_acme`: remove `http://localhost:4300`, save, reload `clean.html?key=wk_acme_demo` in the playground. **Expect:** after about 5 s the launcher shows "Chat unavailable". Restore the origin, save, reload. **Expect:** the widget works again. Run `pnpm stack:reset` once more.

## P1.7 — Hardening and exit

1. Open a PR that deletes one test. **Expect:** CI fails with the test-count ratchet message until `TESTS-REMOVED:` is in the PR body.
2. Open a PR that edits an Accepted ADR's body. **Expect:** CI fails with the ADR immutability message.
3. Open a PR that edits `theme.v1.json`. **Expect:** CI fails until `CONTRACT-CHANGE:` trailer and a migration note exist.
4. Walk ARCH-001 §14.4 items 1–11 with the evidence file open. **Expect:** each item has a link to a green CI run or a signed manual entry.
5. README links to AGENTS.md, ADR index, SPECS, and the embedding guide.

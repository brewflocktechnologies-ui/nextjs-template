# Run and verify locally

A hands-on checklist for running the whole Phase 1 stack on your machine and checking it by eye. It covers every manual step from `SPECS/validation/manual-validation-runbook.md`, in the order you would click through them. Allow about 45 minutes for the full pass.

Each step says what to do and what you should see (**Expect**). Tick the box when it matches; note anything that doesn't.

## 1. What runs where

| What                  | URL                   | Started by                                     |
| --------------------- | --------------------- | ---------------------------------------------- |
| Admin dashboard       | http://localhost:3000 | `pnpm stack`                                   |
| Widget origin (frame) | http://localhost:4400 | `pnpm stack`                                   |
| Widget playground     | http://localhost:4300 | `pnpm stack`                                   |
| ui-react Storybook    | http://localhost:4600 | `pnpm nx run @byteflock/ui-react:storybook`    |
| chat-widget Storybook | http://localhost:4700 | `pnpm nx run @byteflock/chat-widget:storybook` |

Local tenants (all signed in through `/dev/session`, development only):

| Tenant      | Widget key        | Look                                                                   | Consent      |
| ----------- | ----------------- | ---------------------------------------------------------------------- | ------------ |
| `t_acme`    | `wk_acme_demo`    | Light, blue primary, violet accent, Inter, medium radius               | required     |
| `t_globex`  | `wk_globex_demo`  | Dark, teal primary, amber accent, Roboto, small radius, spacious       | not required |
| `t_initech` | `wk_initech_demo` | Light, amber primary, cyan accent, Source Sans 3, pill radius, compact | required     |
| `t_broken`  | none              | Stored theme is a malicious fixture; must show platform defaults       | n/a          |

## 2. Start

Prerequisites: Node 24, pnpm (version from `package.json`), and once: `pnpm install --frozen-lockfile` and `pnpm exec playwright install --with-deps chromium`. Docker only for step 10.

**Windows PowerShell note.** If `pnpm` fails with "running scripts is disabled on this system", type `pnpm.cmd` instead of `pnpm` in every command below. That runs pnpm without the PowerShell script shim and needs no change to your execution policy.

Open three terminals in the repository folder:

```bash
pnpm stack
```

```bash
pnpm nx run @byteflock/ui-react:storybook
```

```bash
pnpm nx run @byteflock/chat-widget:storybook
```

Then, in a fourth terminal:

```bash
pnpm stack:check --wait 120
```

- [ ] **Expect:** five `OK` lines (dashboard, playground, frame with five `header ok` lines, loader, config) and `stack:check passed`.

If a Storybook does not open at `localhost`, use `http://127.0.0.1:4600` or `:4700`.

## 3. Tenant switching and the themed dashboard

1. Open http://localhost:3000.
   - [ ] **Expect:** you land on `/dev/session` ("Choose a tenant") because you have no session.
2. Click **Sign in** for Acme Corp.
   - [ ] **Expect:** the home page with a blue header, "Acme Corp" brand name, Inter font, and a badge `t_acme · u_acme_admin` with a **Switch** link.
3. View the page source (Ctrl+U) and search for `data-byteflock-theme`.
   - [ ] **Expect:** exactly one `<style nonce="…" data-byteflock-theme>` containing `--sem-*` variables.
4. On the home page, click **Filter by agent**, type `ava`, pick two names with the arrow keys and Enter, press Esc twice, then reopen.
   - [ ] **Expect:** the dialog is themed; the two chips are still there after reopening; Esc first closes the list, then the dialog.
5. Open a private window, go to http://localhost:3000/dev/session and sign in as **Globex**.
   - [ ] **Expect:** a dark dashboard with a teal header, Roboto, roomier spacing. Reload the first window: still Acme blue (no cross-tenant bleed).
6. In the private window, switch to **Initech**.
   - [ ] **Expect:** amber header, Source Sans 3, compact spacing, pill-shaped buttons and fields.
7. Switch to **Broken tenant (failure fixtures)**.
   - [ ] **Expect:** a red "Development: this tenant's stored theme failed validation" banner and the neutral grey platform theme. Nothing red or odd leaks into the styles.
8. DevTools → Network → reload `/` → select the document request.
   - [ ] **Expect:** `Cache-Control` contains `no-store` (`next dev` sends `no-store`; a production build sends `private, no-cache, no-store, …`).
9. Open http://localhost:3000/healthz.
   - [ ] **Expect:** `ok`, with `Cache-Control: no-store`.

## 4. Theme editor, preview, publish, rollback

Sign in as **Initech** and open http://localhost:3000/settings/theme. Keep a second tab on http://localhost:4300/clean.html?key=wk_initech_demo.

1. Wait for the preview panel footer.
   - [ ] **Expect:** "Preview connected." under a live chat frame served from port 4400.
2. With **Colour set: light**, set **On Primary** to the same value as **Primary** (`#b45309`).
   - [ ] **Expect:** a contrast problem appears under the field and in **Checks**; **Publish** is disabled.
3. Set **On Primary** back to `#ffffff`, then change **Corner radius** to `none` and **Primary** to another dark colour (for example `#0f5132`).
   - [ ] **Expect:** **Checks** says the theme is valid; the preview frame changes within a second without reloading. The playground tab does **not** change.
4. Click **Publish**.
   - [ ] **Expect:** "Published revision 2." `apps/widget/public/v1/themes/t_initech/2.json` now exists and `config/wk_initech_demo.json` has `"themeRevision": 2`. `1.json` is unchanged.
5. Reload the playground tab and open the chat.
   - [ ] **Expect:** the new colour and square corners.
6. Reload http://localhost:3000/.
   - [ ] **Expect:** the dashboard chrome uses the published theme too.
7. Back in the editor, under **Published revisions**, click **Use revision 1**, then reload the playground tab.
   - [ ] **Expect:** "The widget now uses revision 1."; the old look returns; `2.json` still exists.

## 5. Widget domain settings (allowlist)

Sign in as **Acme** and open http://localhost:3000/settings/widget.

1. Type `https://*.example.com` in the box.
   - [ ] **Expect:** a problem "is not an exact origin" and **Save** disabled.
2. Replace the content with `https://www.example.com` and click **Save**, then reload http://localhost:4300/clean.html?key=wk_acme_demo.
   - [ ] **Expect:** "Saved."; after about 5 seconds the launcher greys out with the tooltip "Chat unavailable".
3. Put `http://localhost:4300` back, **Save**, reload the playground page.
   - [ ] **Expect:** the widget works again.
4. Open http://localhost:4300/wrong-domain.html.
   - [ ] **Expect:** "Chat unavailable" after about 5 seconds (that key only allows `https://customer.example`).

## 6. Widget on host pages (playground)

Open http://localhost:4300. Every fixture page is linked from there.

1. **Clean page** with `wk_acme_demo`: Tab to the launcher, press Enter, type a message, press Enter, press Esc.
   - [ ] **Expect:** the panel opens with focus in the message box; your message appears and an automatic reply follows about 0.3 s later; Esc closes the panel and focus returns to the launcher. The launcher's name includes the unread count before opening.
2. Same page, DevTools → Application → Storage → `http://localhost:4400` (inside the frame).
   - [ ] **Expect:** nothing stored. Click **Grant consent** on the page: `byteflock.visitorId` appears. Reload: it is still there.
3. **Clean page** with `?key=wk_globex_demo`.
   - [ ] **Expect:** dark teal widget; `byteflock.visitorId` stored at once (Globex does not require consent).
4. **Hostile CSS**.
   - [ ] **Expect:** the page's aggressive CSS does not change the launcher or the frame.
5. **Hostile script (T-01)**: open the chat, type a message, then click **Attack** on the page.
   - [ ] **Expect:** the log under the button shows the page could not read what you typed (no frame content, no keystrokes).
6. **Session recording (rrweb)**: open the chat, type something, then click **Dump snapshot**.
   - [ ] **Expect:** the snapshot shows the iframe element but none of its content or your text.
7. **Strict CSP and Trusted Types (T-08)**.
   - [ ] **Expect:** the widget works; the console shows no CSP violations for `localhost:4400`.
8. **Frame blocked by CSP**.
   - [ ] **Expect:** a greyed launcher titled "Chat unavailable" and one `[byteflock]` console warning.
9. **Two instances**.
   - [ ] **Expect:** two independently themed widgets.
10. **Config timeout**, **Invalid theme JSON**, **Unsupported theme version**, **Missing config**.
    - [ ] **Expect:** each widget still works, in the neutral grey theme.
11. **Right-to-left locale** (`?locale=ar`).
    - [ ] **Expect:** the frame's text runs right to left.
12. **Mobile**: DevTools device toolbar at 390 × 844, open the chat.
    - [ ] **Expect:** the frame fills the screen and the message box stays visible.
13. On any production-mode page (for example Clean page), run in the page console:

    ```js
    document.querySelector('iframe').contentWindow.postMessage({ v: 1, type: 'theme.preview', id: 'x', payload: { vars: { '--sem-color-primary': '#ff0000' } } }, '*');
    ```

    - [ ] **Expect:** nothing changes (preview messages only work from the dashboard).

## 7. Storybooks

1. http://localhost:4600 (ui-react). Open **Composites/FilterDialog** and use the **Tenant** toolbar to switch Acme, Globex, Initech.
   - [ ] **Expect:** colours, radius, density and font change together; Globex is dark and readable.
2. Open the **Accessibility** panel on a few stories.
   - [ ] **Expect:** no violations.
3. http://localhost:4700 (chat-widget). Open **Composites/Conversation**, switch tenants, and compare with the FilterDialog side by side.
   - [ ] **Expect:** the same three visual identities. Type a message: an automatic reply follows.
4. Set the **Locale** toolbar to `ar`.
   - [ ] **Expect:** right-to-left layout.

## 8. Design tokens and theme contract (no server needed)

1. Open `libs/design-tokens/preview/index.html` in a browser and switch appearance.
   - [ ] **Expect:** light and dark token swatches.
2. Open `libs/theme/schema/theme.v1.json`.
   - [ ] **Expect:** `"additionalProperties": false` under every object; enums as in the theme contract.

## 9. Automated gates (optional but recommended)

Stop nothing; these reuse the running stack where they can.

```bash
pnpm verify
```

- [ ] **Expect:** seven `pass` rows and `verify passed` (about 4–5 minutes).

```bash
pnpm policy:check
```

- [ ] **Expect:** `policy:check passed (14 checks)`.

To see a gate fail on purpose: delete `libs/chat-widget/src/i18n/t.spec.ts`, run `pnpm policy:check` (fails on the test count), then restore it with `git checkout -- libs/chat-widget/src/i18n/t.spec.ts`.

## 10. Visual regression (needs Docker)

```bash
pnpm visual
```

- [ ] **Expect:** `visual: all snapshots match` after a few minutes (it installs dependencies inside the pinned Linux Playwright image the first time).

## 11. Reset and stop

Publishing and domain edits write into `apps/widget/public/v1`, and drafts go to `.local/drafts`. Undo them before committing:

```bash
pnpm stack:reset
```

```bash
git status
```

- [ ] **Expect:** nothing listed under `apps/widget/public/v1/`. If `apps/admin-dashboard/next-env.d.ts` shows as modified, that is `next dev` rewriting it; restore it with `git checkout -- apps/admin-dashboard/next-env.d.ts`.

Stop the servers with Ctrl+C in each terminal. If one survives (for example after closing a window), find it with `netstat -ano | findstr :3000` (or `:4300`, `:4400`, `:4600`, `:4700`) and end the process in Task Manager.

## Sign-off

| Section                  | Result (pass / issue) | Notes | Date |
| ------------------------ | --------------------- | ----- | ---- |
| 3. Tenants and dashboard |                       |       |      |
| 4. Editor and publish    |                       |       |      |
| 5. Allowlist             |                       |       |      |
| 6. Playground            |                       |       |      |
| 7. Storybooks            |                       |       |      |
| 8. Tokens and contract   |                       |       |      |
| 9. Automated gates       |                       |       |      |
| 10. Visual regression    |                       |       |      |

Signed by: ********\_\_\_\_********

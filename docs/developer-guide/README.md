# Developer guide

## First run

1. Install Node 24. The repository's `.node-version` says `24`; `nvm`, `fnm` or Volta pick it up.
2. Clone the repository. The repository is LF-only; `.gitattributes` enforces this on checkout even when Windows sets `core.autocrlf=true`.
3. Make sure `pnpm` resolves to the version in `package.json` `packageManager` (11.28.10). Either run `corepack enable` once, or use a globally installed pnpm 9.7 or later, which switches versions automatically. Check with `pnpm --version` inside the repository.
4. Install dependencies with `pnpm install --frozen-lockfile`. Never use npm or yarn here.
5. Install the Playwright browser once with `pnpm exec playwright install --with-deps chromium`.
6. Start the local stack with `pnpm stack`, then run `pnpm stack:check` in a second terminal. The dashboard is at `http://localhost:3000`, the widget origin at `http://localhost:4400` and the playground at `http://localhost:4300`.
7. Check everything CI checks with `pnpm verify` (add `--quick` to skip end-to-end tests).

More on the local stack: `SPECS/validation/local-stack.md`.

## Local tenants

The local stack has three demo tenants and one broken one, listed in `validation/tenants.json` and described in `SPECS/validation/local-stack.md` and `SPECS/validation/tenant-fixtures.md`.

- Open `http://localhost:3000/dev/session` and pick a tenant. This development-only page sets a signed `dev-session` cookie (D-12); it does not exist in production builds.
- The badge in the dashboard header shows `tenant · user` and links back to the switcher.
- To see two tenants side by side, use a second browser profile or a private window: the session is a cookie.
- `t_broken` has no widget, and its stored theme is a malicious fixture (set in `apps/admin-dashboard/.env.development`). The dashboard shows the platform default theme and a development banner.
- Development defaults live in `apps/admin-dashboard/.env.development` (committed, no secrets). Put overrides in `apps/admin-dashboard/.env.local`.

## Theme editor

`/settings/theme` edits the signed-in tenant's theme.

1. Change any field. The **Checks** section validates the theme and lists contrast problems next to the colour that causes them; **Publish** stays disabled until there are none.
2. The **Preview** panel is the real widget frame from `http://localhost:4400` in preview mode. Changes reach it within a moment, without a reload. The server resolves the variables (`POST /api/theme/resolve`); the browser never resolves raw input.
3. **Save draft** stores the draft in `.local/drafts/<tenantId>.json` (gitignored).
4. **Publish** saves the draft and publishes it: the server checks schema and contrast again, writes `apps/widget/public/v1/themes/<tenantId>/<n>.json` (never overwriting), then moves `config/<widgetKey>.json` to it. Reload a playground page to see the change. The dashboard chrome uses it on the next page load.
5. **Use revision n** rolls the widget back: only the pointer moves.

Publishing writes into the widget's folder, which is development-only (D-13). Run `pnpm stack:reset` before committing; `pnpm policy:check` fails while those files differ from `validation/widget-fixtures`.

`/settings/widget` edits the widget key's allowed origins the same way (D-21). Removing `http://localhost:4300` makes the playground widget unavailable on its next load.

## Windows notes

- Use PowerShell or Git Bash. Every repository script is Node, so neither needs extra tools.
- Use one checkout per environment, either native Windows or WSL2, not both on the same folder.
- If ports 3000, 4300, 4400, 4600 or 4700 are taken, free them rather than changing them. The widget's preview mode is pinned to the dashboard origin.
- `next dev` regenerates `apps/admin-dashboard/next-env.d.ts` and `apps/admin-dashboard/AGENTS.md`. Commit them as they are.
- Stop `pnpm stack` with Ctrl+C in its terminal. If a dev server survives, for example after closing the terminal window, find it with `netstat -ano | findstr :4400` and end it in Task Manager.

## Where things are

- Rules for agents and developers: `AGENTS.md`.
- Phase specs and the status board: `SPECS/`.
- Decisions: `docs/adr/`.

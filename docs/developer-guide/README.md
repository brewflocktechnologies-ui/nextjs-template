# Developer guide

## First run

1. Install Node 24. The repository's `.node-version` says `24`; `nvm`, `fnm` or Volta pick it up.
2. Clone the repository. The repository is LF-only; `.gitattributes` enforces this on checkout even when Windows sets `core.autocrlf=true`.
3. Make sure `pnpm` resolves to the version in `package.json` `packageManager` (11.28.10). Either run `corepack enable` once, or use a globally installed pnpm 9.7 or later, which switches versions automatically. Check with `pnpm --version` inside the repository.
4. Install dependencies with `pnpm install --frozen-lockfile`. Never use npm or yarn here.
5. Install the Playwright browser once with `pnpm exec playwright install --with-deps chromium`.
6. Install and start Docker Desktop (Windows: with the WSL2 backend; Linux: Docker Engine with Compose v2). The dashboard's database runs in it (see "Local database").
7. Start the local stack with `pnpm stack`; it starts and migrates Postgres first, then run `pnpm stack:check --wait 120` in a second terminal; it retries until the servers are up. The first line of the `pnpm stack` log, "@nx/playwright: could not infer an Nx task from the webServer command…", is a harmless notice. The dashboard is at `http://localhost:3000`, the widget origin at `http://localhost:4400` and the playground at `http://localhost:4300`.
8. Check everything CI checks with `pnpm verify` (add `--quick` to skip end-to-end tests).

More on the local stack: `SPECS/validation/local-stack.md`.

## Local tenants and users

The local stack has three demo tenants and one broken one, listed in `validation/tenants.json` and described in `SPECS/validation/local-stack.md` and `SPECS/validation/tenant-fixtures.md`. They and their users live in Postgres (see "Local database").

- Open `http://localhost:3000/dev/session` and pick a user: the super admin under **Platform**, or a tenant's admin or agent. This development-only page sets a signed `dev-session` cookie (D-12); it does not exist in production builds.
- The badge in the dashboard header shows `<tenant> · <user> · <role>` (or `platform · <user>`) and links back to the switcher.
- `Acme Agent` is an agent: the settings pages are read-only for it.
- To see two tenants side by side, use a second browser profile or a private window: the session is a cookie.
- `t_broken` has no widget, and its stored theme is a malicious fixture (set in `apps/admin-dashboard/.env.development`). The dashboard shows the platform default theme and a development banner.
- Development defaults live in `apps/admin-dashboard/.env.development` (committed, no secrets). Put overrides in `apps/admin-dashboard/.env.local`.

## Theme editor

`/settings/theme` edits the signed-in tenant's theme.

1. Change any field. The **Checks** section validates the theme and lists contrast problems next to the colour that causes them; **Publish** stays disabled until there are none.
2. The **Preview** panel is the real widget frame from `http://localhost:4400` in preview mode. Changes reach it within a moment, without a reload. The server resolves the variables (`POST /api/theme/resolve`); the browser never resolves raw input.
3. **Save draft** stores the draft in Postgres (`theme_drafts`).
4. **Publish** saves the draft and publishes it: the server checks schema and contrast again, records the next immutable revision and moves the published pointer in one transaction, then writes `apps/widget/public/v1/themes/<tenantId>/<n>.json` (never overwriting) and moves `config/<widgetKey>.json` to it. If that file write fails, the publish still stands; `pnpm db:materialise` writes the files. Reload a playground page to see the change. The dashboard chrome uses it on the next page load.
5. **Use revision n** rolls the widget back: only the pointer moves.

Publishing writes into the widget's folder, which is development-only (D-13). Run `pnpm stack:reset` before committing; `pnpm policy:check` fails while those files differ from `validation/widget-fixtures`.

`/settings/dashboard` sets the tenant's dashboard config (`SPECS/contracts/tenant-config-v1.md`): which modules the team sees (a disabled module disappears from the nav and its pages return 404 for tenant users), the default locale, and the home title and notice, shown as plain text.

`/settings/widget` edits the widget key's allowed origins the same way (D-21). Removing `http://localhost:4300` makes the playground widget unavailable on its next load.

## Local database

P2.1 adds Postgres 17 in Docker (`compose.yaml`, ADR-012). Only the dashboard's Next.js server talks to it; the widget still reads static files.

- **Start and stop.** `pnpm db:up` starts it and waits until it is healthy; `pnpm db:down` stops it, keeping the data. `pnpm stack` and `pnpm verify` run `db:up` themselves. It listens on `127.0.0.1:5440`.
- **Databases and roles.** `byteflock` is the stack's database, `byteflock_test` the tests'. Migrations and seeds connect as the owner `byteflock`; the dashboard connects as `byteflock_app` (`DATABASE_URL` in `apps/admin-dashboard/.env.development`), which is not the owner and cannot bypass row-level security. Credentials are local-only defaults.
- **Migrations.** Plain SQL in `apps/admin-dashboard/db/migrations/NNNN_<name>.sql`, applied by `pnpm db:migrate` in order, one transaction each, recorded with a checksum. Forward-only: never edit an applied file (the runner fails on a changed checksum); add a new one.
- **Seed and reset.** `pnpm db:seed` inserts the fixture tenants and users if missing (it never overwrites local edits). `pnpm db:reset` wipes the volume and starts again. `pnpm db:recreate -- --database=<name>` rebuilds one database without restarting the container. `pnpm stack:reset` puts files and database back to the fixtures together.
- **Static files.** The widget serves `apps/widget/public/v1`, a projection of the database written after each publish. `pnpm db:materialise` rewrites it from the database.
- **Writing code.** Import `pg` only under `src/server/db/**` (lint enforces it). Query through `withScope(ctx, fn)`, which sets the tenant (or platform) scope for one transaction so row-level security applies. Data functions in `src/data/**` take `tenantId` first. Route handlers start with `requireTenantTarget(request, action)`, which authorizes before any data access.
- **Tests.** The dashboard unit tests and e2e suites need the database running. Some unit suites create databases of their own (`byteflock_test_data`, `byteflock_test_cfg`, `byteflock_test_mat`). The e2e global setup resets the database its dashboard server uses.
- **Inspecting data.** `docker compose exec db psql -U byteflock -d byteflock`. The owner `byteflock` is the image's superuser, so it sees every row: superusers bypass row-level security even when it is forced. To see what the dashboard sees, switch role and scope in a transaction: `BEGIN; SET LOCAL ROLE byteflock_app; SELECT set_config('app.tenant_id', 't_acme', true); SELECT * FROM tenants; ROLLBACK;`.

## Platform admin

The super admin (`u_platform_admin`, ADR-013) manages every tenant from one place.

1. Open `/dev/session` and choose **Platform Admin (super admin)**. You land on `/platform`, the tenant list (name, widget key, published revision). The failure-fixture tenant `t_broken` is hidden there.
2. Open a tenant. Its pages are the overview, **Theme**, **Dashboard** and **Widget**, under `/platform/tenants/<tenantId>/`. They use the same editors as the tenant's own settings, with the tenant named in every API call (`?tenantId=`).
3. The dashboard chrome always keeps the platform default design (D-25), so you can always tell you are acting as the platform. A tenant's design appears only inside the labelled **Preview: <tenant name>** box and in the widget preview frame.
4. A tenant's disabled modules do not apply to you: you can always open its theme and widget pages.

Routing rules: a super admin who opens a tenant route (`/`, `/settings/**`) is sent to `/platform`; a tenant user who opens `/platform/**` gets a 404, so the route is not revealed. Authorization lives in one function, `authorize(ctx, tenantId, action)` (`src/server/authorize.ts`): platform scope may do everything; a tenant admin everything on their own tenant; an agent only the read actions.

## Windows notes

- Use PowerShell or Git Bash. Every repository script is Node, so neither needs extra tools.
- Use one checkout per environment, either native Windows or WSL2, not both on the same folder.
- Docker Desktop must use the WSL2 backend and be running before `pnpm stack` or `pnpm verify`.
- If ports 3000, 4300, 4400, 4600, 4700 or 5440 are taken, free them rather than changing them. The widget's preview mode is pinned to the dashboard origin.
- `next dev` regenerates `apps/admin-dashboard/next-env.d.ts` (it points at `.next/dev/types`, while a build points it at `.next/types`) and `apps/admin-dashboard/AGENTS.md`. Expect `next-env.d.ts` to show as modified after running the stack; restore it with `git checkout -- apps/admin-dashboard/next-env.d.ts` before committing unless you meant to change it.
- Stop `pnpm stack` with Ctrl+C in its terminal. If a dev server survives, for example after closing the terminal window, find it with `netstat -ano | findstr :4400` and end it in Task Manager.

## Where things are

- Rules for agents and developers: `AGENTS.md`.
- Phase specs and the status board: `SPECS/`.
- Decisions: `docs/adr/`.

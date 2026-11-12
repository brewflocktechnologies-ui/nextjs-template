# Local stack

How to run everything on one developer machine (Windows 11 or Linux) so the product owner can validate each phase with real tenants. Available in full from P1.6; partial stacks are noted per phase.

## Processes and origins (D-10)

| Process                                      | Nx target                          | Origin                  | Available from                       |
| -------------------------------------------- | ---------------------------------- | ----------------------- | ------------------------------------ |
| Admin dashboard (Next.js dev)                | `@byteflock/admin-dashboard:dev`   | `http://localhost:3000` | P1.1 (empty shell), themed from P1.6 |
| Widget static origin (Vite dev + dev plugin) | `@byteflock/widget:dev`            | `http://localhost:4400` | PoC-A                                |
| Widget playground (Vite dev)                 | `@byteflock/widget-playground:dev` | `http://localhost:4300` | PoC-A                                |
| ui-react Storybook                           | `@byteflock/ui-react:storybook`    | `http://localhost:4600` | PoC-B / P1.4                         |
| chat-widget Storybook                        | `@byteflock/chat-widget:storybook` | `http://localhost:4700` | P1.5                                 |
| Postgres 17 (Docker Compose service `db`)    | `pnpm db:up` (not an Nx target)    | `127.0.0.1:5440`        | P2.1                                 |

Playground (4300) and widget (4400) are **different origins on purpose**; never proxy one through the other, or every isolation test becomes meaningless.

## Commands

Root `package.json` scripts (added in P1.1, extended as processes appear):

```bash
pnpm stack            # Postgres up and migrated, then dashboard + widget + playground, streaming logs
pnpm stack:check      # prints OK/FAIL for each origin and the database (tools/scripts/stack-check.mjs)
pnpm storybook:ui     # ui-react Storybook on 4600 (PoC-B / P1.4)
pnpm storybook:widget # chat-widget Storybook on 4700 (P1.5)
pnpm stack:reset      # widget files back to the fixtures, then the database reset and materialised
```

`pnpm stack` first runs `db:up` (starts Postgres and waits until it is healthy) and `db:migrate`, then `nx run-many -t dev -p @byteflock/admin-dashboard @byteflock/widget @byteflock/widget-playground --output-style=stream`. Nx runs continuous `dev` targets side by side; stop with Ctrl+C once.

`stack:check` is a Node script, so it needs no curl on Windows. It fetches `http://localhost:3000/dev/session` (the dashboard redirects `/` without a session), `http://localhost:4300/` and `http://localhost:4400/v1/frame/`, and compares the frame's response headers with `apps/widget/src/headers.config.ts`. It also probes `http://localhost:4400/v1/loader.js` and `http://localhost:4400/v1/config/wk_acme_demo.json`, reported as "not yet" until PoC-A creates them. Each endpoint must return its expected content type, so an HTML fallback page never passes as JavaScript or JSON. `pnpm stack:check --wait 120` retries while the servers start.

`stack:check` also connects to the database (P2.1) and reports three things: reachable, every migration file applied with a matching checksum (pending or edited files are named), and the seed present (the three tenants and a super admin).

The widget origin uses Vite `appType: 'mpa'`: unknown paths return 404, as they will on the static host, and a request for `/v1/frame/` serves `/v1/frame/index.html`.

## Database (P2.1)

Postgres 17 runs in Docker (`compose.yaml`) on `127.0.0.1:5440` with a named volume `byteflock-pg`. Port 5440 avoids other local Postgres instances on 5432/5433; free it rather than changing it. Two databases: `byteflock` (the stack) and `byteflock_test` (tests). Local-only credentials: the owner `byteflock`/`byteflock` runs migrations and seeds; the dashboard connects as `byteflock_app`/`byteflock_app`, which row-level security always applies to.

```bash
pnpm db:up            # start Postgres and wait until healthy
pnpm db:down          # stop it (the data stays in the volume)
pnpm db:migrate       # apply pending migrations; `-- --database=byteflock_test` for the test database
pnpm db:seed          # insert the fixture tenants and users if missing (refuses NODE_ENV=production)
pnpm db:reset         # remove the container and volume, start again, migrate, seed
pnpm db:recreate      # drop, create, migrate and seed one database without restarting the container
pnpm db:materialise   # rebuild apps/widget/public/v1 from the database (repairs a failed publish write)
pnpm db:bootstrap     # roles and the test database on a fresh server (CI; Compose does it itself)
```

**Reset flow.** `pnpm stack:reset` does three things in order. It restores `apps/widget/public/v1/{config,themes}` from `validation/widget-fixtures/v1`, which removes files from local publishes and brings back the hand-written failure fixtures. It runs `db:reset` (wipe the volume, migrate, seed) and `db:seed`. Then it runs `db:materialise`, which must report `0 written, 6 already correct`: the database's documents equal the fixtures byte for byte (P2.1-AC11). `pnpm stack:reset --files` restores only the files.

Docker must be running: Docker Desktop with the WSL2 backend on Windows, Docker Engine with Compose v2 on Linux. Without it, `db:up`, `pnpm stack` and the first step of `pnpm verify` stop with a message saying so.

End-to-end tests work with or without `pnpm stack` running. Each Playwright config starts Vite or `next dev` directly and reuses a server that is already listening. (Using `nx run …:dev` there would make Nx start a second server, which collides with the stack on the strict ports.) The dashboard e2e global setup resets the database that server uses: `byteflock_test` when Playwright starts the server, the stack database `byteflock` when it reuses `pnpm stack` (the dev server names its database on `/healthz`, development only).

## Environment

No setup is needed: the dashboard's development defaults are committed in `apps/admin-dashboard/.env.development` (no secrets; P1.6). To override a value, put it in `apps/admin-dashboard/.env.local` (gitignored). `.env.local.example` at the root lists the values:

```
DATABASE_URL=postgres://byteflock_app:byteflock_app@localhost:5440/byteflock
DEV_SESSION_SECRET=dev-only-secret-change-me
DASHBOARD_ORIGIN=http://localhost:3000
WIDGET_ORIGIN=http://localhost:4400
THEME_PUBLISH_DIR=../widget/public/v1
NEXT_PUBLIC_WIDGET_ORIGIN=http://localhost:4400
```

The dashboard reads `WIDGET_ORIGIN` to build the preview iframe URL and `THEME_PUBLISH_DIR` for the publish stub (D-13). The frame reads nothing from env: its dashboard origin for preview mode is baked at build from `DASHBOARD_ORIGIN` (locally `http://localhost:3000`).

## Switching users (dashboard)

Open `http://localhost:3000/dev/session`. The page lists every user in the database (P2.1-T12): the super admin under **Platform**, then each tenant with its admins and agents (`tenant-fixtures.md`, Users). Clicking a user signs the `dev-session` cookie and redirects to `/platform` for the super admin or `/` for a tenant user. The header badge shows `platform · u_platform_admin` or `<tenant> · <user> · <role>`, in development builds only. Available from P1.6 (D-12); users from the database since P2.1.

## Viewing tenants (widget)

The playground serves one page per tenant per fixture: `http://localhost:4300/<fixture>.html?key=<widgetKey>`, for example `http://localhost:4300/clean.html?key=wk_globex_demo`. The playground index page (`/`) lists every fixture × tenant combination as links. Available from PoC-A.

## Observing the publish loop (from P1.6)

1. Dashboard → `/dev/session` → pick `t_globex`.
2. Dashboard → `/settings/theme` → change the primary colour → the preview frame updates live (preview mode).
3. Click **Publish** → the dashboard records revision `<n+1>` in Postgres and moves the published pointer in one transaction, then writes `apps/widget/public/v1/themes/t_globex/<n+1>.json` and updates `apps/widget/public/v1/config/wk_globex_demo.json` (P2.1: drafts and revisions are in the database; the widget files are their projection).
4. Playground → reload `clean.html?key=wk_globex_demo` → the widget shows the new colour. Vite's dev server serves `public/` without caching, so the 60 s TTL does not apply locally.
5. `pnpm stack:reset` to restore the committed fixtures and reset the database before committing (local publishes are never committed; `git status` must be clean under `apps/widget/public/v1/` after a validation session, enforced by a pre-commit check from P1.6).

## Failure-mode fixtures (from PoC-A)

The widget dev plugin (D-14) answers:

| URL                                | Behaviour                                           |
| ---------------------------------- | --------------------------------------------------- |
| `/v1/config/<key>.json?delay=3000` | responds after 3 s (frame times out at 2 s)         |
| `/v1/dev/invalid-json`             | `200` with `{not json`                              |
| `/v1/dev/unsupported-version`      | a theme document with `schemaVersion: 99`           |
| `POST /v1/telemetry`               | `204`, logs the JSON body to the widget dev console |

`slow-config.html?case=timeout|json|version` in the playground points the frame at these via `key=wk_broken_*` entries in `tenant-fixtures.md`.

## Windows notes

- Run from PowerShell or Git Bash; all scripts are Node.
- Docker Desktop with the WSL2 backend runs Postgres. Start it before `pnpm stack`.
- If port 3000 (or 5440 for Postgres) is taken, `pnpm stack` fails fast; free the port rather than changing it (the frame's preview-mode origin is baked to 3000).
- Playwright browsers: `pnpm exec playwright install --with-deps` once (on Windows, `--with-deps` is a no-op and harmless).
- Line endings: `.gitattributes` forces LF; if `git status` shows the whole tree modified after clone, run `git config core.autocrlf false` and re-checkout.

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

Playground (4300) and widget (4400) are **different origins on purpose**; never proxy one through the other, or every isolation test becomes meaningless.

## Commands

Root `package.json` scripts (added in P1.1, extended as processes appear):

```bash
pnpm stack            # dashboard + widget + playground, streaming logs
pnpm stack:check      # prints OK/FAIL for each origin (tools/scripts/stack-check.mjs)
pnpm stack:books      # both Storybooks
pnpm stack:reset      # restores apps/widget/public/v1 from validation fixtures (undoes local publishes)
```

`pnpm stack` is `nx run-many -t dev -p @byteflock/admin-dashboard @byteflock/widget @byteflock/widget-playground --output-style=stream`. Nx runs continuous `dev` targets side by side; stop with Ctrl+C once.

`stack:check` must be a Node script (no curl dependency on Windows): it fetches `http://localhost:3000/`, `http://localhost:4400/v1/loader.js`, `http://localhost:4400/v1/config/wk_acme_demo.json`, `http://localhost:4300/` and prints status codes and the frame headers of `http://localhost:4400/v1/frame/`.

## Environment

`.env.local.example` at the root (copied to `.env.local`, which is gitignored):

```
DEV_SESSION_SECRET=dev-only-secret-change-me
DASHBOARD_ORIGIN=http://localhost:3000
WIDGET_ORIGIN=http://localhost:4400
THEME_PUBLISH_DIR=../widget/public/v1
NEXT_PUBLIC_WIDGET_ORIGIN=http://localhost:4400
```

The dashboard reads `WIDGET_ORIGIN` to build the preview iframe URL and `THEME_PUBLISH_DIR` for the publish stub (D-13). The frame reads nothing from env: its dashboard origin for preview mode is baked at build from `DASHBOARD_ORIGIN` (locally `http://localhost:3000`).

## Switching tenants (dashboard)

Open `http://localhost:3000/dev/session`. The page lists the tenants from `validation/tenant-fixtures.md` with one button each; clicking sets the signed `dev-session` cookie and redirects to `/`. The current tenant and user are shown in the dashboard header in development builds only. Available from P1.6 (D-12).

## Viewing tenants (widget)

The playground serves one page per tenant per fixture: `http://localhost:4300/<fixture>.html?key=<widgetKey>`, for example `http://localhost:4300/clean.html?key=wk_globex_demo`. The playground index page (`/`) lists every fixture × tenant combination as links. Available from PoC-A.

## Observing the publish loop (from P1.6)

1. Dashboard → `/dev/session` → pick `t_globex`.
2. Dashboard → `/settings/theme` → change the primary colour → the preview frame updates live (preview mode).
3. Click **Publish** → the dashboard writes `apps/widget/public/v1/themes/t_globex/<n+1>.json` and updates `apps/widget/public/v1/config/wk_globex_demo.json`.
4. Playground → reload `clean.html?key=wk_globex_demo` → the widget shows the new colour. Vite's dev server serves `public/` without caching, so the 60 s TTL does not apply locally.
5. `pnpm stack:reset` to restore the committed fixtures before committing (local publishes are never committed; `git status` must be clean under `apps/widget/public/v1/` after a validation session, enforced by a pre-commit check from P1.6).

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
- If port 3000 is taken by another Next app, `pnpm stack` fails fast; free the port rather than changing it (the frame's preview-mode origin is baked to 3000).
- Playwright browsers: `pnpm exec playwright install --with-deps` once (on Windows, `--with-deps` is a no-op and harmless).
- Line endings: `.gitattributes` forces LF; if `git status` shows the whole tree modified after clone, run `git config core.autocrlf false` and re-checkout.

# Decisions: reconciling ARCH-001 with the repository as found

ARCH-001 v0.3 assumes an empty folder and `create-nx-workspace`. The product owner has instead chosen to start from the Nx Next.js template already present in `C:\CODE\nextjs-template`. This file records every place where the repository and the document disagree, the decision taken, and what it changes. Specs cite these as `D-nn`.

Decisions marked **Default** were taken by the spec author so work is not blocked; the product owner can overturn them at P0 at the stated cost. Decisions marked **Fixed** follow directly from ARCH-001 or from the product owner's instruction to reuse this repository.

## Repository state on 7 November 2026 (baseline for these decisions)

| Fact                         | Value                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager              | npm 11 with `workspaces: ["apps/*", "packages/*"]`, `package-lock.json` committed                                                       |
| Nx                           | 24.0.0 (all `@nx/*` at 24.0.0); plugins present: devkit, eslint, jest, js, next, playwright, react, vite, vitest, web, workspace        |
| Next.js / React / TypeScript | 16.4.3 / 19 / 6.0.3                                                                                                                     |
| Node locally / in CI         | 24.20.0 / 24 (`actions/setup-node`)                                                                                                     |
| pnpm, corepack               | Installed locally (corepack 0.35)                                                                                                       |
| Projects                     | `@nextjs-template/web` (apps/web), `@nextjs-template/web-e2e`, `@nextjs-template/ui` (packages/ui)                                      |
| Linking                      | npm workspaces + TypeScript project references; `ui` exports `./src/index.ts`; Next consumes it from source with no `transpilePackages` |
| CI                           | `.github/workflows/ci.yml` with Nx Cloud steps (`start-ci-run`, `record`, `fix-ci`), unpinned action tags, `npm ci`                     |
| Governance files             | No `.gitattributes`, `.node-version`, `CODEOWNERS`, PR template, `docs/`, ADRs                                                          |
| Git remote                   | `origin` still points at `nrwl/nextjs-template`                                                                                         |
| Test-only quirk              | `next dev` regenerates `apps/web/next-env.d.ts` and `apps/web/AGENTS.md`                                                                |

## Decision register

### D-01 — Start from the existing template, not from `create-nx-workspace` — **Fixed**

The workspace is this repository. ARCH-001 §19 step "create-nx-workspace" is replaced by P1.1's conversion tasks. The P0 approval text (§20.1) reads "before P1.1 conversion" instead of "before `create-nx-workspace`".

### D-02 — Migrate from npm to pnpm 11 in P1.1 — **Default**

**Decided 2026-11-07 by Madhusudan C P: migrate to pnpm 11 in P1.1.**

ARCH-001 (PO-004, ADR-001, ADR-011) requires pnpm; the supply-chain controls (`minimumReleaseAge`, `strictDepBuilds`, `allowBuilds`) do not exist in npm. The repository is small (3 projects), so migrating now is cheap; later it is not.
_If overturned (stay on npm):_ ADR-011 must be rewritten around npm (`npm ci`, `ignore-scripts`, manual cooldown via Renovate only), and every `pnpm nx` in these specs reads `npx nx`. Cost: medium, before P1.1.

### D-03 — Library folder is `libs/`, apps stay in `apps/` — **Fixed**

ARCH-001 §6.1 uses `libs/`. The template's `packages/` folder is removed in P1.1 (its only content, `packages/ui`, is template demo code replaced by `libs/ui-react`). Workspace globs become `apps/*`, `libs/*`.

### D-04 — Rename `web` to `admin-dashboard`; remove template demo content — **Fixed**

`apps/web` → `apps/admin-dashboard` (`@nx/workspace:move`), `apps/web-e2e` → `apps/admin-dashboard-e2e`. The demo home page, `packages/ui` components and the `api/hello` route are deleted; the generated Next app skeleton (layout, global.css, Jest/Playwright wiring, `next.config.js` with the Turbopack root pin) is kept. Keeping the template's working Jest/Playwright/project-reference wiring is the main reason to reuse the repository.

### D-05 — Nx stays at 24.0.0; Next 16.4.3; TypeScript 6.0.3 — **Fixed**

ARCH-001 §6.5 cites Nx 23.1 as current on 6 Nov 2026; this repository is already on 24.0.0 and all plugins match. Do not downgrade. New plugins (`@nx/storybook`, `@nx/web` is present) are added at exactly `24.0.0`. ADR-001 records the versions actually installed, not the document's table.

### D-06 — Package scope placeholder is `@acme`; element prefix `acme` — **Default**

**Decided 2026-11-07 by Madhusudan C P: the brand is `byteflock`.** Package scope `@byteflock/*`, root package `@byteflock/source`, custom element `byteflock-chat-v1`, JS API `window.ByteflockChat`, status attribute `data-byteflock-chat`, Trusted Types policy `byteflock-frame`, element prefix `byteflock-`, storage key prefix `byteflock.`. The specs keep `acme` until P1.1-T00 performs the rename in one commit, so they stay traceable to ARCH-001 until the projects exist.

ARCH-001 uses `@acme/*`, `acme-chat-v1`, `data-acme-chat`, Trusted Types policy `acme-frame` throughout. Specs keep these so they stay traceable to the document. The product owner supplies the real brand at P0; renaming is a single find-and-replace before P1.1 creates the projects. After P1.1 the rename costs a project move per package.

### D-07 — Next.js consumes workspace TypeScript packages from source — **Fixed (resolves ARCH-001 §6.4 P1.1 verification item)**

Verified in this repository: `apps/web` imports `@nextjs-template/ui` whose `exports` point at `./src/index.ts`; Next 16 compiles it with no `transpilePackages`, and the web `build` depends on `^typecheck` so the library is type-checked first. ADR-001 records this as the linking mechanism: workspace package + `exports` to source + TypeScript project references + `dependsOn: ["^build", "^typecheck"]` on app builds. No build step for libraries in Phase 1.

### D-08 — No Nx Cloud; remove the Cloud steps from CI in P1.0 — **Fixed (PO-013)**

`nx start-ci-run`, `nx record`, `nx fix-ci` and the README's Nx Cloud banner are removed. CI caches `.nx/cache` with `actions/cache` keyed by lockfile and branch. `nx.json` `analytics` is set to `false`. Remote cache is re-decided at P1.7.

### D-09 — `SPECS/` is the Phase-1 specification home; OpenSpec deferred — **Default**

ARCH-001 §6.1/§15.1 name `openspec/`. The product owner asked for `SPECS/`. Running both would duplicate. P1.7's retrospective decides whether to adopt the OpenSpec layout; until then CODEOWNERS protects `SPECS/**` in place of `openspec/specs/**`.

### D-10 — Ports for the local stack — **Default**

`admin-dashboard` 3000 · `widget-playground` 4300 · `widget` 4400 · `ui-react` Storybook 4600 · `chat-widget` Storybook 4700. Playground and widget must be different origins (different ports suffice); see `validation/local-stack.md`.

### D-11 — Local tenant set — **Default**

Four tenants, three valid and one failure fixture, defined once in `validation/tenant-fixtures.md` and used by every phase's manual validation. The three valid tenants are exactly the "light, dark, compact/high-radius" trio ARCH-001 §14.4 item 4 requires.

### D-12 — Dev session adapter and tenant switcher — **Fixed (ARCH-001 §9.1) with local detail**

Signed `dev-session` cookie (HMAC-SHA256 over `{tenantId,userId,roles,locale}`), secret from `DEV_SESSION_SECRET` with a documented dev default, module refuses to load when `NODE_ENV === 'production'`. A dev-only route `/dev/session` lists the tenants and sets the cookie, so the product owner can switch tenants in one click. Specified in P1.6; the route and adapter are the only "dev-only" code allowed in `admin-dashboard`, guarded by one `isDevOnly()` helper.

### D-13 — Theme publish stub writes into the widget's static folder in development — **Default**

P1.6's publish stub writes `/v1/themes/<tenantId>/<rev>.json` and updates `/v1/config/<widgetKey>.json` under `apps/widget/public/v1/` (path from `THEME_PUBLISH_DIR`, dev only). This makes the Draft → Preview → Publish → widget loop fully observable on the local stack without a backend. Production publish is the Java backend's job (later).

### D-14 — Widget dev server provides the failure-mode fixtures — **Default**

The static endpoints are plain files, but PoC-A's `slow-config`, invalid-JSON and unsupported-version cases need behaviour. A Vite dev-server plugin in `apps/widget` serves `/v1/config/<key>.json?delay=3000`, `/v1/dev/invalid-json`, `/v1/dev/unsupported-version`, and accepts `POST /v1/telemetry` (logs to console). The same plugin applies the frame's response headers in `dev` and `preview`. Production headers come from one source file emitted as `_headers` at build.

### D-15 — Widget build shape — **Default**

`apps/widget` builds in two steps orchestrated by its `build` target: (1) Vite app build for `launcher` (ESM, hashed) and `frame/index.html` (+ hashed assets) under `dist/v1/`; (2) Vite library build of `loader.ts` as IIFE to `dist/v1/loader.js` with the launcher's hashed URL injected via `define`. The loader is the only non-hashed script. Implementers may choose a different mechanism if the outputs and the "loader has no static imports" rule hold.

### D-16 — Eight day-one Nx projects, not seven — **Fixed (clarifies ARCH-001 §6.1 vs §16)**

`admin-dashboard`, `admin-dashboard-e2e`, `widget`, `widget-playground`, `design-tokens`, `theme`, `ui-react`, `chat-widget`. ARCH-001 §16 says "7 projects" because it does not count the e2e project; §14.4 item 1 ("exactly the day-one projects of §6.1") means these eight.

### D-17 — CI runs the full target set on Linux; Windows job builds the widget and smoke-tests the playground — **Fixed (ARCH-001 §6.5)**

Added in P1.1. Windows job: `pnpm install --frozen-lockfile`, `pnpm nx run @byteflock/widget:build`, `pnpm nx run @byteflock/widget-playground:e2e --project=chromium --grep @smoke`.

### D-18 — Git remote and branch protection are the product owner's manual steps — **Fixed**

P1.0 lists them as manual tasks: repoint `origin` to the product's private repository, protect `main` (required checks = the CI job names, required review, no force-push). Agents cannot and must not do this.

### D-19 — `next dev` generated files are committed — **Fixed**

`apps/admin-dashboard/next-env.d.ts` and `apps/admin-dashboard/AGENTS.md` (Next 16 agent rules) are committed as generated. `.gitattributes` marks them `linguist-generated`. Nothing in them may be hand-edited.

## Open questions: defaults adopted (ARCH-001 §19)

The specs implement the **default** column unless the product owner records a different answer in `STATUS.md` at P0.

| ID        | Default implemented                                                                           | Where it bites                                              |
| --------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Q-001     | No client portal                                                                              | —                                                           |
| Q-002     | Tenant edits semantic colours, typography id, shape, elevation, density, brand, launcher      | `contracts/theme-contract-v1.md` policy column; P1.6 editor |
| Q-003     | Tenant chooses `light`/`dark`/`system`; both colour sets always present                       | Theme schema                                                |
| Q-004     | Curated font ids only                                                                         | Theme schema, widget fonts                                  |
| Q-005     | Multiple widgets per page: test-only isolation                                                | PoC-A fixture `two-instances`                               |
| Q-006     | Nothing persistent until `consent { granted: true }`                                          | P1.5 consent gate                                           |
| Q-007     | Dashboard and frame: Baseline Widely Available; launcher never breaks unsupported hosts       | ADR-009                                                     |
| Q-008     | `widgetKey` is public, revocable, non-secret                                                  | Endpoints contract                                          |
| Q-009     | TTLs per `contracts/public-endpoints-and-headers.md`                                          | Widget headers file                                         |
| Q-010     | TypeBox 0.34, Zod 4 fallback via PoC-C                                                        | P1.3                                                        |
| Q-011     | Two-directive CSP promise, published after PoC-A                                              | Embedding guide                                             |
| Q-012     | Privacy review before any persistence or message telemetry                                    | P1.5, P1.7                                                  |
| **Q-013** | **Answered 2026-11-07: full tenant theme on the dashboard chrome** (D-20)                     | P1.6 SSR path, THEME-06 policy, P1.4/P1.6 accessibility     |
| **Q-014** | **Answered 2026-11-07: per-widgetKey `allowedOrigins` in Phase 1** (D-21)                     | ENDP-02a, BRIDGE-04, P1.5-T13, P1.6-T12, T-05               |
| **Q-015** | **Confirmed 2026-11-07:** proactive messaging is a requirement → frame created hidden at idle | PoC-A still measures both strategies                        |

## Product-owner decisions at P0 (2026-11-07)

### D-20 — Tenant theme styles the full dashboard chrome — **Fixed (Q-013 answered)**

Overturns the Q-013 default (brand layer only). The dashboard root layout emits the full resolved `--sem-*` map for the tenant, both appearances, through the same SSR path; the theme contract stays the one shared contract. Consequences:

- THEME-06 contrast policy gains the pairs the dashboard needs (non-text contrast for outlines, status colours and primary controls; text on `surfaceVariant`).
- P1.6-T04 emits the full map; P1.6-AC12 requires axe serious/critical = 0 on dashboard routes under all three tenants.
- Runbook P1.6 step 1 expects the whole chrome themed.
- Risk accepted: a tenant palette can make the agent inbox less comfortable to use; the contrast policy is the guard, and per-agent overrides are a later feature.

### D-21 — Per-widgetKey domain allowlist in Phase 1 — **Fixed (Q-014 answered)**

Overturns the Q-014 default (no allowlist). The config document gains a required `allowedOrigins` list (ENDP-02a). The frame refuses to bootstrap when the parent origin is not listed: no `ready`, no content, an `ORIGIN_NOT_ALLOWED` beacon only. The `frame-ancestors *` header stays, because one static frame document serves every widget key; enforcement is in the frame. In `mode=preview` the build-time dashboard origin is always allowed. Consequences:

- BRIDGE-04 gains rule 7 and the `ORIGIN_NOT_ALLOWED` error code; BRIDGE-08 gains a negative case.
- P1.5-T13 implements it with a `wrong-domain.html` playground fixture and the `wk_wrong_domain` tenant fixture; PoC-A does not build it.
- P1.6-T12 adds `/settings/widget` to edit the list.
- T-05 moves from documented residual to mitigated with an automated test.
- Remaining residual: the check relies on the browser-supplied `event.origin` and `location.ancestorOrigins`; a listed customer page that is itself compromised is out of scope.

### D-22 — GitHub push and CI deferred; local verification is the gate — **Fixed (product owner, 2026-11-07)**

The product owner deferred pushing to GitHub and running CI, to focus on local setup and verification. Until this decision is overturned:

- **`npm run verify`** (from P1.1: `pnpm verify`) is the gate. It runs locally, in order, the same steps as `.github/workflows/ci.yml` on `main`: policy checks, `nx format:check --all`, `nx run-many -t lint test typecheck build`, and Chromium e2e. `npm run verify -- --quick` skips e2e. Phases add their new gates to `tools/scripts/verify.mjs` at the same time as they add them to CI, so the two never drift.
- **Every `[auto]` criterion is satisfied by a passing `verify` run.** The evidence file records the command, the date, the commit and the summary table the script prints, in place of a CI link.
- **The Windows CI job (D-17) is replaced by running `verify` on the product owner's Windows 11 machine.** The Linux side is unverified until CI returns; evidence says so.
- **The workflow file is still maintained.** Each phase updates `ci.yml` so CI is ready to turn on, and `check-workflows-pinned` keeps checking it.
- **Deferred until CI returns:** branch protection and required checks (P1.0-AC06, P1.0-AC08, P1.0-T12), the CI cache-hit check, the PR template in use, Renovate, and the PR-body trailer checks that read `GITHUB_EVENT_PATH` (they skip locally with a notice). The independent verifier runs `verify` on a fresh clone instead.
- **CODEOWNERS:** the `@OWNER` placeholder is a warning locally and an error only when `CI` is set, because CODEOWNERS has no effect without GitHub.

To end the deferral: complete P1.0-T12, open the P1.0 pull request, and record the first green CI run in `SPECS/evidence/P1.0.md`.

## How to change a decision

Add a dated line under the decision ("Overturned on … by …: new text"), update `STATUS.md`, and list the affected spec sections in the same commit. Do not rewrite history.

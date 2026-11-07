# AGENTS.md

Canonical instructions for AI coding agents (Claude Code, Codex and others) and for humans onboarding to this repository. `CLAUDE.md` only imports this file.

## Purpose

Byteflock is a multi-tenant customer-support and live-chat SaaS. Phase 1 builds the frontend foundation only: a Next.js admin dashboard, an embeddable chat widget whose conversation runs in a cross-origin iframe, a shared design-token and tenant-theme contract, and the quality gates around them. There is no backend, database or production infrastructure in Phase 1.

## Specs and workflow

- The architecture is `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md` (the _why_). The implementable specs are in `SPECS/` (the _what_ and _how we know it is done_). Read `SPECS/README.md` first.
- **Before implementing a phase, check `SPECS/STATUS.md`. Work a phase only if the product owner has marked it `Approved`.** If it is not approved, stop and ask.
- `SPECS/DECISIONS.md` records where the architecture and this repository differ. It overrides the architecture document on those points.
- For a phase, read in this order: `SPECS/DECISIONS.md`, the phase spec in `SPECS/phases/`, every contract it links in `SPECS/contracts/`, then `SPECS/validation/local-stack.md`.
- Record what you did in `SPECS/evidence/<phase>.md` (template in `SPECS/templates/`). Agents never set a phase to `Approved` or `Accepted`.
- Architectural decisions become binding only as ADRs in `docs/adr/`.

## Project map

pnpm 11 workspace (`pnpm-workspace.yaml`), `@byteflock` scope. Projects are named by their package name. Tags follow `SPECS/contracts/boundary-rules.md` (BOUND-01).

| Project                          | Path                       | Tags                                      | Runs on                                                                   |
| -------------------------------- | -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `@byteflock/admin-dashboard`     | `apps/admin-dashboard`     | `type:app scope:dashboard platform:react` | Next.js 16, http://localhost:3000                                         |
| `@byteflock/admin-dashboard-e2e` | `apps/admin-dashboard-e2e` | `type:app scope:dashboard platform:react` | Playwright                                                                |
| `@byteflock/widget`              | `apps/widget`              | `type:app scope:widget platform:lit`      | Vite static origin, http://localhost:4400                                 |
| `@byteflock/widget-playground`   | `apps/widget-playground`   | `type:app scope:widget platform:lit`      | Vite host-page fixtures, http://localhost:4300; owns its Playwright tests |
| `@byteflock/design-tokens`       | `libs/design-tokens`       | `type:lib scope:shared platform:neutral`  |                                                                           |
| `@byteflock/theme`               | `libs/theme`               | `type:lib scope:shared platform:neutral`  |                                                                           |
| `@byteflock/ui-react`            | `libs/ui-react`            | `type:lib scope:shared platform:react`    |                                                                           |
| `@byteflock/chat-widget`         | `libs/chat-widget`         | `type:lib scope:widget platform:lit`      |                                                                           |

The libraries hold placeholders until their phases: tokens in P1.2, theme in P1.3, ui-react in PoC-B and P1.4, chat-widget in PoC-A and P1.5. The expected projects and dependency edges are committed in `tools/scripts/policy/expected-graph.json`, and `pnpm policy:check` fails if the graph drifts.

Targets are inferred by Nx plugins from config files; there are no `project.json` files. Run `pnpm nx show project <name>` to see what a project exposes. Libraries are consumed from source: their `package.json` `exports` point at `./src/index.ts`, linked by `workspace:*` dependencies plus TypeScript project references (`pnpm nx sync` keeps those aligned), and app builds depend on `^build` and `^typecheck` (D-07). Unit tests run on Vitest, except the dashboard, which keeps Jest through `next/jest`.

## Boundaries

Full rules: `SPECS/contracts/boundary-rules.md`. Enforced on every lint run.

- `platform:neutral` depends only on `platform:neutral`. `platform:lit` and `platform:react` depend on themselves or `platform:neutral`.
- `scope:shared` depends only on `scope:shared`. Libraries never import apps.
- Forbidden imports: `react`, `react-dom`, `next` in `platform:lit` projects; `lit`, `lit-html`, `@lit/*` in `platform:react` projects; `@radix-ui/*` everywhere unless ADR-006 selects Radix.
- Workspace constraints live in the root `eslint.config.mjs`. Restricted imports come from `tools/eslint/tag-restrictions.mjs`, which every project's `eslint.config.mjs` calls with its own directory. A new project must call it too.

## Non-negotiables

These apply from day one, even before lint enforces them.

1. **No network from the launcher.** The loader and launcher on the customer's page never call `fetch`, `XMLHttpRequest` or `sendBeacon`, never use `innerHTML`, and never touch storage. The frame does all network work from its own origin.
2. **No theme from the host page.** The frame takes its theme only from the platform origin. The single exception is `theme.preview` in preview mode from the dashboard origin.
3. **No React or Next.js in widget bundles.** The widget build fails on leakage from P1.5.

## Commands

```bash
pnpm install --frozen-lockfile                  # install; never npm or yarn
pnpm stack                                      # dashboard 3000, widget origin 4400, playground 4300
pnpm stack:check                                # are the three origins up, with the frame headers?
pnpm stack:reset                                # restore widget config and themes from validation/widget-fixtures
pnpm verify                                     # every CI gate locally; its summary goes in the evidence file (D-22)
pnpm verify --quick                             # the same without end-to-end tests
pnpm policy:check                               # pinned actions, ADRs, CODEOWNERS, supply chain, tags, project graph
pnpm nx run-many -t lint test typecheck build   # all projects
pnpm nx affected -t lint test typecheck build   # only what changed
pnpm nx sync                                    # fix TypeScript project references after adding a dependency
pnpm nx format:write                            # Prettier
```

Single tests:

```bash
pnpm nx test @byteflock/theme -- src/lib/theme.spec.ts                 # Vitest: a file path filters
pnpm nx test @byteflock/admin-dashboard -- --testPathPatterns=index     # Jest 30: the flag is plural
pnpm nx e2e @byteflock/widget-playground -- --project=chromium --grep @smoke
pnpm nx e2e @byteflock/admin-dashboard-e2e -- --project=chromium src/example.spec.ts
```

Playwright starts the server it needs, or reuses a running `pnpm stack`, so e2e works either way. Install browsers once with `pnpm exec playwright install --with-deps chromium`. Details of the local multi-tenant stack: `SPECS/validation/local-stack.md`.

Adding a dependency: `pnpm add <pkg> --filter <project>` (`-w` for the root). pnpm refuses packages younger than 7 days, and install scripts run only for packages set to `true` under `allowBuilds` in `pnpm-workspace.yaml`. Do not use `nx add`: it failed here with a pnpm store error. Use `pnpm add -D -w @nx/<plugin>@24.0.0`, then `pnpm nx g @nx/<plugin>:init`.

## Definition of done

From `SPECS/00-conventions.md`:

- All tasks done, or deferred in the evidence file with a reason and a target phase.
- `pnpm verify` green locally. While CI is deferred (D-22), its summary table goes in the evidence file in place of a CI link.
- The evidence file is complete: commands run and their results, one sentence per new dependency, every deviation.
- No TODO or FIXME without an issue reference.
- If the implementation showed the spec was wrong, the spec is corrected and the correction noted in the evidence.

## Pull requests

Use `.github/pull_request_template.md`. Every PR states the spec and task IDs, the exact commands run with a CI link, deviations from the spec, and one sentence per new dependency. "Tests pass" without a CI link is not accepted. Trailers are required when they apply:

- `CONTRACT-CHANGE:` when `libs/theme/schema/**` or `apps/widget/src/bridge/protocol.ts` changes, with a note under `docs/contract-changes/`.
- `TESTS-REMOVED:` when the number of tests goes down.
- `BUDGET-EXCEPTION:` when a widget bundle budget is raised.

## Changing decisions

- Do not edit `docs/architecture/ARCHITECTURE-001-*.md`. Propose changes in `SPECS/DECISIONS.md` and cite the section.
- An ADR with `Status: Accepted` is immutable except for its status line, a "Superseded by" link and its `<!-- verification -->` block. Supersede it with a new ADR instead. CI enforces this.
- Generated files are committed and never hand-edited: `apps/admin-dashboard/next-env.d.ts` and `apps/admin-dashboard/AGENTS.md` (written by `next dev`; restore `next-env.d.ts` before committing, since `next dev` and `next build` write different paths into it), and from later phases the design-token outputs, `libs/theme/schema/theme.v1.json` and `shadcn-bridge.css`.
- Next.js 16 has breaking changes against older App Router versions. Check `node_modules/next/dist/docs/` before relying on remembered APIs.

## Windows

The product owner develops on Windows 11, so Windows is a first-class environment.

- All scripts are Node; never assume bash, curl or GNU tools. Build paths with `path.join`.
- Line endings are LF everywhere (`.gitattributes`, Prettier `endOfLine: lf`). `.gitattributes` keeps a clone clean even with `core.autocrlf=true`; only if a clone still shows every file modified, run `git config core.autocrlf false` and check out again.
- Use one checkout per environment: native Windows or WSL2, not both on the same folder.
- Do not change the local ports in `SPECS/validation/local-stack.md`; the widget's preview mode is pinned to the dashboard origin.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# SPECS — Phase 1 Frontend Foundation

Implementable specifications derived from `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md` (ARCH-001 v0.3). Each spec is written so that an AI agent can **implement**, a second agent can **verify**, and a human can **validate** the result locally with several tenants, phase by phase.

ARCH-001 is the _why_. These specs are the _what, in what order, and how we know it is done_. Where the two disagree, `DECISIONS.md` wins and says why.

## How to read this folder

| Path                | What it is                                                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`         | This file: workflow, rules, phase map                                                                                                                                                              |
| `00-conventions.md` | Spec anatomy, ID scheme, verification levels, definition of done                                                                                                                                   |
| `DECISIONS.md`      | Reconciliation of ARCH-001 with the repository as found, plus adopted defaults for open questions. **Read before any phase.**                                                                      |
| `STATUS.md`         | Phase board: state, approval, evidence link. Updated at every phase transition.                                                                                                                    |
| `phases/`           | One spec per milestone, in execution order                                                                                                                                                         |
| `contracts/`        | Normative contracts shared by several phases (boundaries, theme, bridge, endpoints and headers, tenant config, token extraction and projection). Phases reference these; they do not restate them. |
| `validation/`       | Local stack, tenant fixtures, the manual validation runbook, and the threat-to-test map                                                                                                            |
| `templates/`        | Spec, ADR (MADR), evidence and PR templates                                                                                                                                                        |
| `evidence/`         | Filled-in evidence per phase (created when a phase is implemented)                                                                                                                                 |

## Phase map

```
P0 ─ P1.0 ─ P1.1 ─┬─ PoC-A (widget isolation) ─────────────┐
                  │                                         ├─ P1.5 ─┐
                  ├─ P1.2 (tokens) ─ P1.3 (theme + PoC-C) ──┤        ├─ P1.6 ─ P1.7 ─ P1 exit
                  │                                         │        │
                  └─ PoC-B (primitives) ─ P1.4 (ui-react) ──┴────────┘
```

| Spec                                                          | Title                                                  | Depends on                | Produces                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------- |
| [P0](phases/P0-approval.md)                                   | Baseline approval and open decisions                   | —                         | Approval record, ADR statuses                                                                       |
| [P1.0](phases/P1.0-governance-and-ci-skeleton.md)             | Governance files and CI skeleton                       | P0                        | AGENTS.md, templates, CODEOWNERS, CI with pinned actions                                            |
| [P1.1](phases/P1.1-workspace-foundation.md)                   | Workspace foundation                                   | P1.0                      | pnpm, 8 projects, tags, boundary lint, Linux + Windows CI                                           |
| [PoC-A](phases/POC-A-widget-isolation.md)                     | Widget isolation proof of concept                      | P1.1                      | Loader, launcher, frame shell, bridge, playground fixtures, measurements                            |
| [P1.2](phases/P1.2-design-tokens.md)                          | Design tokens                                          | P1.1                      | DTCG sources, Style Dictionary build, committed outputs                                             |
| [P1.3](phases/P1.3-theme-contract.md)                         | Theme contract (includes PoC-C)                        | P1.2                      | TypeBox schema, JSON Schema, resolver, migrations, fixtures                                         |
| [PoC-B](phases/POC-B-react-primitives.md)                     | React primitives proof of concept                      | P1.1                      | Base UI decision, first components                                                                  |
| [P1.4](phases/P1.4-ui-react-foundation.md)                    | React UI foundation                                    | P1.3, PoC-B               | ui-react components, Tailwind bridge, Storybook, Vitest, axe                                        |
| [P1.5](phases/P1.5-frame-app-foundation.md)                   | Frame app foundation                                   | PoC-A, P1.3               | chat-widget elements, controllers, consent gate, budgets                                            |
| [P1.6](phases/P1.6-themed-vertical-slice.md)                  | Themed vertical slice                                  | P1.3, P1.4, P1.5          | SSR brand layer, theme editor with preview, publish stub                                            |
| [P1.7](phases/P1.7-hardening-and-exit.md)                     | Hardening and Phase-1 exit                             | all                       | Gates promoted, budgets, nightly matrix, docs, exit checklist                                       |
| [P2.1](phases/P2.1-tenant-data-backend-and-platform-scope.md) | Tenant data backend and platform scope                 | P1.7, D-24, D-25          | Postgres in Docker, RLS, super admin with default chrome, tenant config                             |
| [P2.2](phases/P2.2-token-extraction-and-inventory.md)         | Design-token extraction and inventory (import layer A) | P2.1, real tenant exports | Lossless, traceable token inventory from files, folders and ZIPs; reports and a downloadable bundle |
| [P2.3](phases/P2.3-token-theme-projection.md)                 | Design-token projection to the theme (import layer B)  | P2.2                      | Light/dark choice, role mapping and approved lossy conversions into theme.v1                        |

## Workflow per phase

1. **Approval to start.** The product owner approves the phase in `STATUS.md` (state `Approved`). No implementation before that line exists. An agent asked to "implement P1.x" first checks `STATUS.md`; if the phase is not `Approved`, it stops and asks.
2. **Implement.** The implementing agent reads, in this order: `DECISIONS.md`, the phase spec, every contract the spec links, `validation/local-stack.md`. It works the task list (`T-nn`) in order unless the spec says tasks are independent. It does not widen scope; anything discovered goes in the evidence file under "Deviations and findings".
3. **Verify (agent).** The implementing agent runs section 8 of the spec and records the exact commands and results in `evidence/<phase>.md`. A _different_ agent (or the same agent in a fresh session) then runs section 8 again from a clean checkout and signs the "Independent verification" block. Both must pass.
4. **Validate (human).** The product owner follows section 9 of the spec and the matching chapter in `validation/manual-validation-runbook.md` on the local stack, with the tenants in `validation/tenant-fixtures.md`.
5. **Accept.** `STATUS.md` moves to `Accepted` with the evidence link and the ADR status changes the spec names. Only then is the next phase eligible for approval.

## Non-negotiable rules for agents working these specs

- A spec's acceptance criteria are the contract. "Tests pass" without the evidence file is not done.
- Every new dependency gets one sentence in the evidence file: the need and the alternative considered (ARCH-001 principle 8).
- No network from the launcher. No theme from the host page outside preview mode. React and Next never enter widget bundles. These are lint- and test-enforced from the phase that introduces them, but they apply from day one.
- Do not edit `docs/architecture/ARCHITECTURE-001-*.md`. Propose changes in `DECISIONS.md` and reference the section.
- Do not change an Accepted ADR's body. Supersede it.
- Generated files (`design-tokens` outputs, `theme/schema/theme.v1.json`, `shadcn-bridge.css`) are committed and checked for staleness in CI. Never hand-edit them.
- Windows is a first-class development environment (the product owner develops on Windows 11). Scripts are Node, never shell-specific. Paths use `path.join`. Line endings are LF via `.gitattributes`.

## Relationship to OpenSpec and ADRs

ARCH-001 names `openspec/` as the eventual spec home. For Phase 1, `SPECS/` is the spec home (DECISION D-09). ADRs live in `docs/adr/` from P1.0 and are the only place architectural decisions become binding; these specs tell the implementer which ADR to create or update and with what status.

# ADR-001: Nx + pnpm workspace and toolchain

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Accepted                                                              |
| Date     | 2026-11-07                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §6.4, §6.5; SPECS/DECISIONS.md D-01, D-02, D-05, D-07, D-08  |

## Context and problem statement

The frontend needs one repository for a Next.js dashboard, a static widget origin, a playground and four libraries, worked on by a small team and AI agents on Windows and Linux. The product owner chose to start from an existing Nx Next.js template rather than an empty workspace (D-01).

## Decision drivers

- Supply-chain controls on install
- Fast local and CI feedback without a paid remote cache
- Libraries consumed from source without a build step
- Windows as a first-class environment

## Considered options

1. Nx integrated monorepo on pnpm 11 with workspaces and TypeScript project references
2. Keep the template on npm workspaces
3. Turborepo on pnpm

## Decision outcome

**Chosen option:** Option 1, because pnpm 11 provides the release cooldown and build-script allowlist ADR-011 needs, and Nx already runs the template with inferred tasks.

- Nx 24.0.0 (all `@nx/*` plugins at the same version), Next.js 16.4.3, React 19, TypeScript 6.0.3, Node 24 LTS (`.node-version`, `engines`).
- pnpm 11 via the `packageManager` field and Corepack; migration from npm happens in P1.1 (D-02).
- Package-manager workspaces plus TypeScript project references; `nx sync:check` in CI.
- Libraries are consumed from source: `package.json` `exports` point at `./src/index.ts`; app builds depend on `^build` and `^typecheck` (D-07).
- Inferred tasks from Nx plugins; no `project.json` files.
- No Nx Cloud in Phase 1; CI caches `.nx/cache` with `actions/cache` (D-08). Remote cache is re-decided at P1.7.

### Consequences

- Good: One toolchain for every project
- Good: Cheap migration now (three template projects)
- Bad: A package-manager switch in P1.1 touches every command in the docs
- Neutral: The architecture table cited Nx 23.1; this repository is already on Nx 24.0.0 and stays there (D-05).

## Verification

<!-- verification -->

To be filled by P1.1-T11: exact versions, pnpm settings and the linking mechanism confirmed by a build.

<!-- /verification -->

## Links

- Evidence: `SPECS/evidence/`
- Architecture: `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md`

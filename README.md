# Byteflock

Multi-tenant customer-support and live-chat platform. This repository holds the frontend: the tenant admin dashboard (Next.js), the embeddable chat widget (a framework-free launcher plus a Lit conversation frame on its own origin), and the shared design-token and tenant-theme contract.

Phase 1 is the frontend foundation. Progress and approvals are tracked phase by phase in [`SPECS/STATUS.md`](SPECS/STATUS.md).

## Start here

| Read                                                                   | For                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                                                 | Instructions for agents and new developers: project map, rules, commands |
| [SPECS/README.md](SPECS/README.md)                                     | The phase specs (the project's specifications), workflow and local setup |
| [SPECS/STATUS.md](SPECS/STATUS.md)                                     | Phase status and approvals                                               |
| [docs/architecture/](docs/architecture/)                               | ARCHITECTURE-001, the frontend foundation baseline                       |
| [docs/adr/](docs/adr/README.md)                                        | Architecture decision records ADR-001 to ADR-011                         |
| [docs/developer-guide/](docs/developer-guide/README.md)                | Clone, install, run; local tenants; theme editor; Windows notes          |
| [docs/developer-guide/embedding.md](docs/developer-guide/embedding.md) | Embedding the chat widget on a customer site                             |
| [docs/developer-guide/release.md](docs/developer-guide/release.md)     | Releasing the widget                                                     |
| [docs/security/threat-model.md](docs/security/threat-model.md)         | Threats, mitigations and the tests that prove them                       |
| [localrunverify.md](localrunverify.md)                                 | Run the stack and verify it by hand, step by step                        |

## Local commands

Requires Node 24 (see `.node-version`) and pnpm, whose exact version comes from `packageManager` in `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm stack          # dashboard :3000, widget origin :4400, playground :4300
pnpm stack:check    # confirm all three are up
pnpm verify         # all CI gates locally
pnpm visual         # visual regression in the pinned Linux container (needs Docker)
```

Built with [Nx](https://nx.dev) and [Next.js](https://nextjs.org).

# Architecture decision records

MADR format (`SPECS/templates/adr-template.md`). An ADR with status Accepted may change only its status line, a "Superseded by" link and its verification block; CI enforces this with `tools/scripts/policy/check-adr-immutability.mjs`.

| ADR                                                               | Title                                                                        | Status   |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| [ADR-001](ADR-001-nx-pnpm-workspace-and-toolchain.md)             | Nx + pnpm workspace and toolchain                                            | Accepted |
| [ADR-002](ADR-002-application-and-library-boundaries.md)          | Application and library boundaries                                           | Accepted |
| [ADR-003](ADR-003-token-source-and-build.md)                      | Token source and build                                                       | Accepted |
| [ADR-004](ADR-004-theme-contract-grammar-lifecycle.md)            | Theme contract, grammar and lifecycle                                        | Accepted |
| [ADR-005](ADR-005-tenant-context-authorization-ssr-cache.md)      | Tenant context, authorization boundary and SSR cache rules                   | Accepted |
| [ADR-006](ADR-006-primitive-and-react-styling.md)                 | Primitive library and React styling                                          | Accepted |
| [ADR-007](ADR-007-widget-isolation-loader-bridge.md)              | Widget conversation isolation, loader and bridge                             | Accepted |
| [ADR-008](ADR-008-storybook-and-component-testing.md)             | Storybook and component testing                                              | Accepted |
| [ADR-009](ADR-009-quality-gates-browser-support-budgets-a11y.md)  | Quality gates, browser support, budgets and accessibility                    | Accepted |
| [ADR-010](ADR-010-ai-dlc-and-spec-governance.md)                  | AI-DLC and specification governance                                          | Accepted |
| [ADR-011](ADR-011-dependency-and-supply-chain-policy.md)          | Dependency and supply-chain policy                                           | Accepted |
| [ADR-012](ADR-012-local-data-backend.md)                          | Local data backend (Postgres in Docker, Next.js server as data layer)        | Proposed |
| [ADR-013](ADR-013-request-scope-platform-and-tenant.md)           | Request scope (platform and tenant), authorization helper and default chrome | Proposed |
| [ADR-014](ADR-014-design-systems-as-platform-generated-themes.md) | Independent design systems as platform-generated themes                      | Accepted |
| [ADR-015](ADR-015-theme-registry-separate-from-tenants.md)        | Theme registry separate from tenants                                         | Proposed |
| [ADR-016](ADR-016-one-platform-neutral-theme-generator.md)        | One platform-neutral theme generator                                         | Accepted |
| [ADR-017](ADR-017-one-shared-tailwind-mapping.md)                 | One shared Tailwind v4 mapping                                               | Proposed |

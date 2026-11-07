# Local validation fixtures

Machine-readable fixtures for the local multi-tenant stack (`SPECS/validation/`).

- `widget-fixtures/v1/` is the committed copy of the widget's config and theme documents. `pnpm stack:reset` copies it into `apps/widget/public/v1/`. PoC-A adds the first tenants; P1.3 regenerates them from the theme fixtures.
- `tenants.json` arrives in P1.3.

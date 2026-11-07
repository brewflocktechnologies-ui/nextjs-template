# Tenant fixtures (D-11)

One set of tenants used everywhere: theme fixtures (`libs/theme/fixtures/valid/`), widget static stubs (`apps/widget/public/v1/`), the dashboard's dev session list, playground pages, Storybook theme decorators and this runbook. The machine-readable source is `validation/tenants.json` (created in P1.3; this table is its documentation; a test asserts they agree).

## Valid tenants

|                         | `t_acme`                | `t_globex`              | `t_initech`                       |
| ----------------------- | ----------------------- | ----------------------- | --------------------------------- |
| Brand name              | Acme Corp               | Globex                  | Initech                           |
| Purpose                 | "light" reference       | "dark" reference        | "compact / high-radius" reference |
| `widgetKey`             | `wk_acme_demo`          | `wk_globex_demo`        | `wk_initech_demo`                 |
| `appearance.mode`       | `light`                 | `dark`                  | `light`                           |
| `typography.fontFamily` | `inter`                 | `roboto`                | `source-sans`                     |
| `typography.scale`      | `md`                    | `md`                    | `sm`                              |
| `shape.radius`          | `md`                    | `sm`                    | `full`                            |
| `elevation`             | `low`                   | `medium`                | `flat`                            |
| `density`               | `comfortable`           | `spacious`              | `compact`                         |
| `launcher.position`     | `bottom-right`          | `bottom-left`           | `bottom-right`                    |
| `launcher.shape`        | `circle`                | `pill`                  | `pill`                            |
| `launcher.icon`         | `chat`                  | `message`               | `help`                            |
| Primary (light / dark)  | `#1d4ed8` / `#93c5fd`   | `#0f766e` / `#5eead4`   | `#b45309` / `#fcd34d`             |
| Accent (light / dark)   | `#7c3aed` / `#c4b5fd`   | `#f59e0b` / `#fbbf24`   | `#0891b2` / `#67e8f9`             |
| Surface (light / dark)  | `#ffffff` / `#0b1220`   | `#f8fafc` / `#111827`   | `#fffbeb` / `#1c1917`             |
| Locale default          | `en-AU`                 | `en-US`                 | `en-AU`                           |
| Consent                 | `required`              | `notRequired`           | `required`                        |
| `allowedOrigins`        | `http://localhost:4300` | `http://localhost:4300` | `http://localhost:4300`           |
| Initial `revision`      | 1                       | 1                       | 1                                 |
| Dev user                | `u_acme_admin`          | `u_globex_admin`        | `u_initech_admin`                 |
| Roles                   | `tenant_admin`          | `tenant_admin`          | `tenant_admin`                    |

All remaining colour roles are filled in P1.3 so that every pair passes THEME-06 contrast policy in both sets; the P1.3 test suite proves it. The three must be visually distinct at a glance (different hue family, different radius, different density) so that a wrong-tenant render is obvious to a human.

## Failure fixtures

| `widgetKey`          | Config                                                                    | Theme                                       | Exercises                                                                                                 |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `wk_broken_version`  | valid, `tenantId: t_broken`, `themeRevision: 1`                           | `schemaVersion: 99`                         | `THEME_UNSUPPORTED_VERSION` → embedded defaults                                                           |
| `wk_broken_json`     | valid, points at revision `2`                                             | `/v1/themes/t_broken/2.json` is `{not json` | `THEME_INVALID` → embedded defaults                                                                       |
| `wk_broken_contrast` | valid                                                                     | valid schema, `onPrimary == primary`        | publish policy refusal in the dashboard (P1.6); frame still renders (policy is not enforced in the frame) |
| `wk_missing`         | no file → 404                                                             | —                                           | `CONFIG_INVALID` → embedded defaults                                                                      |
| `wk_wrong_domain`    | valid, `tenantId: t_acme`, `allowedOrigins: ["https://customer.example"]` | Acme's revision 1                           | `ORIGIN_NOT_ALLOWED`: the frame refuses on the playground origin (P1.5)                                   |
| `wk_slow`            | served with `?delay=3000` by the playground fixture                       | valid                                       | `CONFIG_TIMEOUT` → embedded defaults                                                                      |

`t_broken` has a dev user `u_broken_admin` so the dashboard can show the error states of its editor against a bad stored theme.

## Embedded defaults (what "fallback" looks like)

The frame and launcher ship a neutral default: `primary #334155`, `accent #334155`, `surface #ffffff`, `radius md`, `density comfortable`, `system` font, `bottom-right`, `circle`, `chat` icon, brand name "Chat". It is intentionally grey so that a fallback is recognisable during manual validation.

## Where each tenant appears

| Place                  | Files                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Theme fixtures         | `libs/theme/fixtures/valid/{acme-light,globex-dark,initech-compact}.json`                                               |
| Widget stubs           | `apps/widget/public/v1/config/wk_*.json`, `apps/widget/public/v1/themes/t_*/1.json`                                     |
| Dashboard dev sessions | `apps/admin-dashboard/src/dev/tenants.ts` (imports `validation/tenants.json`)                                           |
| Playground index       | generated from `validation/tenants.json` at dev-server start                                                            |
| Storybook decorators   | `libs/ui-react/.storybook/themes.ts`, `libs/chat-widget/.storybook/themes.ts` (both import from `@acme/theme` fixtures) |

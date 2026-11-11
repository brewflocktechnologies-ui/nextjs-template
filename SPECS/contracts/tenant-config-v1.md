# Contract: tenant config v1 (CONFIG)

Source: `SPECS/phases/P2.1-tenant-data-backend-and-platform-scope.md` §4.6, ADR-012, ADR-013. The tenant config is a small versioned document that customises the **dashboard** for one tenant. Only the dashboard reads it. The widget never does, and nothing in it reaches the customer's page. Stored in Postgres, table `tenant_configs` (one row per tenant). Guard and defaults: `apps/admin-dashboard/src/lib/tenant-config.ts`; data access: `apps/admin-dashboard/src/data/tenant-config.ts`.

## CONFIG-01 Shape

```jsonc
{
  "schemaVersion": 1,
  "modules": { "themeEditor": true, "widgetSettings": true },
  "defaults": { "locale": "en-AU" },
  "home": { "title": "Acme support", "notice": "Office closed Friday" },
}
```

| Field                    | Type    | Rule                                                                                                                            |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`          | integer | Exactly `1`                                                                                                                     |
| `modules.themeEditor`    | boolean | Required. `false` hides the Theme nav entry and makes the theme routes return 404 to tenant users                               |
| `modules.widgetSettings` | boolean | Required. `false` hides the Widget nav entry and makes the widget routes return 404 to tenant users                             |
| `defaults.locale`        | string  | Required. A locale tag (`^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$`). On write it must be one of the tenant's widget `locales_supported` |
| `home.title`             | string  | Required. Plain text, at most 60 characters. May be empty                                                                       |
| `home.notice`            | string  | Required. Plain text, at most 200 characters. May be empty                                                                      |

Every field is required: a stored document is complete, so a missing field means the document is invalid (CONFIG-03), not that a default applies.

## CONFIG-02 Limits and text

- **Unknown keys are rejected**, at every level.
- Strings are **plain text**. The dashboard renders them as text nodes and never as HTML, so markup such as `<b>` or `<script>` appears literally and does nothing. They are never used in a URL, an attribute that takes a URL, a style or a script.
- The limits above are in UTF-16 code units (JavaScript string length) and are checked by the guard on every write. The database stores only that the document is a JSON object; the guard is the validator.

## CONFIG-03 Fallback

Missing or invalid config falls back to the **defaults**, is logged (`console.warn`, with the tenant id and the problems) and never throws at render and never shows an error page.

Defaults for a tenant: both modules `true`; `defaults.locale` = the tenant's default widget locale (or `en` without a widget); `home.title` = `"<tenant name> support"` cut to 60 characters; `home.notice` = `""`. The seed writes these as the tenant's initial config.

## CONFIG-04 Versioning

`schemaVersion` is an integer, currently `1`. A reader that meets a version it does not know treats the document as invalid (CONFIG-03). Adding an optional field, or changing a limit, is not a new version only if every existing valid document stays valid; anything else is a new version (CONFIG-06).

## CONFIG-05 Who may write

| Actor                  | Read | Write | How                                                     |
| ---------------------- | ---- | ----- | ------------------------------------------------------- |
| Tenant `tenant_admin`  | own  | own   | `/settings/dashboard`, `POST /api/tenant-config`        |
| Tenant `agent`         | own  | no    | `authorize(ctx, tenantId, 'config.read')` only          |
| Platform `super_admin` | any  | any   | Platform pages (P2.1-T10); the action is `config.write` |

Every write goes through `authorize(ctx, tenantId, 'config.write')` and the guard, records `updated_by` and `updated_at`, and runs in the tenant's database scope (row-level security). A tenant never writes another tenant's row.

## CONFIG-06 Migration rule

Config changes are forward-only SQL or application migrations, like every other schema change (ADR-012). A new `schemaVersion` ships with (a) a migration that rewrites stored documents to the new version, (b) an updated guard that still rejects the old version, and (c) a note in this contract. No version is edited in place once documents of that version exist.

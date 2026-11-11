// Tenant config data access (P2.1-T07, section 4.6). Reads never throw for a bad stored document:
// a missing or invalid config falls back to the defaults and is logged (CONFIG fallback rule).
// Writes pass the guard first, and the default locale must be one the tenant supports.
import 'server-only';
import {
  defaultTenantConfig,
  guardTenantConfig,
  type TenantConfig,
} from '../lib/tenant-config';
import { withScope } from '../server/db';

export class TenantConfigError extends Error {
  constructor(
    message: string,
    readonly problems: string[] = [],
  ) {
    super(message);
    this.name = 'TenantConfigError';
  }
}

interface TenantFacts {
  name: string;
  locale_default: string | null;
  locales_supported: string[] | null;
}

const FACTS = `SELECT t.name, w.locale_default, w.locales_supported
                 FROM tenants t
                 LEFT JOIN widget_keys w ON w.tenant_id = t.tenant_id
                WHERE t.tenant_id = $1
                ORDER BY w.widget_key LIMIT 1`;

/** The locales the tenant supports (its widget key's), or an empty list without a widget. */
export async function listSupportedLocales(
  tenantId: string,
): Promise<string[]> {
  const facts = await withScope({ scope: 'tenant', tenantId }, (db) =>
    db.maybeOne<TenantFacts>(FACTS, [tenantId]),
  );
  return facts?.locales_supported ?? [];
}

/** The tenant's config, or the defaults when it has none or the stored one is invalid. */
export async function getTenantConfig(tenantId: string): Promise<TenantConfig> {
  const { stored, facts } = await withScope(
    { scope: 'tenant', tenantId },
    async (db) => ({
      stored: await db.maybeOne<{ doc: unknown }>(
        'SELECT doc FROM tenant_configs WHERE tenant_id = $1',
        [tenantId],
      ),
      facts: await db.maybeOne<TenantFacts>(FACTS, [tenantId]),
    }),
  );
  const defaults = defaultTenantConfig({
    name: facts?.name ?? 'Your',
    locale: facts?.locale_default ?? 'en',
  });
  if (!stored) return defaults;
  const result = guardTenantConfig(stored.doc);
  if (result.ok) return result.value;
  console.warn(
    `tenant config for ${tenantId} is invalid, using defaults: ${result.errors.join('; ')}`,
  );
  return defaults;
}

/** Saves a config after the guard; `defaults.locale` must be one of the tenant's locales. */
export async function saveTenantConfig(
  tenantId: string,
  input: unknown,
  userId: string,
): Promise<TenantConfig> {
  const result = guardTenantConfig(input);
  if (!result.ok)
    throw new TenantConfigError('Invalid tenant config', result.errors);
  const config = result.value;
  await withScope({ scope: 'tenant', tenantId }, async (db) => {
    const facts = await db.maybeOne<TenantFacts>(FACTS, [tenantId]);
    if (!facts) throw new TenantConfigError(`Unknown tenant ${tenantId}`);
    if (
      facts.locales_supported &&
      !facts.locales_supported.includes(config.defaults.locale)
    )
      throw new TenantConfigError('Invalid tenant config', [
        `defaults.locale must be one of ${facts.locales_supported.join(', ')}`,
      ]);
    await db.rows(
      `INSERT INTO tenant_configs (tenant_id, doc, schema_version, updated_by)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (tenant_id)
       DO UPDATE SET doc = EXCLUDED.doc, schema_version = 1, updated_at = now(),
                     updated_by = EXCLUDED.updated_by`,
      [tenantId, JSON.stringify(config), userId],
    );
  });
  return config;
}

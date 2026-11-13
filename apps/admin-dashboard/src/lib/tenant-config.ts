// Tenant config v1 (P2.1 section 4.6): a small versioned document for dashboard customisation, read
// only by the dashboard. The guard is hand-written (no schema library) and strict: unknown keys are
// rejected, strings are plain text (rendered as text, never HTML) with length limits. The contract
// text (CONFIG-01..06) is written in P2.1-T09.

export const TITLE_MAX = 60;
export const NOTICE_MAX = 200;

export interface TenantConfig {
  schemaVersion: 1;
  modules: { themeEditor: boolean; widgetSettings: boolean };
  defaults: { locale: string };
  home: { title: string; notice: string };
}

export type GuardResult =
  | { ok: true; value: TenantConfig }
  | { ok: false; errors: string[] };

const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function unknownKeys(
  path: string,
  value: Record<string, unknown>,
  allowed: string[],
  errors: string[],
) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) errors.push(`${path}.${key} is not allowed`);
}

/** Validates an untrusted document. Never throws. */
export function guardTenantConfig(input: unknown): GuardResult {
  const errors: string[] = [];
  if (!isRecord(input))
    return { ok: false, errors: ['config must be an object'] };
  unknownKeys(
    'config',
    input,
    ['schemaVersion', 'modules', 'defaults', 'home'],
    errors,
  );
  if (input.schemaVersion !== 1) errors.push('config.schemaVersion must be 1');

  const { modules, defaults, home } = input;
  if (!isRecord(modules)) errors.push('config.modules must be an object');
  else {
    unknownKeys('modules', modules, ['themeEditor', 'widgetSettings'], errors);
    for (const key of ['themeEditor', 'widgetSettings'])
      if (typeof modules[key] !== 'boolean')
        errors.push(`modules.${key} must be true or false`);
  }
  if (!isRecord(defaults)) errors.push('config.defaults must be an object');
  else {
    unknownKeys('defaults', defaults, ['locale'], errors);
    if (typeof defaults.locale !== 'string' || !LOCALE.test(defaults.locale))
      errors.push('defaults.locale must be a locale such as en-AU');
  }
  if (!isRecord(home)) errors.push('config.home must be an object');
  else {
    unknownKeys('home', home, ['title', 'notice'], errors);
    if (typeof home.title !== 'string' || home.title.length > TITLE_MAX)
      errors.push(`home.title must be text of at most ${TITLE_MAX} characters`);
    if (typeof home.notice !== 'string' || home.notice.length > NOTICE_MAX)
      errors.push(
        `home.notice must be text of at most ${NOTICE_MAX} characters`,
      );
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: input as unknown as TenantConfig };
}

/** The config used when a tenant has none, or its stored one is invalid. */
export function defaultTenantConfig(tenant: {
  name: string;
  locale: string;
}): TenantConfig {
  return {
    schemaVersion: 1,
    modules: { themeEditor: true, widgetSettings: true },
    defaults: { locale: tenant.locale },
    home: { title: `${tenant.name} support`.slice(0, TITLE_MAX), notice: '' },
  };
}

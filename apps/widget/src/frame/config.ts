// Guard for /v1/config/{widgetKey}.json (ENDP-02). Hand-written: no schema library in the frame.

export interface WidgetConfig {
  schemaVersion: 1;
  tenantId: string;
  themeRevision: number;
  locale: { default: string; supported: string[] };
  features: { proactive: boolean; consent: 'required' | 'notRequired' };
  launcher: { position: 'bottom-right' | 'bottom-left' };
  /** Exact parent origins this widget key may run on (ENDP-02a, D-21). */
  allowedOrigins: string[];
}

const TENANT = /^t_[a-z0-9_]{2,40}$/;
const ORIGIN = /^https?:\/\/[a-z0-9.-]+(:[0-9]{1,5})?$/;
const LOCALE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Unknown keys are ignored; missing or malformed required keys make the config invalid. */
export function checkConfig(doc: unknown): WidgetConfig | null {
  if (!isObj(doc) || doc.schemaVersion !== 1) return null;
  const {
    tenantId,
    themeRevision,
    locale,
    features,
    launcher,
    allowedOrigins,
  } = doc;
  if (typeof tenantId !== 'string' || !TENANT.test(tenantId)) return null;
  if (!Number.isInteger(themeRevision) || (themeRevision as number) < 1)
    return null;
  if (
    !isObj(locale) ||
    typeof locale.default !== 'string' ||
    !LOCALE.test(locale.default)
  )
    return null;
  if (
    !Array.isArray(locale.supported) ||
    !locale.supported.every((l) => typeof l === 'string' && LOCALE.test(l))
  )
    return null;
  if (!isObj(features) || typeof features.proactive !== 'boolean') return null;
  if (features.consent !== 'required' && features.consent !== 'notRequired')
    return null;
  if (
    !isObj(launcher) ||
    (launcher.position !== 'bottom-right' &&
      launcher.position !== 'bottom-left')
  )
    return null;
  if (
    !Array.isArray(allowedOrigins) ||
    allowedOrigins.length < 1 ||
    allowedOrigins.length > 20 ||
    !allowedOrigins.every((o) => typeof o === 'string' && ORIGIN.test(o))
  )
    return null;
  return doc as unknown as WidgetConfig;
}

/**
 * ENDP-02a / BRIDGE-04 rule 7: may the frame run for this parent origin? In preview mode the
 * build-time dashboard origin is always allowed.
 */
export function isOriginAllowed(
  config: Pick<WidgetConfig, 'allowedOrigins'>,
  origin: string,
  preview: { mode: string; dashboardOrigin: string },
): boolean {
  if (preview.mode === 'preview' && origin === preview.dashboardOrigin)
    return true;
  return config.allowedOrigins.includes(origin);
}

export const isWidgetKey = (key: string) => /^wk_[a-z0-9_]{3,40}$/.test(key);

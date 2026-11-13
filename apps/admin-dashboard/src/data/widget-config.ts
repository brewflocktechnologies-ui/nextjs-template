// Widget settings data access (P1.6-T12, D-21; on Postgres since P2.1-T07). Allowed origins live in
// `widget_keys`; the widget reads them from its static config, which is rewritten after commit.
// The frame enforces allowedOrigins (ENDP-02a).
import 'server-only';
import { originProblems } from '../lib/origins';
import { withScope } from '../server/db';
import { materialiseTenant } from '../server/store/materialise';

export interface WidgetSettings {
  widgetKey: string;
  allowedOrigins: string[];
}

export class WidgetConfigError extends Error {
  constructor(
    message: string,
    readonly problems: string[] = [],
  ) {
    super(message);
    this.name = 'WidgetConfigError';
  }
}

const SELECT_KEY = `SELECT widget_key, allowed_origins FROM widget_keys
                    WHERE tenant_id = $1 ORDER BY widget_key LIMIT 1`;

interface KeyRow {
  widget_key: string;
  allowed_origins: string[];
}

export async function getWidgetSettings(
  tenantId: string,
): Promise<WidgetSettings | null> {
  const row = await withScope({ scope: 'tenant', tenantId }, (db) =>
    db.maybeOne<KeyRow>(SELECT_KEY, [tenantId]),
  );
  return row
    ? { widgetKey: row.widget_key, allowedOrigins: row.allowed_origins }
    : null;
}

export async function saveAllowedOrigins(
  tenantId: string,
  origins: string[],
): Promise<WidgetSettings> {
  const problems = originProblems(origins);
  if (problems.length)
    throw new WidgetConfigError('Invalid allowed origins', problems);
  const key = await withScope({ scope: 'tenant', tenantId }, async (db) => {
    const row = await db.maybeOne<KeyRow>(SELECT_KEY, [tenantId]);
    if (!row) throw new WidgetConfigError(`No widget for ${tenantId}`);
    await db.rows(
      'UPDATE widget_keys SET allowed_origins = $2 WHERE widget_key = $1',
      [row.widget_key, origins],
    );
    return row.widget_key;
  });
  try {
    await materialiseTenant(tenantId);
  } catch (error) {
    // The settings are saved; `pnpm db:materialise` rewrites the widget's config file.
    console.error(
      `materialise ${tenantId} failed after commit; run pnpm db:materialise:`,
      (error as Error).message,
    );
  }
  return { widgetKey: key, allowedOrigins: origins };
}

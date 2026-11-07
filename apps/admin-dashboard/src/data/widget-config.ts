// Widget settings data access (P1.6-T12, D-21). Writes the widget config document through the
// development publish stub; the frame enforces allowedOrigins (ENDP-02a).
import fs from 'node:fs';
import path from 'node:path';
import { originProblems } from '../lib/origins';
import { publishDir, readJson, writeAtomic } from '../server/store/fs-store';
import { localTenant } from '../server/tenants';

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

function configPath(tenantId: string): { key: string; file: string } {
  const key = localTenant(tenantId)?.widgetKey;
  if (!key) throw new WidgetConfigError(`No widget for ${tenantId}`);
  const file = path.join(publishDir(), 'config', `${key}.json`);
  if (!fs.existsSync(file))
    throw new WidgetConfigError(`No widget config for ${key}`);
  return { key, file };
}

export async function getWidgetSettings(
  tenantId: string,
): Promise<WidgetSettings | null> {
  if (!localTenant(tenantId)?.widgetKey) return null;
  const { key, file } = configPath(tenantId);
  const config = readJson(file) as { allowedOrigins?: string[] };
  return { widgetKey: key, allowedOrigins: config.allowedOrigins ?? [] };
}

export async function saveAllowedOrigins(
  tenantId: string,
  origins: string[],
): Promise<WidgetSettings> {
  const problems = originProblems(origins);
  if (problems.length)
    throw new WidgetConfigError('Invalid allowed origins', problems);
  const { key, file } = configPath(tenantId);
  const config = readJson(file) as Record<string, unknown>;
  writeAtomic(file, { ...config, allowedOrigins: origins });
  return { widgetKey: key, allowedOrigins: origins };
}

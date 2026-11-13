// Module gating (P2.1-T09, CONFIG-01): a tenant config can switch dashboard modules off. A disabled
// module hides its nav entry and its routes return 404 for tenant users. Platform scope is never
// gated (a super admin always sees every module).
import 'server-only';
import { notFound } from 'next/navigation';
import { getTenantConfig } from '../../data/tenant-config';
import type { Action } from '../authorize';
import type { RequestContext } from '../session/types';
import type { TenantConfig } from '../../lib/tenant-config';

export type ModuleName = keyof TenantConfig['modules'];

/** The module an action belongs to, or null when no module gates it. */
export function moduleOfAction(action: Action): ModuleName | null {
  if (action.startsWith('theme.')) return 'themeEditor';
  if (action.startsWith('widget.')) return 'widgetSettings';
  return null;
}

/** True when the module is on for this context. Platform scope: always. */
export async function isModuleEnabled(
  ctx: RequestContext,
  module: ModuleName,
): Promise<boolean> {
  if (ctx.scope === 'platform') return true;
  return (await getTenantConfig(ctx.tenantId)).modules[module];
}

/** For pages: 404 when the module is disabled for a tenant user. */
export async function requireModule(
  ctx: RequestContext,
  module: ModuleName,
): Promise<void> {
  if (!(await isModuleEnabled(ctx, module))) notFound();
}

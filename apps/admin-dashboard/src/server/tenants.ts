// The local tenants (D-11), read from validation/tenants.json. Development data: in production the
// backend owns tenants and widget keys.
import path from 'node:path';
import { readJson, workspaceRoot } from './store/fs-store';

export interface LocalTenant {
  tenantId: string;
  name: string;
  widgetKey: string | null;
  user: string;
  roles: string[];
  locale: string;
}

interface TenantsFile {
  tenants: (LocalTenant & { widgetKey: string })[];
  brokenUser: { user: string; tenantId: string };
}

export function listLocalTenants(): LocalTenant[] {
  const file = readJson(
    path.join(workspaceRoot(), 'validation', 'tenants.json'),
  ) as TenantsFile;
  return [
    ...file.tenants.map(
      ({ tenantId, name, widgetKey, user, roles, locale }) => ({
        tenantId,
        name,
        widgetKey,
        user,
        roles,
        locale,
      }),
    ),
    {
      tenantId: file.brokenUser.tenantId,
      name: 'Broken tenant (failure fixtures)',
      widgetKey: null,
      user: file.brokenUser.user,
      roles: ['tenant_admin'],
      locale: 'en',
    },
  ];
}

export function localTenant(tenantId: string): LocalTenant | undefined {
  return listLocalTenants().find((t) => t.tenantId === tenantId);
}

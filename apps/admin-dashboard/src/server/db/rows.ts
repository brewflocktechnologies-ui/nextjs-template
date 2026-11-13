// Typed row mappers (P2.1-T05): database rows (snake_case, Date objects) become plain objects
// (camelCase, ISO strings). One mapper per table, so no other file reads a raw row. JSON columns
// stay loosely typed here; the data layer validates them with the theme and tenant-config guards.
import 'server-only';
import type { TenantRole } from '../session/types';

export type { TenantRole };

type Json = Record<string, unknown>;
const iso = (d: Date | string): string =>
  d instanceof Date ? d.toISOString() : d;

export interface UserRow {
  user_id: string;
  display_name: string;
  locale: string;
  platform_role: 'super_admin' | null;
  created_at: Date | string;
}
export interface User {
  userId: string;
  displayName: string;
  locale: string;
  platformRole: 'super_admin' | null;
  createdAt: string;
}
export const mapUser = (r: UserRow): User => ({
  userId: r.user_id,
  displayName: r.display_name,
  locale: r.locale,
  platformRole: r.platform_role,
  createdAt: iso(r.created_at),
});

export interface TenantRow {
  tenant_id: string;
  name: string;
  published_revision: number | null;
  created_at: Date | string;
}
export interface Tenant {
  tenantId: string;
  name: string;
  publishedRevision: number | null;
  createdAt: string;
}
export const mapTenant = (r: TenantRow): Tenant => ({
  tenantId: r.tenant_id,
  name: r.name,
  publishedRevision: r.published_revision,
  createdAt: iso(r.created_at),
});

export interface MembershipRow {
  user_id: string;
  tenant_id: string;
  role: TenantRole;
}
export interface Membership {
  userId: string;
  tenantId: string;
  role: TenantRole;
}
export const mapMembership = (r: MembershipRow): Membership => ({
  userId: r.user_id,
  tenantId: r.tenant_id,
  role: r.role,
});

export interface WidgetKeyRow {
  widget_key: string;
  tenant_id: string;
  allowed_origins: string[];
  locale_default: string;
  locales_supported: string[];
  features: Json;
}
export interface WidgetKey {
  widgetKey: string;
  tenantId: string;
  allowedOrigins: string[];
  localeDefault: string;
  localesSupported: string[];
  features: Json;
}
export const mapWidgetKey = (r: WidgetKeyRow): WidgetKey => ({
  widgetKey: r.widget_key,
  tenantId: r.tenant_id,
  allowedOrigins: r.allowed_origins,
  localeDefault: r.locale_default,
  localesSupported: r.locales_supported,
  features: r.features,
});

export interface ThemeDraftRow {
  tenant_id: string;
  doc: Json;
  updated_at: Date | string;
  updated_by: string;
}
export interface ThemeDraft {
  tenantId: string;
  doc: Json;
  updatedAt: string;
  updatedBy: string;
}
export const mapThemeDraft = (r: ThemeDraftRow): ThemeDraft => ({
  tenantId: r.tenant_id,
  doc: r.doc,
  updatedAt: iso(r.updated_at),
  updatedBy: r.updated_by,
});

export interface ThemeRevisionRow {
  tenant_id: string;
  revision: number;
  doc: Json;
  schema_version: number;
  published_at: Date | string;
  published_by: string;
}
export interface ThemeRevision {
  tenantId: string;
  revision: number;
  doc: Json;
  schemaVersion: number;
  publishedAt: string;
  publishedBy: string;
}
export const mapThemeRevision = (r: ThemeRevisionRow): ThemeRevision => ({
  tenantId: r.tenant_id,
  revision: r.revision,
  doc: r.doc,
  schemaVersion: r.schema_version,
  publishedAt: iso(r.published_at),
  publishedBy: r.published_by,
});

export interface TenantConfigRow {
  tenant_id: string;
  doc: Json;
  schema_version: number;
  updated_at: Date | string;
  updated_by: string;
}
export interface TenantConfigRecord {
  tenantId: string;
  doc: Json;
  schemaVersion: number;
  updatedAt: string;
  updatedBy: string;
}
export const mapTenantConfig = (r: TenantConfigRow): TenantConfigRecord => ({
  tenantId: r.tenant_id,
  doc: r.doc,
  schemaVersion: r.schema_version,
  updatedAt: iso(r.updated_at),
  updatedBy: r.updated_by,
});

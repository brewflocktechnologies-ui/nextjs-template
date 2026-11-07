// Query keys (P1.6-T06): every key starts with the tenant, so cached data can never cross tenants.
// Lint rule `qk-only` forbids raw `queryKey: [...]` arrays anywhere else.
export function qk<const P extends readonly (string | number)[]>(
  tenantId: string,
  ...parts: P
): readonly [string, ...P] {
  return [tenantId, ...parts] as const;
}

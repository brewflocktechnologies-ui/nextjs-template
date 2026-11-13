// Canonical JSON for the widget's static documents (P2.1-T08). Postgres `jsonb` does not keep key
// order, so every writer (the fixture generator, `pnpm db:materialise` and the dashboard's own
// materialiser in apps/admin-dashboard/src/server/store/fs-store.ts) sorts object keys the same way
// and ends the file with a newline. Same input, same bytes.

/** The same value with object keys sorted, recursively. Arrays keep their order. */
export function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

export const canonicalText = (doc) =>
  JSON.stringify(sortKeys(doc), null, 2) + '\n';

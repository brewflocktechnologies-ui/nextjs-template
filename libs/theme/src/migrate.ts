// Migrations (THEME-07): upgrades stored themes from schema version N-1 to N. Only v1 exists, so this
// validates and returns; the function, its tests and fixtures/migrated/ exist so v2 has a place to land.
import { SUPPORTED_SCHEMA_VERSIONS } from './guard';
import { SCHEMA_VERSION, type Theme } from './schema/theme.v1';
import { validateTheme, type ValidationError } from './validate';

export class ThemeMigrationError extends Error {
  constructor(
    readonly code: 'UNSUPPORTED_VERSION' | 'INVALID',
    readonly errors: ValidationError[] = [],
  ) {
    super(
      code === 'UNSUPPORTED_VERSION'
        ? 'Unsupported theme schema version'
        : 'Theme failed validation after migration',
    );
  }
}

/** One step per older version: MIGRATIONS[n] upgrades a version-n document to n + 1. */
const MIGRATIONS: Record<
  number,
  (doc: Record<string, unknown>) => Record<string, unknown>
> = {};

export function migrate(doc: unknown): Theme {
  let current = doc as Record<string, unknown>;
  let version =
    typeof current?.schemaVersion === 'number' ? current.schemaVersion : NaN;
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(version))
    throw new ThemeMigrationError('UNSUPPORTED_VERSION');
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new ThemeMigrationError('UNSUPPORTED_VERSION');
    current = step(current);
    version += 1;
  }
  const result = validateTheme(current);
  if (!result.ok) throw new ThemeMigrationError('INVALID', result.errors);
  return result.value;
}

/** Every supported version except the current one must have a migration step (checked by tests). */
export const missingMigrations = (): number[] =>
  SUPPORTED_SCHEMA_VERSIONS.filter((v) => v < SCHEMA_VERSION && !MIGRATIONS[v]);

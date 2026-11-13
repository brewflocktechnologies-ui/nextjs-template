// @byteflock/theme: tenant theme contract v1 (ADR-004). The widget frame imports
// @byteflock/theme/guard and @byteflock/theme/resolve instead, which do not include TypeBox.
export * from './schema/theme.v1';
export * from './resolved-keys';
export * from './resolve';
export * from './guard';
export * from './policy';
export * from './validate';
export * from './migrate';
export * from './import-dtcg';

/** Library identity (kept for the project-graph placeholders). */
export const LIB_NAME = 'theme';

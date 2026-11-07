// Frame-safe entry (no schema library): the shape guard and the resolved-key allowlist.
export { isSupportedTheme, SUPPORTED_SCHEMA_VERSIONS } from './guard';
export {
  RESOLVED_KEYS,
  isResolvedKey,
  type ResolvedKey,
  type ResolvedVars,
} from './resolved-keys';
export type { Theme } from './schema/theme.v1';

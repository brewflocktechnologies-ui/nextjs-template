// Frame-safe entry (no schema library): the resolver.
export { resolveTheme, appearanceOf, type Appearance } from './resolve';
export {
  RESOLVED_KEYS,
  isResolvedKey,
  type ResolvedKey,
  type ResolvedVars,
} from './resolved-keys';
export type { Theme } from './schema/theme.v1';

// Full schema validation (THEME-05): dashboard editor, publish step and SSR. Uses TypeBox's Value
// API, which interprets the schema without generating code, so it also works under a CSP that
// forbids eval (the dashboard). Not for the widget frame: it uses the guard.
import { Value } from '@sinclair/typebox/value';
import { ThemeV1, type Theme } from './schema/theme.v1';
import { resolveTheme, type Appearance } from './resolve';
import type { ResolvedVars } from './resolved-keys';

export interface ValidationError {
  /** JSON pointer to the offending value, for example /color/light/primary. */
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: Theme }
  | { ok: false; errors: ValidationError[] };

const MAX_ERRORS = 20;

export function validateTheme(doc: unknown): ValidationResult {
  if (Value.Check(ThemeV1, doc)) return { ok: true, value: doc };
  const errors: ValidationError[] = [];
  for (const e of Value.Errors(ThemeV1, doc)) {
    errors.push({ path: e.path || '/', message: e.message });
    if (errors.length >= MAX_ERRORS) break;
  }
  return { ok: false, errors };
}

/**
 * Validates, then resolves. Untrusted input never reaches the resolver (P1.3-AC03, T-03).
 * `resolver` is injectable so tests can prove it is not called for rejected documents.
 */
export function validateAndResolve(
  doc: unknown,
  options: { appearance: Appearance },
  resolver: typeof resolveTheme = resolveTheme,
): { ok: true; vars: ResolvedVars } | { ok: false; errors: ValidationError[] } {
  const result = validateTheme(doc);
  if (!result.ok) return result;
  return { ok: true, vars: resolver(result.value, options) };
}

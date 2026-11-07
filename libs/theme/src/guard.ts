// Shape guard for the widget frame (THEME-04). The frame fetches platform-published, already
// validated documents from its own origin, so a full JSON Schema validator is unnecessary there.
// This guard checks the schema version, every colour, and every enum the resolver reads; it is hand
// written so no schema library ships to the frame. A test runs it against every fixture.
import type { Theme } from './schema/theme.v1';

/** Versions the frame accepts: the current one and, once it exists, the previous one (THEME-10). */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [1];

const COLOR = /^#[0-9a-f]{6}$/;
const ROLES = [
  'primary',
  'onPrimary',
  'surface',
  'onSurface',
  'surfaceVariant',
  'onSurfaceVariant',
  'outline',
  'accent',
  'onAccent',
  'success',
  'warning',
  'danger',
  'focusRing',
];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;
/** Keys used for prototype pollution; never accepted at any depth. */
const POLLUTING = new Set(['__proto__', 'constructor', 'prototype']);
const polluted = (v: unknown): boolean =>
  typeof v === 'object' &&
  v !== null &&
  Object.keys(v).some((k) => POLLUTING.has(k) || polluted((v as Obj)[k]));
const one = (v: unknown, values: string[]) =>
  typeof v === 'string' && values.includes(v);
const colors = (v: unknown) =>
  isObj(v) &&
  ROLES.every((r) => typeof v[r] === 'string' && COLOR.test(v[r] as string));

export function isSupportedTheme(doc: unknown): doc is Theme {
  if (
    !isObj(doc) ||
    !SUPPORTED_SCHEMA_VERSIONS.includes(doc.schemaVersion as number)
  )
    return false;
  if (polluted(doc)) return false;
  const {
    appearance: a,
    color: c,
    typography: t,
    shape: s,
    brand: b,
    launcher: l,
  } = doc as Record<string, Obj>;
  return (
    isObj(a) &&
    one(a.mode, ['light', 'dark', 'system']) &&
    isObj(c) &&
    colors(c.light) &&
    colors(c.dark) &&
    isObj(t) &&
    one(t.fontFamily, [
      'system',
      'inter',
      'roboto',
      'source-sans',
      'noto-sans',
    ]) &&
    one(t.scale, ['sm', 'md', 'lg']) &&
    isObj(s) &&
    one(s.radius, ['none', 'sm', 'md', 'lg', 'full']) &&
    one(doc.elevation, ['flat', 'low', 'medium']) &&
    one(doc.density, ['compact', 'comfortable', 'spacious']) &&
    isObj(b) &&
    typeof b.name === 'string' &&
    b.name.length > 0 &&
    b.name.length <= 60 &&
    // eslint-disable-next-line no-control-regex -- deliberately detects control characters (THEME-01 rule 6)
    !/[\u0000-\u001f\u007f]/.test(b.name) &&
    isObj(l) &&
    one(l.position, ['bottom-right', 'bottom-left']) &&
    one(l.shape, ['circle', 'pill']) &&
    one(l.icon, ['chat', 'help', 'message'])
  );
}

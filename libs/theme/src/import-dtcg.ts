// DTCG importer: a tenant's design-token file → a candidate theme.v1 document, then validated.
//
// The file mirrors theme.v1 with every leaf wrapped as a DTCG token:
//   color.light.<role> / color.dark.<role>   colour tokens (role names in camelCase or kebab-case)
//   appearance.mode, typography.fontFamily, typography.scale, shape.radius, elevation, density,
//   brand.name, launcher.position / shape / icon   string tokens naming a contract preset
// Colours may be hex strings (#rgb, #rrggbb, #rrggbbaa) or DTCG 2025.10 colour objects. Aliases
// ("{color.light.primary}") and group-level `$type` are supported. Anything else in the file is
// ignored with a warning. Anything the file does not set comes from `options.base` when given (the
// theme being edited, so a file with only `primary` changes only that), otherwise from the platform
// defaults and DEFAULT_PRESETS. The result always goes through validateTheme, so only a document
// that passes the contract is returned (the same gate as every other source of a theme).
import {
  SEMANTIC_DEFAULTS_DARK,
  SEMANTIC_DEFAULTS_LIGHT,
} from '@byteflock/design-tokens';
import { colorVar } from './resolved-keys';
import { COLOR_ROLES, type ColorRole } from './schema/constants';
import type { Theme } from './schema/theme.v1';
import { validateTheme, type ValidationError } from './validate';

export interface ImportOptions {
  /** Supplies every value the file does not set, including revision and brand (editor use). */
  base?: Theme;
  /** Theme revision to stamp when there is no base. Defaults to 1; publish sets the real one. */
  revision?: number;
  /** Used when the file has no brand.name token and there is no base. */
  brandName?: string;
}

export type ImportResult =
  | { ok: true; theme: Theme; warnings: string[]; colorsImported: number }
  | { ok: false; errors: ValidationError[]; warnings: string[] };

/** Contract presets used when the file does not set them. */
export const DEFAULT_PRESETS = {
  appearance: 'system',
  fontFamily: 'system',
  scale: 'md',
  radius: 'md',
  elevation: 'low',
  density: 'comfortable',
  launcher: { position: 'bottom-right', shape: 'circle', icon: 'chat' },
} as const;

interface Token {
  value: unknown;
  type: string | undefined;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const MAX_ALIAS_DEPTH = 16;
const MAX_TOKENS = 5000;

/** Flattens the DTCG tree to dotted-path tokens, applying group-level `$type`. */
function flatten(
  node: Record<string, unknown>,
  prefix: string,
  inheritedType: string | undefined,
  out: Map<string, Token>,
): void {
  const type =
    typeof node['$type'] === 'string' ? node['$type'] : inheritedType;
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$') || !isObject(child)) continue;
    if (out.size >= MAX_TOKENS) return;
    const path = prefix ? `${prefix}.${key}` : key;
    if ('$value' in child) {
      const own = typeof child['$type'] === 'string' ? child['$type'] : type;
      out.set(path, { value: child['$value'], type: own });
    } else {
      flatten(child, path, type, out);
    }
  }
}

const ALIAS = /^\{([^{}]+)\}$/;

/** Follows aliases to a value. Every token passed through is added to `visited`. */
function resolveAlias(
  tokens: Map<string, Token>,
  token: Token,
  visited: Set<string>,
): { token: Token } | { error: string } {
  let current = token;
  const seen = new Set<string>();
  for (let i = 0; i < MAX_ALIAS_DEPTH; i++) {
    const match =
      typeof current.value === 'string' ? ALIAS.exec(current.value) : null;
    if (!match) return { token: current };
    const target = match[1];
    if (seen.has(target)) return { error: `alias cycle at {${target}}` };
    seen.add(target);
    visited.add(target);
    const next = tokens.get(target);
    if (!next) return { error: `alias {${target}} does not exist` };
    // An alias with no own type takes the type of what it points to.
    current = { value: next.value, type: current.type ?? next.type };
  }
  return { error: 'alias chain too deep' };
}

const hex2 = (n: number) =>
  Math.round(Math.min(1, Math.max(0, n)) * 255)
    .toString(16)
    .padStart(2, '0');

/** DTCG colour value → lower-case #rrggbb. Alpha is dropped (the contract has no alpha). */
export function toHexColor(
  value: unknown,
): { hex: string; droppedAlpha: boolean } | { error: string } {
  if (typeof value === 'string') {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
    if (!m) return { error: `"${value}" is not a hex colour` };
    let h = m[1].toLowerCase();
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    const droppedAlpha = h.length === 8 && h.slice(6) !== 'ff';
    return { hex: `#${h.slice(0, 6)}`, droppedAlpha };
  }
  if (isObject(value)) {
    const alpha = typeof value['alpha'] === 'number' ? value['alpha'] : 1;
    if (typeof value['hex'] === 'string') {
      const r = toHexColor(value['hex']);
      return 'error' in r ? r : { ...r, droppedAlpha: alpha < 1 };
    }
    const c = value['components'];
    if (
      value['colorSpace'] === 'srgb' &&
      Array.isArray(c) &&
      c.length === 3 &&
      c.every((n) => typeof n === 'number' && Number.isFinite(n))
    ) {
      return {
        hex: `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`,
        droppedAlpha: alpha < 1,
      };
    }
    return {
      error: `colour space "${String(value['colorSpace'])}" needs a "hex" fallback`,
    };
  }
  return { error: 'colour must be a hex string or a DTCG colour object' };
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Imports a DTCG document into a validated theme.v1 document. */
export function importDtcg(
  doc: unknown,
  options: ImportOptions = {},
): ImportResult {
  const warnings: string[] = [];
  const errors: ValidationError[] = [];
  if (!isObject(doc)) {
    return {
      ok: false,
      warnings,
      errors: [{ path: '/', message: 'Expected a DTCG token object' }],
    };
  }

  const tokens = new Map<string, Token>();
  flatten(doc, '', undefined, tokens);
  const used = new Set<string>();

  /** The resolved token at `path`, or undefined (recording an error if its alias is broken). */
  const read = (path: string, alt?: string): Token | undefined => {
    for (const p of alt ? [path, alt] : [path]) {
      const t = tokens.get(p);
      if (!t) continue;
      used.add(p);
      // Tokens reached through an alias count as used, so they are not reported as ignored.
      const r = resolveAlias(tokens, t, used);
      if ('error' in r) {
        errors.push({ path: `/${p.replaceAll('.', '/')}`, message: r.error });
        return undefined;
      }
      return r.token;
    }
    return undefined;
  };

  const readColor = (
    appearance: 'light' | 'dark',
    role: ColorRole,
  ): string | undefined => {
    const path = `color.${appearance}.${role}`;
    const t = read(path, `color.${appearance}.${kebab(role)}`);
    if (!t) return undefined;
    if (t.type !== undefined && t.type !== 'color') {
      errors.push({
        path: `/color/${appearance}/${role}`,
        message: `expected a colour token, got $type "${t.type}"`,
      });
      return undefined;
    }
    const r = toHexColor(t.value);
    if ('error' in r) {
      errors.push({ path: `/color/${appearance}/${role}`, message: r.error });
      return undefined;
    }
    if (r.droppedAlpha)
      warnings.push(`${path}: alpha dropped (theme colours are opaque)`);
    return r.hex;
  };

  const { base } = options;
  let colorsImported = 0;
  const colors = (appearance: 'light' | 'dark') => {
    const defaults = (
      appearance === 'light' ? SEMANTIC_DEFAULTS_LIGHT : SEMANTIC_DEFAULTS_DARK
    ) as Readonly<Record<string, string>>;
    const fallbackNote = base ? 'current value kept' : 'platform default used';
    return Object.fromEntries(
      COLOR_ROLES.map((role) => {
        const given = readColor(appearance, role);
        if (given === undefined) {
          warnings.push(
            `color.${appearance}.${role}: not set, ${fallbackNote}`,
          );
          return [
            role,
            base ? base.color[appearance][role] : defaults[colorVar(role)],
          ];
        }
        colorsImported++;
        return [role, given];
      }),
    );
  };

  const preset = (path: string, fallback: string): string => {
    const t = read(path);
    return t && typeof t.value === 'string' ? t.value : fallback;
  };

  const candidate = {
    schemaVersion: 1,
    revision: base?.revision ?? options.revision ?? 1,
    appearance: {
      mode: preset(
        'appearance.mode',
        base?.appearance.mode ?? DEFAULT_PRESETS.appearance,
      ),
    },
    color: { light: colors('light'), dark: colors('dark') },
    typography: {
      fontFamily: preset(
        'typography.fontFamily',
        base?.typography.fontFamily ?? DEFAULT_PRESETS.fontFamily,
      ),
      scale: preset(
        'typography.scale',
        base?.typography.scale ?? DEFAULT_PRESETS.scale,
      ),
    },
    shape: {
      radius: preset(
        'shape.radius',
        base?.shape.radius ?? DEFAULT_PRESETS.radius,
      ),
    },
    elevation: preset(
      'elevation',
      base?.elevation ?? DEFAULT_PRESETS.elevation,
    ),
    density: preset('density', base?.density ?? DEFAULT_PRESETS.density),
    // The logo stays with the base: a token file cannot name an uploaded asset.
    brand: {
      ...base?.brand,
      name: preset(
        'brand.name',
        base?.brand.name ?? options.brandName ?? 'Brand',
      ),
    },
    launcher: {
      position: preset(
        'launcher.position',
        base?.launcher.position ?? DEFAULT_PRESETS.launcher.position,
      ),
      shape: preset(
        'launcher.shape',
        base?.launcher.shape ?? DEFAULT_PRESETS.launcher.shape,
      ),
      icon: preset(
        'launcher.icon',
        base?.launcher.icon ?? DEFAULT_PRESETS.launcher.icon,
      ),
    },
  };

  for (const path of tokens.keys())
    if (!used.has(path))
      warnings.push(`${path}: not part of theme.v1, ignored`);

  if (errors.length > 0) return { ok: false, errors, warnings };
  const result = validateTheme(candidate);
  return result.ok
    ? { ok: true, theme: result.value, warnings, colorsImported }
    : { ok: false, errors: result.errors, warnings };
}

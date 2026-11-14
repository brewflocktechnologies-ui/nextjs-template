// Canonical values and serialisation (SEM-05, SEM-06). Every CSS value is built here from a typed
// value: numbers, allow-listed units, hex colours, font stacks from the platform registry. No string
// from a source file is copied into output (ADR-014).
import { SCALES } from '@byteflock/design-tokens';
import Color from 'colorjs.io';
import type { ContractType } from '../contract/contract';

export type Serialised =
  | { ok: true; css: string; notes: Note[] }
  | { ok: false; message: string };

export interface Note {
  severity: 'warning' | 'info';
  code: string;
  message: string;
  original: unknown;
  result: string;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const finite = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

/** Numbers as CSS: the shortest round-trip digits, with any exponent expanded exactly (no rounding). */
export const num = (n: number): string => {
  if (Object.is(n, -0)) return '0';
  const s = String(n);
  const m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(s);
  if (!m) return s;
  const [, sign, int, frac = '', exp] = m;
  const digits = int + frac;
  const point = 1 + Number(exp);
  const body =
    point <= 0
      ? `0.${'0'.repeat(-point)}${digits}`
      : point >= digits.length
        ? digits + '0'.repeat(point - digits.length)
        : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return sign + body;
};

// ---- Colour ------------------------------------------------------------------------------------

/** DTCG 2025.10 colour space names → colorjs.io space ids. */
const SPACES: Record<string, string> = {
  srgb: 'srgb',
  'srgb-linear': 'srgb-linear',
  hsl: 'hsl',
  hwb: 'hwb',
  lab: 'lab',
  lch: 'lch',
  oklab: 'oklab',
  oklch: 'oklch',
  'display-p3': 'p3',
  'a98-rgb': 'a98rgb',
  'prophoto-rgb': 'prophoto',
  rec2020: 'rec2020',
  'xyz-d65': 'xyz-d65',
  'xyz-d50': 'xyz-d50',
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const byte = (n: number) =>
  Math.round(Math.min(1, Math.max(0, n)) * 255)
    .toString(16)
    .padStart(2, '0');

interface Rgba {
  hex: string;
  alpha: number;
  notes: Note[];
}

function parseColor(value: unknown): Rgba | { error: string } {
  if (typeof value === 'string') {
    const m = HEX.exec(value.trim());
    if (!m)
      return { error: 'a colour must be a DTCG colour object or a hex string' };
    let h = m[1].toLowerCase();
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const alpha = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1;
    return { hex: `#${h.slice(0, 6)}`, alpha, notes: [] };
  }
  if (!isObject(value))
    return { error: 'a colour must be a DTCG colour object or a hex string' };
  const space = value['colorSpace'];
  const components = value['components'];
  const alpha = value['alpha'] === undefined ? 1 : value['alpha'];
  if (!finite(alpha) || alpha < 0 || alpha > 1)
    return { error: 'alpha must be a number from 0 to 1' };
  if (typeof space !== 'string' || !(space in SPACES))
    return {
      error: `colour space "${String(space)}" is not a DTCG 2025.10 colour space`,
    };
  if (!Array.isArray(components) || components.length !== 3)
    return { error: 'a colour needs three components' };
  if (!components.every((c) => finite(c) || c === 'none'))
    return { error: 'colour components must be numbers or "none"' };
  const fallback = typeof value['hex'] === 'string' ? value['hex'] : undefined;
  const coords = components.map((c) => (c === 'none' ? 0 : (c as number))) as [
    number,
    number,
    number,
  ];

  if (space === 'srgb') {
    const bytes = coords.map((c) => c * 255);
    const exact = bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255);
    const hex = `#${coords.map(byte).join('')}`;
    if (coords.some((c) => c < 0 || c > 1))
      return { error: 'sRGB components must be between 0 and 1' };
    return {
      hex,
      alpha,
      notes: exact
        ? []
        : [
            {
              severity: 'info',
              code: 'rounded-to-8-bit',
              message: 'sRGB components rounded to 8 bits per channel',
              original: value,
              result: hex,
            },
          ],
    };
  }
  if (fallback !== undefined) {
    const parsed = parseColor(fallback);
    if ('error' in parsed || parsed.hex.length !== 7)
      return { error: `hex fallback "${fallback}" is not #rrggbb` };
    return {
      hex: parsed.hex,
      alpha,
      notes: [
        {
          severity: 'info',
          code: 'hex-fallback-used',
          message: `${space} colour emitted through its own hex fallback`,
          original: value,
          result: parsed.hex,
        },
      ],
    };
  }
  const color = new Color(SPACES[space], coords, alpha);
  const inGamut = color.inGamut('srgb');
  const srgb = (
    inGamut
      ? color.to('srgb')
      : color.toGamut({ space: 'srgb', method: 'css' }).to('srgb')
  ).coords;
  const hex = `#${srgb.map((c) => byte(c ?? 0)).join('')}`;
  return {
    hex,
    alpha,
    notes: [
      inGamut
        ? {
            severity: 'info',
            code: 'converted-to-srgb',
            message: `${space} colour converted to sRGB (inside the sRGB gamut)`,
            original: value,
            result: hex,
          }
        : {
            severity: 'warning',
            code: 'out-of-gamut',
            message: `${space} colour is outside sRGB; mapped to the nearest sRGB colour (CSS Color 4 gamut mapping); needs approval`,
            original: value,
            result: hex,
          },
    ],
  };
}

function serialiseColor(
  value: unknown,
  allowAlpha: boolean,
): Serialised & { hex?: string } {
  const c = parseColor(value);
  if ('error' in c) return { ok: false, message: c.error };
  if (c.alpha < 1 && !allowAlpha)
    return {
      ok: false,
      message: `this token must be opaque; alpha is ${num(c.alpha)} (never flattened silently)`,
    };
  const css = c.alpha < 1 ? `${c.hex}${byte(c.alpha)}` : c.hex;
  return { ok: true, css, notes: c.notes, hex: c.hex };
}

// ---- Dimensions, durations, numbers ------------------------------------------------------------

export function dimensionPx(
  value: unknown,
): { value: number; unit: 'px' | 'rem'; px: number } | null {
  if (!isObject(value) || !finite(value['value'])) return null;
  const unit = value['unit'];
  if (unit !== 'px' && unit !== 'rem') return null;
  return {
    value: value['value'],
    unit,
    px: unit === 'rem' ? value['value'] * 16 : value['value'],
  };
}

const serialiseDimension = (value: unknown): Serialised => {
  const d = dimensionPx(value);
  return d
    ? { ok: true, css: `${num(d.value)}${d.unit}`, notes: [] }
    : {
        ok: false,
        message: 'a dimension must be { value: number, unit: "px" | "rem" }',
      };
};

const serialiseDuration = (value: unknown): Serialised => {
  if (
    isObject(value) &&
    finite(value['value']) &&
    value['value'] >= 0 &&
    (value['unit'] === 'ms' || value['unit'] === 's')
  )
    return {
      ok: true,
      css: `${num(value['value'])}${value['unit']}`,
      notes: [],
    };
  return {
    ok: false,
    message: 'a duration must be { value: number ≥ 0, unit: "ms" | "s" }',
  };
};

/** DTCG 2025.10 font-weight keywords. */
const WEIGHTS: Record<string, number> = {
  thin: 100,
  hairline: 100,
  'extra-light': 200,
  'ultra-light': 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  'semi-bold': 600,
  'demi-bold': 600,
  bold: 700,
  'extra-bold': 800,
  'ultra-bold': 800,
  black: 900,
  heavy: 900,
  'extra-black': 950,
  'ultra-black': 950,
};

const serialiseWeight = (value: unknown): Serialised => {
  const n = typeof value === 'string' ? WEIGHTS[value] : value;
  return finite(n) && n >= 1 && n <= 1000
    ? { ok: true, css: num(n), notes: [] }
    : {
        ok: false,
        message: 'a font weight must be 1–1000 or a DTCG weight keyword',
      };
};

// ---- Fonts (SEM-06) ----------------------------------------------------------------------------

/** First family name of a CSS font stack, unquoted. */
const firstFamily = (stack: string) =>
  stack.split(',')[0].trim().replace(/^"|"$/g, '');

/** The platform font registry: id → its fixed stack, keyed by first family (case-insensitive). */
export const FONT_REGISTRY: ReadonlyMap<string, { id: string; stack: string }> =
  new Map(
    Object.entries(SCALES.fontStacks as Record<string, string>).map(
      ([id, stack]) => [firstFamily(stack).toLowerCase(), { id, stack }],
    ),
  );

const serialiseFontFamily = (value: unknown): Serialised => {
  const families = typeof value === 'string' ? [value] : value;
  if (
    !Array.isArray(families) ||
    families.length === 0 ||
    !families.every((f) => typeof f === 'string')
  )
    return {
      ok: false,
      message: 'a font family must be a string or a list of strings',
    };
  const entry = FONT_REGISTRY.get(String(families[0]).trim().toLowerCase());
  if (!entry)
    return {
      ok: false,
      message: `font "${String(families[0]).slice(0, 60)}" is not in the platform font registry (${[...FONT_REGISTRY.values()].map((e) => e.id).join(', ')}); the platform must self-host and register it first`,
    };
  return { ok: true, css: entry.stack, notes: [] };
};

// ---- Shadow ------------------------------------------------------------------------------------

const serialiseShadow = (value: unknown): Serialised => {
  const layers = Array.isArray(value) ? value : [value];
  if (layers.length < 1 || layers.length > 3)
    return { ok: false, message: 'a shadow needs 1–3 layers' };
  const parts: string[] = [];
  const notes: Note[] = [];
  for (const layer of layers) {
    if (!isObject(layer))
      return { ok: false, message: 'a shadow layer must be an object' };
    const dims = ['offsetX', 'offsetY', 'blur', 'spread'].map((k) =>
      dimensionPx(layer[k]),
    );
    if (dims.some((d) => d === null))
      return {
        ok: false,
        message: 'shadow offsetX, offsetY, blur and spread must be dimensions',
      };
    if (dims[2]!.value < 0)
      return { ok: false, message: 'shadow blur cannot be negative' };
    const color = serialiseColor(layer['color'], true);
    if (!color.ok)
      return { ok: false, message: `shadow colour: ${color.message}` };
    notes.push(...color.notes);
    const inset = layer['inset'] === true ? 'inset ' : '';
    parts.push(
      `${inset}${dims.map((d) => `${num(d!.value)}${d!.unit}`).join(' ')} ${color.css}`,
    );
  }
  return { ok: true, css: parts.join(', '), notes };
};

// ---- Dispatch ----------------------------------------------------------------------------------

export function serialise(
  type: ContractType,
  value: unknown,
  options: { alpha?: boolean } = {},
): Serialised {
  switch (type) {
    case 'color':
      return serialiseColor(value, options.alpha === true);
    case 'dimension':
      return serialiseDimension(value);
    case 'number':
      return finite(value)
        ? { ok: true, css: num(value), notes: [] }
        : { ok: false, message: 'expected a number' };
    case 'fontWeight':
      return serialiseWeight(value);
    case 'fontFamily':
      return serialiseFontFamily(value);
    case 'shadow':
      return serialiseShadow(value);
    case 'duration':
      return serialiseDuration(value);
    case 'cubicBezier':
      return Array.isArray(value) &&
        value.length === 4 &&
        value.every(finite) &&
        value[0] >= 0 &&
        value[0] <= 1 &&
        value[2] >= 0 &&
        value[2] <= 1
        ? {
            ok: true,
            css: `cubic-bezier(${value.map(num).join(', ')})`,
            notes: [],
          }
        : {
            ok: false,
            message:
              'a cubic Bézier must be four numbers, x values between 0 and 1',
          };
  }
}

/** DTCG types a contract type accepts from a source token. */
export const ACCEPTED_TYPES: Record<ContractType, readonly string[]> = {
  color: ['color'],
  dimension: ['dimension'],
  number: ['number'],
  fontWeight: ['fontWeight'],
  fontFamily: ['fontFamily'],
  shadow: ['shadow'],
  duration: ['duration'],
  cubicBezier: ['cubicBezier'],
};

/** Output safety (THEME-03, ADR-014): nothing that could end a declaration or open a rule. */
export const UNSAFE = /url\(|expression\(|[;{}<>\\\n\r]|\/\*|@import/i;

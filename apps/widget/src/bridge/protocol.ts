// Bridge protocol v1 between the launcher (customer page) and the frame (widget origin).
// Normative contract: SPECS/contracts/bridge-protocol-v1.md (BRIDGE-01 … BRIDGE-09).
// Changes to this file need the CONTRACT-CHANGE: trailer and a note under docs/contract-changes/.
//
// Pure module: no DOM, no window, no network, so it runs in Node tests and in both bundles.

export const PROTOCOL_VERSION = 1 as const;

export const LIMITS = {
  typeLength: 32,
  idLength: 64,
  localeLength: 35,
  traitLength: 256,
  unreadMax: 99,
  layoutHeightMax: 2000,
  /** Token bucket per message type (BRIDGE-05). */
  bucketCapacity: 20,
  bucketRefillPerSecond: 20,
  /** At most one RATE_LIMITED error per this many milliseconds. */
  rateLimitedErrorIntervalMs: 10_000,
} as const;

export type DropReason =
  | 'envelope'
  | 'type'
  | 'payload'
  | 'origin'
  | 'source'
  | 'rate_limited'
  | 'theme_in_production';

export type Radius = 'none' | 'sm' | 'md' | 'lg' | 'full';
export type LauncherIcon = 'chat' | 'help' | 'message';
export type LauncherPosition = 'bottom-right' | 'bottom-left';
export type LauncherShape = 'circle' | 'pill';

export interface LauncherTheme {
  bg: string;
  fg: string;
  radius: Radius;
  icon: LauncherIcon;
  position: LauncherPosition;
  shape: LauncherShape;
}

export const ERROR_CODES = [
  'CONFIG_TIMEOUT',
  'CONFIG_INVALID',
  'THEME_INVALID',
  'THEME_UNSUPPORTED_VERSION',
  'ORIGIN_MISMATCH',
  'ORIGIN_NOT_ALLOWED',
  'FRAME_INIT_FAILED',
  'RATE_LIMITED',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type FrameToHost =
  | { type: 'ready'; payload: { launcherTheme: LauncherTheme } }
  | { type: 'state'; payload: { open: boolean } }
  | { type: 'unread'; payload: { count: number } }
  | {
      type: 'layout';
      payload: { mode: 'panel' | 'fullscreen'; height?: number };
    }
  | { type: 'error'; payload: { code: ErrorCode } }
  | { type: 'consent.request'; payload: Record<string, never> };

export type HostToFrame =
  | { type: 'open'; payload: Record<string, never> }
  | { type: 'close'; payload: Record<string, never> }
  | { type: 'consent'; payload: { granted: boolean } }
  | { type: 'locale'; payload: { tag: string } }
  | {
      type: 'identify';
      payload: {
        traits: { externalId?: string; name?: string; email?: string };
      };
    }
  | { type: 'visibility'; payload: { hidden: boolean } }
  | { type: 'theme.preview'; payload: { vars: Record<string, string> } };

export interface Envelope {
  v: typeof PROTOCOL_VERSION;
  type: string;
  id: string;
  payload: Record<string, unknown>;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; reason: DropReason };

// --- primitive validators ------------------------------------------------------------------

const COLOR = /^#[0-9a-f]{6}$/;
const LOCALE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const TYPE = /^[a-z][a-z.]*$/;
/** A resolved theme variable name: only --sem-* names, lower-case kebab. */
const VAR_NAME = /^--sem-[a-z0-9]+(-[a-z0-9]+)*$/;
/** Values allowed in theme.preview: colours, plain lengths and numbers, font-stack text. Never url(), expression(), braces or semicolons. */
const VAR_VALUE =
  /^(#[0-9a-f]{6}|#[0-9a-f]{8}|-?\d+(\.\d+)?(px|rem|em|ms|%)?|[A-Za-z0-9 ,"'-]{1,200})$/;
const FORBIDDEN_VALUE = /url\(|expression\(|[;{}<>\\]|\/\*/i;

export const isColor = (v: unknown): v is string =>
  typeof v === 'string' && COLOR.test(v);
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;
const hasOnlyKeys = (o: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(o).every((k) => allowed.includes(k));
const isBoundedString = (v: unknown, max: number) =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
const oneOf = <T extends string>(v: unknown, values: readonly T[]): v is T =>
  typeof v === 'string' && (values as readonly string[]).includes(v);

const RADII = ['none', 'sm', 'md', 'lg', 'full'] as const;
const ICONS = ['chat', 'help', 'message'] as const;
const POSITIONS = ['bottom-right', 'bottom-left'] as const;
const SHAPES = ['circle', 'pill'] as const;

export function isLauncherTheme(v: unknown): v is LauncherTheme {
  return (
    isPlainObject(v) &&
    hasOnlyKeys(v, ['bg', 'fg', 'radius', 'icon', 'position', 'shape']) &&
    isColor(v.bg) &&
    isColor(v.fg) &&
    oneOf(v.radius, RADII) &&
    oneOf(v.icon, ICONS) &&
    oneOf(v.position, POSITIONS) &&
    oneOf(v.shape, SHAPES)
  );
}

export function isPreviewVars(v: unknown): v is Record<string, string> {
  if (!isPlainObject(v)) return false;
  const entries = Object.entries(v);
  return (
    entries.length > 0 &&
    entries.length <= 100 &&
    entries.every(
      ([k, val]) =>
        VAR_NAME.test(k) &&
        typeof val === 'string' &&
        VAR_VALUE.test(val) &&
        !FORBIDDEN_VALUE.test(val),
    )
  );
}

// --- envelope ------------------------------------------------------------------------------

/** BRIDGE-01: a plain object with v === 1, a bounded type and id, and an object payload. */
export function parseEnvelope(data: unknown): Result<Envelope> {
  if (
    !isPlainObject(data) ||
    !hasOnlyKeys(data, ['v', 'type', 'id', 'payload'])
  )
    return { ok: false, reason: 'envelope' };
  const { v, type, id, payload } = data;
  if (v !== PROTOCOL_VERSION) return { ok: false, reason: 'envelope' };
  if (
    typeof type !== 'string' ||
    type.length > LIMITS.typeLength ||
    !TYPE.test(type)
  )
    return { ok: false, reason: 'envelope' };
  if (!isBoundedString(id, LIMITS.idLength))
    return { ok: false, reason: 'envelope' };
  if (!isPlainObject(payload)) return { ok: false, reason: 'envelope' };
  return { ok: true, value: { v, type, id: id as string, payload } };
}

const empty = (p: Record<string, unknown>) => Object.keys(p).length === 0;

/** BRIDGE-02, validated on the launcher side. Unknown types and extra keys are dropped. */
export function validateFrameToHost(env: Envelope): Result<FrameToHost> {
  const p = env.payload;
  switch (env.type) {
    case 'ready':
      return hasOnlyKeys(p, ['launcherTheme']) &&
        isLauncherTheme(p.launcherTheme)
        ? {
            ok: true,
            value: {
              type: 'ready',
              payload: { launcherTheme: p.launcherTheme },
            },
          }
        : { ok: false, reason: 'payload' };
    case 'state':
      return hasOnlyKeys(p, ['open']) && typeof p.open === 'boolean'
        ? { ok: true, value: { type: 'state', payload: { open: p.open } } }
        : { ok: false, reason: 'payload' };
    case 'unread':
      return hasOnlyKeys(p, ['count']) &&
        Number.isInteger(p.count) &&
        (p.count as number) >= 0
        ? {
            ok: true,
            value: {
              type: 'unread',
              payload: { count: Math.min(p.count as number, LIMITS.unreadMax) },
            },
          }
        : { ok: false, reason: 'payload' };
    case 'layout': {
      const heightOk =
        p.height === undefined ||
        (Number.isInteger(p.height) &&
          (p.height as number) >= 0 &&
          (p.height as number) <= LIMITS.layoutHeightMax);
      return hasOnlyKeys(p, ['mode', 'height']) &&
        oneOf(p.mode, ['panel', 'fullscreen'] as const) &&
        heightOk
        ? {
            ok: true,
            value: {
              type: 'layout',
              payload: p as { mode: 'panel' | 'fullscreen'; height?: number },
            },
          }
        : { ok: false, reason: 'payload' };
    }
    case 'error':
      return hasOnlyKeys(p, ['code']) && oneOf(p.code, ERROR_CODES)
        ? { ok: true, value: { type: 'error', payload: { code: p.code } } }
        : { ok: false, reason: 'payload' };
    case 'consent.request':
      return empty(p)
        ? { ok: true, value: { type: 'consent.request', payload: {} } }
        : { ok: false, reason: 'payload' };
    default:
      return { ok: false, reason: 'type' };
  }
}

/** BRIDGE-03, validated on the frame side. theme.preview is shape-checked here; mode and origin are the frame's job. */
export function validateHostToFrame(env: Envelope): Result<HostToFrame> {
  const p = env.payload;
  switch (env.type) {
    case 'open':
    case 'close':
      return empty(p)
        ? { ok: true, value: { type: env.type, payload: {} } }
        : { ok: false, reason: 'payload' };
    case 'consent':
      return hasOnlyKeys(p, ['granted']) && typeof p.granted === 'boolean'
        ? {
            ok: true,
            value: { type: 'consent', payload: { granted: p.granted } },
          }
        : { ok: false, reason: 'payload' };
    case 'locale':
      return hasOnlyKeys(p, ['tag']) &&
        isBoundedString(p.tag, LIMITS.localeLength) &&
        LOCALE.test(p.tag as string)
        ? {
            ok: true,
            value: { type: 'locale', payload: { tag: p.tag as string } },
          }
        : { ok: false, reason: 'payload' };
    case 'identify': {
      const t = p.traits;
      const ok =
        hasOnlyKeys(p, ['traits']) &&
        isPlainObject(t) &&
        hasOnlyKeys(t, ['externalId', 'name', 'email']) &&
        Object.values(t).every((x) => isBoundedString(x, LIMITS.traitLength));
      return ok
        ? {
            ok: true,
            value: {
              type: 'identify',
              payload: {
                traits: t as {
                  externalId?: string;
                  name?: string;
                  email?: string;
                },
              },
            },
          }
        : { ok: false, reason: 'payload' };
    }
    case 'visibility':
      return hasOnlyKeys(p, ['hidden']) && typeof p.hidden === 'boolean'
        ? {
            ok: true,
            value: { type: 'visibility', payload: { hidden: p.hidden } },
          }
        : { ok: false, reason: 'payload' };
    case 'theme.preview':
      return hasOnlyKeys(p, ['vars']) && isPreviewVars(p.vars)
        ? {
            ok: true,
            value: { type: 'theme.preview', payload: { vars: p.vars } },
          }
        : { ok: false, reason: 'payload' };
    default:
      return { ok: false, reason: 'type' };
  }
}

// --- rate limiting and counters ------------------------------------------------------------

/** BRIDGE-05: one bucket per message type. `now` is injectable for tests. */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();
  constructor(
    private readonly capacity: number = LIMITS.bucketCapacity,
    private readonly refillPerSecond: number = LIMITS.bucketRefillPerSecond,
  ) {}

  take(type: string, now: number): boolean {
    const b = this.buckets.get(type) ?? { tokens: this.capacity, at: now };
    const refilled = Math.min(
      this.capacity,
      b.tokens + ((now - b.at) / 1000) * this.refillPerSecond,
    );
    if (refilled < 1) {
      this.buckets.set(type, { tokens: refilled, at: now });
      return false;
    }
    this.buckets.set(type, { tokens: refilled - 1, at: now });
    return true;
  }
}

export type BridgeStats = Record<`dropped.${DropReason}` | 'accepted', number>;

export function createStats(): BridgeStats {
  return {
    accepted: 0,
    'dropped.envelope': 0,
    'dropped.type': 0,
    'dropped.payload': 0,
    'dropped.origin': 0,
    'dropped.source': 0,
    'dropped.rate_limited': 0,
    'dropped.theme_in_production': 0,
  };
}

let counter = 0;
/** Builds an outgoing envelope. The id needs uniqueness within a page, not secrecy. */
export function makeEnvelope<M extends { type: string; payload: object }>(
  message: M,
): Envelope {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 10);
  return {
    v: PROTOCOL_VERSION,
    type: message.type,
    id: `${Date.now().toString(36)}-${counter}-${random}`,
    payload: message.payload as Record<string, unknown>,
  };
}

// Frame bootstrap (PoC-A, ARCH-001 §10.3–§10.5, §10.10).
//
// 1. Resolve the parent origin (BRIDGE-04). On mismatch: render nothing, post nothing, beacon only.
// 2. Fetch config, then theme, from this origin (2 s timeout each). Any failure: embedded defaults + beacon.
// 3. Apply --sem-* variables via CSSOM, load the curated font with the FontFace API, set lang/dir.
// 4. Post `ready` with the allow-listed launcherTheme; handle host messages through the gate.
import {
  RateLimiter,
  createStats,
  makeEnvelope,
  parseEnvelope,
  validateHostToFrame,
  type DropReason,
  type ErrorCode,
  type FrameToHost,
  type HostToFrame,
} from '../bridge/protocol';
import { checkConfig, isWidgetKey, type WidgetConfig } from './config';
// Side-effect import registers <byteflock-frame-app>; a type-only use would be elided by the compiler.
import './elements';
import type { ByteflockFrameApp, ChatMessage } from './elements';
import { gate, resolveParentOrigin, type GateState } from './gate';
import {
  EMBEDDED_DEFAULT,
  FONT_STACKS,
  checkTheme,
  launcherThemeOf,
  themeToVars,
  type Appearance,
  type ProvisionalTheme,
} from './provisional-theme';

const FETCH_TIMEOUT_MS = 2000;
const RTL = new Set(['ar', 'he', 'fa', 'ur']);

const params = new URLSearchParams(location.search);
const widgetKey = params.get('key') ?? '';
const mode: 'production' | 'preview' | 'test' =
  params.get('mode') === 'preview'
    ? 'preview'
    : params.get('mode') === 'test'
      ? 'test'
      : 'production';
const embedded = window.parent !== window;
const parent = embedded
  ? resolveParentOrigin(location.ancestorOrigins?.[0], params.get('parent'))
  : ({ ok: false, reason: 'NO_PARENT' } as const);

const stats = createStats();
const limiter = new RateLimiter();
let gateState: GateState = {
  expected: parent.ok ? parent.origin : null,
  pinned: null,
};
let lastRateLimitedError = -Infinity;

if (
  mode === 'test' &&
  parent.ok &&
  __PLAYGROUND_ORIGINS__.includes(parent.origin)
) {
  // Test hook for the playground's Playwright suite only (BRIDGE-06).
  Object.defineProperty(window, '__byteflockBridgeStats', { value: stats });
}

const app = document.querySelector('byteflock-frame-app') as ByteflockFrameApp;
document.documentElement.style.setProperty('margin', '0');
document.body.style.setProperty('margin', '0');

// --- telemetry (ENDP-08): frame only, codes only ---------------------------------------------

function beacon(code: ErrorCode) {
  const body = JSON.stringify({
    widgetKey,
    code,
    frameVersion: __FRAME_VERSION__,
    ts: Date.now(),
  });
  try {
    navigator.sendBeacon(new URL('/v1/telemetry', location.origin), body);
  } catch {
    // Telemetry must never break the frame.
  }
}

// --- posting to the host ------------------------------------------------------------------

let readySent = false;
function post(message: FrameToHost) {
  const target = gateState.pinned ?? gateState.expected;
  if (!target) return;
  // Before pinning, only `ready` may go out, once (BRIDGE-04 rule 4).
  if (!gateState.pinned && message.type !== 'ready') return;
  window.parent.postMessage(makeEnvelope(message), target);
}

// --- fetching -----------------------------------------------------------------------------

class FetchError extends Error {
  constructor(readonly kind: 'timeout' | 'status' | 'parse') {
    super(kind);
  }
}

async function fetchJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      signal: controller.signal,
      credentials: 'omit',
    });
    if (!res.ok) throw new FetchError('status');
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new FetchError('parse');
    }
  } catch (e) {
    if (e instanceof FetchError) throw e;
    throw new FetchError(controller.signal.aborted ? 'timeout' : 'status');
  } finally {
    clearTimeout(timer);
  }
}

async function loadConfig(): Promise<WidgetConfig | null> {
  if (!isWidgetKey(widgetKey)) {
    beacon('CONFIG_INVALID');
    return null;
  }
  try {
    const config = checkConfig(await fetchJson(`/v1/config/${widgetKey}.json`));
    if (!config) beacon('CONFIG_INVALID');
    return config;
  } catch (e) {
    beacon(
      e instanceof FetchError && e.kind === 'timeout'
        ? 'CONFIG_TIMEOUT'
        : 'CONFIG_INVALID',
    );
    return null;
  }
}

async function loadTheme(
  config: WidgetConfig,
): Promise<ProvisionalTheme | null> {
  try {
    const result = checkTheme(
      await fetchJson(
        `/v1/themes/${config.tenantId}/${config.themeRevision}.json`,
      ),
    );
    if (result.ok) return result.theme;
    beacon(result.code);
    return null;
  } catch {
    beacon('THEME_INVALID');
    return null;
  }
}

// --- applying the theme -------------------------------------------------------------------

let theme: ProvisionalTheme = EMBEDDED_DEFAULT;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const appearance = (): Appearance =>
  theme.appearance.mode === 'system'
    ? darkQuery.matches
      ? 'dark'
      : 'light'
    : theme.appearance.mode;

function applyVars(vars: Record<string, string>) {
  for (const [name, value] of Object.entries(vars))
    document.documentElement.style.setProperty(name, value);
}

function applyTheme() {
  applyVars(themeToVars(theme, appearance()));
  document.documentElement.dataset.appearance = appearance();
  app.brandName = theme.brand.name;
}
darkQuery.addEventListener(
  'change',
  () => theme.appearance.mode === 'system' && applyTheme(),
);

async function loadFont(family: ProvisionalTheme['typography']['fontFamily']) {
  // Only Inter ships in PoC-A; the other curated families arrive in P1.5 and fall back to the stack.
  if (family !== 'inter' || !('fonts' in document)) return;
  const faces = [
    new FontFace('Inter', 'url(/v1/fonts/inter/inter-latin-400-normal.woff2)', {
      weight: '400',
    }),
    new FontFace('Inter', 'url(/v1/fonts/inter/inter-latin-600-normal.woff2)', {
      weight: '600',
    }),
  ];
  for (const face of faces) document.fonts.add(face);
  await Promise.allSettled(faces.map((f) => f.load()));
  document.documentElement.style.setProperty(
    '--sem-font-family-sans',
    FONT_STACKS.inter,
  );
}

function setLocale(tag: string) {
  const language = tag.split('-')[0].toLowerCase();
  document.documentElement.lang = tag;
  document.documentElement.dir = RTL.has(language) ? 'rtl' : 'ltr';
  app.locale = tag;
}

// --- host messages ------------------------------------------------------------------------

let consent: boolean | null = null;
let claimedTraits: Record<string, string> = {};
let unread = 0;

function drop(reason: DropReason) {
  stats[`dropped.${reason}`]++;
}

function openPanel() {
  unread = 0;
  post({ type: 'unread', payload: { count: 0 } });
  // Firefox does not pass focus into a cross-origin frame's content when the parent calls
  // iframe.focus(); focusing this window first makes the composer focus stick everywhere.
  window.focus();
  app.focusComposer();
}

function handle(message: HostToFrame, origin: string) {
  switch (message.type) {
    case 'open':
      openPanel();
      break;
    case 'close':
      break;
    case 'consent':
      // Persistence is gated on consent from P1.5; PoC-A only records the decision.
      consent = message.payload.granted;
      break;
    case 'locale':
      setLocale(message.payload.tag);
      break;
    case 'identify':
      // Tenant-supplied and unverified: stored as claimed, never echoed back (BRIDGE-03).
      claimedTraits = { ...message.payload.traits };
      break;
    case 'visibility':
      break;
    case 'theme.preview':
      if (mode !== 'preview') return drop('theme_in_production');
      if (origin !== __DASHBOARD_ORIGIN__) return drop('origin');
      applyVars(message.payload.vars);
      break;
  }
}

window.addEventListener('message', (event: MessageEvent) => {
  const g = gate(gateState, event.origin, event.source === window.parent);
  if (!g.ok) return drop(g.reason);
  const env = parseEnvelope(event.data);
  if (!env.ok) return drop(env.reason);
  const msg = validateHostToFrame(env.value);
  if (!msg.ok) return drop(msg.reason);
  const now = performance.now();
  if (!limiter.take(msg.value.type, now)) {
    drop('rate_limited');
    if (now - lastRateLimitedError > 10_000) {
      lastRateLimitedError = now;
      post({ type: 'error', payload: { code: 'RATE_LIMITED' } });
    }
    return;
  }
  gateState = g.state;
  stats.accepted++;
  handle(msg.value, event.origin);
});

app.addEventListener('frame-close', () =>
  post({ type: 'state', payload: { open: false } }),
);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') post({ type: 'state', payload: { open: false } });
});

// --- bootstrap ----------------------------------------------------------------------------

async function bootstrap() {
  if (embedded && !parent.ok) {
    // ORIGIN_MISMATCH: refuse to open. Nothing is rendered or posted to the parent.
    app.available = false;
    app.hidden = true;
    if (parent.reason === 'ORIGIN_MISMATCH') beacon('ORIGIN_MISMATCH');
    return;
  }

  applyTheme(); // embedded defaults first, so the frame is never unstyled
  const config = await loadConfig();
  if (config) {
    setLocale(params.get('locale') ?? config.locale.default);
    const loaded = await loadTheme(config);
    if (loaded) theme = loaded;
  } else {
    setLocale(params.get('locale') ?? 'en');
  }
  applyTheme();
  await loadFont(theme.typography.fontFamily);

  const greeting: ChatMessage = {
    id: 1,
    from: 'agent',
    text: `Hi! Welcome to ${theme.brand.name}. How can we help?`,
    at: new Date(),
  };
  app.messages = [greeting];

  if (!readySent) {
    readySent = true;
    post({
      type: 'ready',
      payload: { launcherTheme: launcherThemeOf(theme, appearance()) },
    });
  }
  if (config?.features.proactive) {
    unread = 1;
    // Sent once the host has pinned the channel; until then post() holds non-ready messages back.
    const announce = () =>
      gateState.pinned
        ? post({ type: 'unread', payload: { count: unread } })
        : setTimeout(announce, 100);
    announce();
  }
  if (config?.features.consent === 'required' && consent === null) {
    const ask = () =>
      gateState.pinned
        ? post({ type: 'consent.request', payload: {} })
        : setTimeout(ask, 100);
    ask();
  }
}

bootstrap().catch(() => beacon('FRAME_INIT_FAILED'));

// Referenced so the claimed traits are not tree-shaken away before P1.5 uses them.
export const _claimed = () => claimedTraits;

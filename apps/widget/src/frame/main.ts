// Frame bootstrap (ARCH-001 §10.3–§10.5, §10.10; PoC-A, hardened in P1.5).
//
// 1. Resolve the parent origin (BRIDGE-04). On mismatch: render nothing, post nothing, beacon only.
// 2. Fetch config, then theme, from this origin (2 s timeout each). Any failure: embedded defaults
//    and a beacon.
// 3. Refuse to start when the parent origin is not in the config's allowedOrigins (ENDP-02a, D-21).
// 4. Apply the theme with the contract guard and resolver (@byteflock/theme), load the curated
//    font, set lang/dir.
// 5. Post `ready` with the allow-listed launcherTheme; handle host messages through the gate.
// Storage goes only through ConsentController (P1.5-T04); nothing else is persisted.
import {
  ConsentController,
  InMemoryTransport,
  ThemeController,
  dirOf,
  t,
  type ChatMessage,
} from '@byteflock/chat-widget';
import {
  SUPPORTED_SCHEMA_VERSIONS,
  isSupportedTheme,
  type Theme,
} from '@byteflock/theme/guard';
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
import {
  checkConfig,
  isOriginAllowed,
  isWidgetKey,
  type WidgetConfig,
} from './config';
// Side-effect import registers <byteflock-frame-app>; a type-only use would be elided.
import './elements';
import type { ByteflockFrameApp } from './elements';
import { EMBEDDED_DEFAULT } from './embedded-default';
import { loadFont } from './fonts';
import { gate, resolveParentOrigin, type GateState } from './gate';
import { launcherThemeOf } from './launcher-theme';

const FETCH_TIMEOUT_MS = 2000;

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
let refused = false;
let config: WidgetConfig | null = null;

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

const themeController = new ThemeController(app);
let theme: Theme = EMBEDDED_DEFAULT;
// Until the config says otherwise, consent is required: nothing may be stored.
let consent = new ConsentController('required');
const transport = new InMemoryTransport({
  reply: () => t('agent.reply', app.locale),
});

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
  if (refused) return;
  const target = gateState.pinned ?? gateState.expected;
  if (!target) return;
  // Before pinning, only `ready` may go out, once (BRIDGE-04 rule 4).
  if (!gateState.pinned && message.type !== 'ready') return;
  window.parent.postMessage(makeEnvelope(message), target);
}

/** Refuse to run: render nothing, post nothing, one beacon (BRIDGE-04 rules 6 and 7). */
function refuse(code: ErrorCode | null) {
  refused = true;
  gateState = { expected: null, pinned: null };
  app.available = false;
  app.hidden = true;
  transport.disconnect();
  if (code) beacon(code);
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
    const doc = checkConfig(await fetchJson(`/v1/config/${widgetKey}.json`));
    if (!doc) beacon('CONFIG_INVALID');
    return doc;
  } catch (e) {
    beacon(
      e instanceof FetchError && e.kind === 'timeout'
        ? 'CONFIG_TIMEOUT'
        : 'CONFIG_INVALID',
    );
    return null;
  }
}

async function loadTheme(c: WidgetConfig): Promise<Theme | null> {
  try {
    const doc = await fetchJson(
      `/v1/themes/${c.tenantId}/${c.themeRevision}.json`,
    );
    const version = (doc as { schemaVersion?: unknown } | null)?.schemaVersion;
    if (!SUPPORTED_SCHEMA_VERSIONS.includes(version as number)) {
      beacon('THEME_UNSUPPORTED_VERSION');
      return null;
    }
    if (isSupportedTheme(doc)) return doc;
    beacon('THEME_INVALID');
    return null;
  } catch {
    beacon('THEME_INVALID');
    return null;
  }
}

// --- theme and locale ---------------------------------------------------------------------

function applyTheme() {
  themeController.setTheme(theme);
  app.brandName = theme.brand.name;
}

function setLocale(tag: string) {
  document.documentElement.lang = tag;
  document.documentElement.dir = dirOf(tag);
  app.locale = tag;
}

// --- consent ------------------------------------------------------------------------------

function syncConsent() {
  app.consentPending = consent.state === 'unknown';
  // The visitor id is created only once storage is allowed (Q-006).
  if (consent.allowed) consent.visitorId();
}

function decideConsent(granted: boolean) {
  consent.decide(granted);
  syncConsent();
}

// --- host messages ------------------------------------------------------------------------

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
      decideConsent(message.payload.granted);
      break;
    case 'locale':
      setLocale(message.payload.tag);
      break;
    case 'identify':
      // Tenant-supplied and unverified: stored in memory as claimed, never echoed (BRIDGE-03).
      claimedTraits = { ...message.payload.traits };
      break;
    case 'visibility':
      if (message.payload.hidden) transport.pause();
      else transport.resume();
      break;
    case 'theme.preview':
      if (mode !== 'preview') return drop('theme_in_production');
      if (origin !== __DASHBOARD_ORIGIN__) return drop('origin');
      themeController.apply(message.payload.vars);
      break;
  }
}

const allowed = (origin: string) =>
  !config ||
  isOriginAllowed(config, origin, {
    mode,
    dashboardOrigin: __DASHBOARD_ORIGIN__,
  });

window.addEventListener('message', (event: MessageEvent) => {
  if (refused) return;
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
  // Second allowlist check, on the origin the channel pins to (BRIDGE-04 rule 7).
  if (!gateState.pinned && g.state.pinned && !allowed(g.state.pinned))
    return refuse('ORIGIN_NOT_ALLOWED');
  gateState = g.state;
  stats.accepted++;
  handle(msg.value, event.origin);
});

app.addEventListener('frame-close', () =>
  post({ type: 'state', payload: { open: false } }),
);
app.addEventListener('consent-decision', (event) =>
  decideConsent(event.detail.granted),
);
app.addEventListener('composer-send', (event) => {
  const message: ChatMessage = {
    id: `v-${Date.now()}-${app.messages.length}`,
    from: 'visitor',
    text: event.detail.text,
    at: new Date(),
  };
  app.messages = [...app.messages, message];
  transport.send({ type: 'message', text: event.detail.text });
});
transport.subscribe((event) => {
  app.messages = [
    ...app.messages,
    { id: event.id, from: 'agent', text: event.text, at: new Date(event.at) },
  ];
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') post({ type: 'state', payload: { open: false } });
});

// --- bootstrap ----------------------------------------------------------------------------

async function bootstrap() {
  if (embedded && !parent.ok) {
    // ORIGIN_MISMATCH: refuse to open. Nothing is rendered or posted to the parent.
    refuse(parent.reason === 'ORIGIN_MISMATCH' ? 'ORIGIN_MISMATCH' : null);
    return;
  }

  applyTheme(); // embedded defaults first, so the frame is never unstyled
  config = await loadConfig();
  if (config && parent.ok && !allowed(parent.origin)) {
    refuse('ORIGIN_NOT_ALLOWED');
    return;
  }
  if (config) {
    consent = new ConsentController(config.features.consent);
    setLocale(params.get('locale') ?? config.locale.default);
    const loaded = await loadTheme(config);
    if (loaded) theme = loaded;
  } else {
    setLocale(params.get('locale') ?? 'en');
  }
  applyTheme();
  syncConsent();
  await loadFont(theme.typography.fontFamily);
  await transport.connect();

  app.messages = [
    {
      id: 'greeting',
      from: 'agent',
      text: t('greeting', app.locale, { brand: theme.brand.name }),
      at: new Date(),
    },
  ];

  if (!readySent) {
    readySent = true;
    post({
      type: 'ready',
      payload: {
        launcherTheme: launcherThemeOf(theme, themeController.appearance),
      },
    });
  }
  if (config?.features.proactive) {
    unread = 1;
    // Sent once the host has pinned the channel; until then post() holds non-ready messages back.
    const announce = () =>
      refused
        ? undefined
        : gateState.pinned
          ? post({ type: 'unread', payload: { count: unread } })
          : setTimeout(announce, 100);
    announce();
  }
  if (config?.features.consent === 'required' && consent.state === 'unknown') {
    const ask = () =>
      refused
        ? undefined
        : gateState.pinned
          ? post({ type: 'consent.request', payload: {} })
          : setTimeout(ask, 100);
    ask();
  }
}

bootstrap().catch(() => beacon('FRAME_INIT_FAILED'));

// Referenced so the claimed traits are kept until the realtime phase sends them.
export const _claimed = () => claimedTraits;

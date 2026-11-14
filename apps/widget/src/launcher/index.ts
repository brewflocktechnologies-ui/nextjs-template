// Launcher (ARCH-001 §10.2, §10.3, §10.10). Runs on the customer's page inside a Shadow DOM.
//
// Hard rules (AGENTS.md non-negotiables, tested by launcher-rules.spec.ts):
//   no fetch / XMLHttpRequest / sendBeacon, no innerHTML, no storage, no window.parent.
// The launcher renders a button, an unread badge and the iframe. Everything else happens in the frame.
import {
  RateLimiter,
  isLauncherTheme,
  makeEnvelope,
  parseEnvelope,
  validateFrameToHost,
  type HostToFrame,
  type LauncherTheme,
} from '../bridge/protocol';
import { LAUNCHER_CSS } from './styles';

export interface MountOptions {
  widgetOrigin: string;
  widgetKey: string;
  locale?: string;
  position?: 'bottom-right' | 'bottom-left';
  /** Accessible name and iframe title, from data-launcher-label. */
  label?: string;
  /** When to create the frame: 'idle' (default, proactive messaging) or on first 'open' (Q-015 measurement). */
  frameStrategy?: 'idle' | 'open';
  /** Playground only: asks the frame for its test hook (BRIDGE-06). */
  testMode?: boolean;
  script?: HTMLScriptElement | null;
  queue?: ArrayLike<unknown>[];
}

type Status = 'loading' | 'ready' | 'unavailable';
const READY_TIMEOUT_MS = 5000;
const MOBILE_MAX_WIDTH = 640;
const DEFAULT_LABELS: Record<string, string> = {
  en: 'Chat',
  de: 'Chat',
  fr: 'Discussion',
  es: 'Chat',
};

const ICONS: Record<LauncherTheme['icon'], string> = {
  chat: 'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z',
  message: 'M3 5h18v12H7l-4 4z',
  help: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 16h-2v-2h2zm2.1-7.8-.9.9c-.7.7-1.2 1.3-1.2 2.9h-2v-.5c0-1.1.5-2.1 1.2-2.8l1.2-1.2a1.9 1.9 0 0 0-1.4-3.3 2 2 0 0 0-2 2H8a4 4 0 1 1 7.1 2z',
};
const RADIUS_PX: Record<LauncherTheme['radius'], string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '16px',
  full: '9999px',
};

/**
 * Mounts one launcher per loader script. Several on one page stay independent: each owns its
 * shadow root and iframe and only accepts messages from its own frame (Q-005: test-only today).
 */
export function mount(options: MountOptions): void {
  if (options.script?.hasAttribute('data-byteflock-mounted')) return;
  options.script?.setAttribute('data-byteflock-mounted', '');
  new Launcher(options).start();
}

class Launcher {
  private readonly container = document.createElement('div');
  private readonly root: ShadowRoot;
  private readonly button = document.createElement('button');
  private readonly badge = document.createElement('span');
  private readonly label = document.createElement('span');
  private readonly icon = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg',
  );
  private readonly panel = document.createElement('div');
  /** Layout wrapper inside the shadow root; page CSS can reach the host element but not this. */
  private readonly wrapper = document.createElement('div');
  private iframe: HTMLIFrameElement | null = null;
  private readonly limiter = new RateLimiter();
  private readonly name: string;
  private status: Status = 'loading';
  private open = false;
  private unread = 0;
  private remountsLeft = 1;
  private readyTimer: ReturnType<typeof setTimeout> | undefined;
  private warned = false;
  private pending: HostToFrame[] = [];

  constructor(private readonly opts: MountOptions) {
    const lang = (opts.locale ?? navigator.language ?? 'en').split('-')[0];
    this.name = opts.label?.trim() || DEFAULT_LABELS[lang] || DEFAULT_LABELS.en;
    this.root = this.container.attachShadow({ mode: 'open' });
  }

  start(): void {
    this.render();
    document.body.append(this.container);
    this.watchRemoval();
    this.installApi();
    window.addEventListener('message', this.onMessage);
    document.addEventListener('visibilitychange', () =>
      this.send({ type: 'visibility', payload: { hidden: document.hidden } }),
    );
    if ((this.opts.frameStrategy ?? 'idle') === 'idle') this.scheduleFrame();
    this.setStatus('loading');
  }

  // --- DOM ---------------------------------------------------------------------------------

  private render() {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(LAUNCHER_CSS);
    this.root.adoptedStyleSheets = [sheet];
    this.wrapper.className = 'root';
    this.wrapper.dataset.position = this.opts.position ?? 'bottom-right';
    this.container.setAttribute('data-byteflock-launcher', '');

    this.button.type = 'button';
    this.button.className = 'launcher';
    this.button.dataset.shape = 'circle';
    this.button.setAttribute('aria-haspopup', 'dialog');
    this.button.setAttribute('aria-expanded', 'false');
    this.icon.setAttribute('viewBox', '0 0 24 24');
    this.icon.setAttribute('aria-hidden', 'true');
    this.setIcon('chat');
    this.label.className = 'label';
    this.label.textContent = this.name;
    this.badge.className = 'badge';
    this.badge.hidden = true;
    this.badge.setAttribute('aria-hidden', 'true');
    this.button.append(this.icon, this.label, this.badge);
    this.button.addEventListener('click', () => this.toggle());
    this.updateName();

    this.panel.className = 'panel';
    this.panel.dataset.state = 'hidden';
    this.wrapper.append(this.panel, this.button);
    this.root.append(this.wrapper);
  }

  private setIcon(icon: LauncherTheme['icon']) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', ICONS[icon]);
    this.icon.replaceChildren(path);
  }

  private updateName() {
    const unread =
      this.unread > 0
        ? `, ${this.unread} unread message${this.unread === 1 ? '' : 's'}`
        : '';
    const state = this.status === 'unavailable' ? ' (unavailable)' : '';
    this.button.setAttribute('aria-label', `${this.name}${unread}${state}`);
  }

  private watchRemoval() {
    // ARCH-001 §10.10: if the host removes the launcher, put it back once, then give up.
    const observer = new MutationObserver(() => {
      if (this.container.isConnected) return;
      if (this.remountsLeft-- > 0) document.body.append(this.container);
      else observer.disconnect();
    });
    observer.observe(document.body, { childList: true });
  }

  private setStatus(status: Status) {
    this.status = status;
    this.opts.script?.setAttribute('data-byteflock-chat', status);
    this.button.toggleAttribute('aria-disabled', status === 'unavailable');
    if (status === 'unavailable')
      this.button.setAttribute('aria-disabled', 'true');
    this.button.title = status === 'unavailable' ? 'Chat unavailable' : '';
    this.updateName();
  }

  // --- frame lifecycle ---------------------------------------------------------------------

  private scheduleFrame() {
    const create = () => this.createFrame();
    const whenIdle = () =>
      'requestIdleCallback' in window
        ? window.requestIdleCallback(create, { timeout: 2000 })
        : setTimeout(create, 1);
    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });
  }

  private createFrame() {
    if (this.iframe) return;
    const url = new URL('/v1/frame/', this.opts.widgetOrigin);
    url.searchParams.set('key', this.opts.widgetKey);
    if (this.opts.locale) url.searchParams.set('locale', this.opts.locale);
    url.searchParams.set('parent', location.origin);
    url.searchParams.set('v', '1');
    if (this.opts.testMode) url.searchParams.set('mode', 'test');

    const iframe = document.createElement('iframe');
    iframe.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox',
    );
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('referrerpolicy', 'strict-origin');
    iframe.setAttribute('loading', 'eager');
    iframe.title = this.name;
    iframe.src = url.href;
    this.iframe = iframe;
    this.panel.append(iframe);
    this.readyTimer = setTimeout(() => this.unavailable(), READY_TIMEOUT_MS);
  }

  private unavailable() {
    if (this.status === 'ready') return;
    this.setStatus('unavailable');
    if (!this.warned) {
      this.warned = true;
      console.warn(
        '[byteflock] Chat is unavailable: the chat frame did not load. Check frame-src in your Content-Security-Policy.',
      );
    }
  }

  private toggle() {
    if (this.status === 'unavailable') return;
    if (this.open) this.close();
    else this.show();
  }

  private show() {
    if (!this.iframe) this.createFrame();
    this.open = true;
    this.panel.dataset.layout =
      window.innerWidth < MOBILE_MAX_WIDTH ? 'fullscreen' : 'panel';
    this.panel.dataset.state = 'open';
    this.button.setAttribute('aria-expanded', 'true');
    this.trackViewport();
    this.send({ type: 'open', payload: {} });
    this.iframe?.focus();
  }

  private close() {
    this.open = false;
    this.panel.dataset.state = 'hidden';
    this.button.setAttribute('aria-expanded', 'false');
    this.untrackViewport();
    this.send({ type: 'close', payload: {} });
    this.button.focus();
  }

  /** Keeps the full-screen frame above the on-screen keyboard on mobile (ARCH-001 §17.1 item 6). */
  private readonly onViewportResize = () => {
    const vv = window.visualViewport;
    if (vv)
      this.panel.style.setProperty('--bf-viewport-height', `${vv.height}px`);
  };
  private trackingViewport = false;

  /** One listener while the panel is open; removed on close, so reopening never adds another. */
  private trackViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    this.onViewportResize();
    if (this.trackingViewport) return;
    vv.addEventListener('resize', this.onViewportResize);
    this.trackingViewport = true;
  }

  private untrackViewport() {
    if (!this.trackingViewport) return;
    window.visualViewport?.removeEventListener('resize', this.onViewportResize);
    this.trackingViewport = false;
  }

  // --- bridge ------------------------------------------------------------------------------

  private send(message: HostToFrame) {
    if (this.status !== 'ready' || !this.iframe?.contentWindow) {
      if (message.type !== 'visibility') this.pending.push(message);
      return;
    }
    // Always an exact target origin, derived from the loader's own src (BRIDGE-04 rule 1).
    this.iframe.contentWindow.postMessage(
      makeEnvelope(message),
      this.opts.widgetOrigin,
    );
  }

  private onMessage = (event: MessageEvent) => {
    if (!this.iframe || event.source !== this.iframe.contentWindow) return;
    if (event.origin !== this.opts.widgetOrigin) return;
    const env = parseEnvelope(event.data);
    if (!env.ok) return;
    const msg = validateFrameToHost(env.value);
    if (!msg.ok || !this.limiter.take(msg.value.type, performance.now()))
      return;

    switch (msg.value.type) {
      case 'ready':
        this.applyTheme(msg.value.payload.launcherTheme);
        clearTimeout(this.readyTimer);
        this.setStatus('ready');
        // First host message pins the channel in the frame; then flush anything queued.
        this.send({ type: 'visibility', payload: { hidden: document.hidden } });
        for (const queued of this.pending.splice(0)) this.send(queued);
        break;
      case 'state':
        if (!msg.value.payload.open && this.open) this.close();
        break;
      case 'unread':
        this.unread = msg.value.payload.count;
        this.badge.textContent = String(this.unread);
        this.badge.hidden = this.unread === 0;
        this.updateName();
        break;
      case 'layout':
        this.panel.dataset.layout = msg.value.payload.mode;
        break;
      case 'consent.request':
        window.dispatchEvent(new CustomEvent('byteflock-chat:consent-request'));
        break;
      case 'error':
        break;
    }
  };

  private applyTheme(theme: LauncherTheme) {
    if (!isLauncherTheme(theme)) return; // validated again, field by field (BRIDGE-02)
    this.wrapper.style.setProperty('--bf-bg', theme.bg);
    this.wrapper.style.setProperty('--bf-fg', theme.fg);
    this.wrapper.style.setProperty('--bf-radius', RADIUS_PX[theme.radius]);
    this.wrapper.dataset.position = this.opts.position ?? theme.position;
    this.button.dataset.shape = theme.shape;
    this.setIcon(theme.icon);
  }

  // --- public API (ENDP-05) ----------------------------------------------------------------

  private installApi() {
    const api = (command: unknown, payload?: unknown) =>
      this.command(command, payload);
    for (const args of this.opts.queue ?? []) api(args[0], args[1]);
    (window as unknown as { ByteflockChat: typeof api }).ByteflockChat = api;
  }

  private command(command: unknown, payload: unknown) {
    const p = (payload ?? {}) as Record<string, unknown>;
    switch (command) {
      case 'open':
        if (!this.open) this.show();
        break;
      case 'close':
        if (this.open) this.close();
        break;
      case 'consent':
        if (typeof p.granted === 'boolean')
          this.send({ type: 'consent', payload: { granted: p.granted } });
        break;
      case 'locale':
        if (typeof p.tag === 'string')
          this.send({ type: 'locale', payload: { tag: p.tag } });
        break;
      case 'identify':
        if (p.traits && typeof p.traits === 'object') {
          this.send({
            type: 'identify',
            payload: { traits: p.traits as Record<string, string> },
          });
        }
        break;
    }
  }
}

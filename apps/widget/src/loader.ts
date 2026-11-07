// Loader (ENDP-06). The one mutable script customers embed:
//   <script async src="https://widget.<platform>/v1/loader.js" data-widget-key="wk_…"></script>
//
// Built as a classic IIFE with no static imports (BOUND-05). It feature-detects, reads its own
// data attributes, queues public API calls, and dynamically imports the hashed launcher from the
// widget origin. It never fetches, injects styles, uses innerHTML, touches storage or window.parent.
(() => {
  const STATUS = 'data-byteflock-chat';
  const KEY = /^wk_[a-z0-9_]{3,40}$/;

  type Queue = ArrayLike<unknown>[];
  type Api = ((...args: unknown[]) => void) & { q?: Queue };
  const w = window as unknown as { ByteflockChat?: Api };

  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>('script[data-widget-key][src*="/v1/loader.js"]');

  const supported =
    typeof Element !== 'undefined' &&
    'attachShadow' in Element.prototype &&
    typeof customElements !== 'undefined' &&
    typeof window.postMessage === 'function' &&
    typeof IntersectionObserver !== 'undefined' &&
    typeof fetch === 'function' &&
    typeof CSSStyleSheet !== 'undefined' &&
    'replaceSync' in CSSStyleSheet.prototype;

  if (!supported) {
    script?.setAttribute(STATUS, 'unsupported');
    return;
  }

  // Queue calls made before the launcher is ready, analytics-snippet style.
  const queue: Queue = w.ByteflockChat?.q ?? [];
  const stub: Api = (...args: unknown[]) => {
    queue.push(args);
  };
  stub.q = queue;
  if (!w.ByteflockChat) w.ByteflockChat = stub;

  function boot(source: HTMLElement | null, attrs: (name: string) => string | null) {
    const widgetKey = attrs('widget-key') ?? '';
    if (!KEY.test(widgetKey)) {
      source?.setAttribute(STATUS, 'unsupported');
      return;
    }
    // The widget origin comes from the loader's own URL, never from the page.
    const src = script?.src ?? '';
    let widgetOrigin: string;
    try {
      widgetOrigin = new URL(src).origin;
    } catch {
      source?.setAttribute(STATUS, 'unsupported');
      return;
    }
    const position = attrs('position');
    source?.setAttribute(STATUS, 'loading');
    import(/* @vite-ignore */ widgetOrigin + __LAUNCHER_PATH__)
      .then((mod: { mount: (o: unknown) => void }) =>
        mod.mount({
          widgetOrigin,
          widgetKey,
          locale: attrs('locale') ?? undefined,
          position: position === 'bottom-left' || position === 'bottom-right' ? position : undefined,
          label: attrs('launcher-label') ?? undefined,
          frameStrategy: attrs('frame') === 'open' ? 'open' : 'idle',
          testMode: attrs('mode') === 'test',
          script: source,
          queue,
        }),
      )
      .catch(() => source?.setAttribute(STATUS, 'unavailable'));
  }

  if (script?.dataset.widgetKey) {
    boot(script, (name) => script.getAttribute(`data-${name}`));
  }

  // Optional declarative API: <byteflock-chat-v1 widget-key="…">, registered only once.
  if (!customElements.get('byteflock-chat-v1')) {
    customElements.define(
      'byteflock-chat-v1',
      class extends HTMLElement {
        connectedCallback() {
          boot(this, (name) => this.getAttribute(name));
        }
      },
    );
  }
})();

'use client';
// Live preview in the real widget frame (P1.6-T07, THEME-09). The frame runs in preview mode, which
// accepts `theme.preview` only from this dashboard's origin. Variables are resolved on the server.
import { useEffect, useRef, useState } from 'react';
import type { Theme } from '@byteflock/theme';

/**
 * The one bridge message the dashboard sends. P1.5-T12 did not create libs/widget-contracts, so the
 * envelope is typed locally (P1.6 §12): { v: 1, type, id, payload } per BRIDGE-01.
 */
interface ThemePreviewEnvelope {
  v: 1;
  type: 'theme.preview';
  id: string;
  payload: { vars: Record<string, string> };
}

export function PreviewFrame({
  theme,
  appearance,
  widgetKey,
  widgetOrigin,
  dashboardOrigin,
}: {
  theme: Theme | null;
  appearance: 'light' | 'dark';
  widgetKey: string;
  widgetOrigin: string;
  dashboardOrigin: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  // The iframe mounts only after the listener exists: the frame posts `ready` once, and it can
  // arrive before hydration if the iframe is in the server HTML.
  const [listening, setListening] = useState(false);
  const counter = useRef(0);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin === widgetOrigin &&
        event.source === frame.current?.contentWindow &&
        (event.data as { type?: unknown } | null)?.type === 'ready'
      )
        setReady(true);
    };
    window.addEventListener('message', onMessage);
    setListening(true);
    return () => window.removeEventListener('message', onMessage);
  }, [widgetOrigin]);

  useEffect(() => {
    if (!ready || !theme) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/theme/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme, appearance }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const { vars } = (await res.json()) as { vars: Record<string, string> };
        const message: ThemePreviewEnvelope = {
          v: 1,
          type: 'theme.preview',
          id: `preview-${Date.now().toString(36)}-${++counter.current}`,
          payload: { vars },
        };
        frame.current?.contentWindow?.postMessage(message, widgetOrigin);
      } catch {
        // Aborted by a newer edit, or the dashboard is offline: the preview just stays as it was.
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ready, theme, appearance, widgetOrigin]);

  const src = `${widgetOrigin}/v1/frame/?mode=preview&key=${encodeURIComponent(widgetKey)}&parent=${encodeURIComponent(dashboardOrigin)}&v=1`;
  return (
    <div className="overflow-hidden rounded-lg border shadow-md">
      <iframe
        ref={frame}
        src={listening ? src : undefined}
        title="Chat widget preview"
        className="relative block h-[28rem] w-full"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
      <p
        className="border-t px-3 py-2 text-xs text-muted-foreground"
        data-testid="preview-state"
      >
        {ready ? 'Preview connected.' : 'Connecting to the widget…'}
      </p>
    </div>
  );
}

import {
  expect,
  type APIRequestContext,
  type Frame,
  type Page,
} from '@playwright/test';

export const WIDGET_ORIGIN = 'http://localhost:4400';
export const DEFAULT_PRIMARY = '#334155';
export const SECRET = 'secret-123';

/** The first launcher's host element. Playwright CSS selectors pierce open shadow roots. */
export const launcherButton = (page: Page, nth = 0) =>
  page.locator('[data-byteflock-launcher] button.launcher').nth(nth);
export const launcherPanel = (page: Page, nth = 0) =>
  page.locator('[data-byteflock-launcher] .panel').nth(nth);

export async function waitReady(page: Page, nth = 0) {
  await expect(
    page.locator('script[data-widget-key]').nth(nth),
  ).toHaveAttribute('data-byteflock-chat', 'ready', { timeout: 15_000 });
}

/** The widget frame for a given key, once it has loaded. */
export async function widgetFrame(
  page: Page,
  key = 'wk_acme_demo',
): Promise<Frame> {
  await expect
    .poll(
      () =>
        page
          .frames()
          .some(
            (f) =>
              f.url().includes('/v1/frame/') && f.url().includes(`key=${key}`),
          ),
      {
        timeout: 15_000,
      },
    )
    .toBe(true);
  return page
    .frames()
    .find(
      (f) => f.url().includes('/v1/frame/') && f.url().includes(`key=${key}`),
    ) as Frame;
}

export const cssVar = (frame: Frame, name: string) =>
  frame.evaluate(
    (n) =>
      getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );

export const bridgeStats = (frame: Frame) =>
  frame.evaluate(() => ({
    ...(window as unknown as { __byteflockBridgeStats: Record<string, number> })
      .__byteflockBridgeStats,
  }));

/** Types into the frame's composer, which lives in the frame element's shadow root. */
export async function typeInComposer(
  page: Page,
  text: string,
  key = 'wk_acme_demo',
) {
  const frame = page.frameLocator(`iframe[src*="key=${key}"]`);
  const box = frame.locator('textarea');
  await box.click();
  await box.pressSequentially(text);
}

export async function openWidget(page: Page, nth = 0) {
  await launcherButton(page, nth).click();
  await expect(launcherPanel(page, nth)).toHaveAttribute('data-state', 'open');
}

/** Telemetry beacons received by the widget dev server since `since` (epoch ms) for one key. */
export async function telemetrySince(
  request: APIRequestContext,
  since: number,
  widgetKey: string,
) {
  const res = await request.get(`${WIDGET_ORIGIN}/v1/dev/telemetry`);
  const all = (await res.json()) as {
    widgetKey: string;
    code: string;
    ts: number;
    frameVersion: string;
  }[];
  return all.filter((b) => b.widgetKey === widgetKey && b.ts >= since);
}

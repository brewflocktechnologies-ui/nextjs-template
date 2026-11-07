import { expect, test, type Page } from '@playwright/test';
import {
  WIDGET_ORIGIN,
  bridgeStats,
  cssVar,
  telemetrySince,
  waitReady,
  widgetFrame,
} from './helpers';

/** Posts raw messages from the host page to the widget frame, as a hostile page script could. */
const postToFrame = (page: Page, messages: unknown[]) =>
  page.evaluate(
    ({ msgs, origin }) => {
      const iframe = document
        .querySelector('[data-byteflock-launcher]')
        ?.shadowRoot?.querySelector('iframe') as HTMLIFrameElement;
      for (const m of msgs) iframe.contentWindow?.postMessage(m, origin);
    },
    { msgs: messages, origin: WIDGET_ORIGIN },
  );

test.describe('T-02 bridge negative cases (BRIDGE-08)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clean.html?key=wk_acme_demo');
    await waitReady(page);
  });

  test('malformed envelopes are dropped and counted', async ({ page }) => {
    const frame = await widgetFrame(page);
    const before = await bridgeStats(frame);
    await postToFrame(page, [
      'open',
      [1, 'open'],
      { v: 2, type: 'open', id: 'x', payload: {} },
      { v: 1, type: 'open', payload: {} },
    ]);
    await expect
      .poll(
        async () =>
          (await bridgeStats(frame))['dropped.envelope'] -
          before['dropped.envelope'],
      )
      .toBe(4);
  });

  test('unknown types and extra payload keys are dropped and counted', async ({
    page,
  }) => {
    const frame = await widgetFrame(page);
    const before = await bridgeStats(frame);
    await postToFrame(page, [
      { v: 1, type: 'eval', id: 'a', payload: { code: 'alert(1)' } },
      { v: 1, type: 'open', id: 'b', payload: { extra: true } },
    ]);
    await expect
      .poll(
        async () =>
          (await bridgeStats(frame))['dropped.type'] - before['dropped.type'],
      )
      .toBe(1);
    expect(
      (await bridgeStats(frame))['dropped.payload'] - before['dropped.payload'],
    ).toBe(1);
  });

  test('theme.preview in production mode is dropped and changes nothing', async ({
    page,
  }) => {
    const frame = await widgetFrame(page);
    const before = await bridgeStats(frame);
    await postToFrame(page, [
      {
        v: 1,
        type: 'theme.preview',
        id: 'p',
        payload: { vars: { '--sem-color-primary': '#ff0000' } },
      },
    ]);
    await expect
      .poll(
        async () =>
          (await bridgeStats(frame))['dropped.theme_in_production'] -
          before['dropped.theme_in_production'],
      )
      .toBe(1);
    expect(await cssVar(frame, '--sem-color-primary')).toBe('#1d4ed8');
  });

  test('a flood of 200 messages is rate limited', async ({ page }) => {
    const frame = await widgetFrame(page);
    const before = await bridgeStats(frame);
    await postToFrame(
      page,
      Array.from({ length: 200 }, (_, i) => ({
        v: 1,
        type: 'visibility',
        id: `f${i}`,
        payload: { hidden: false },
      })),
    );
    await expect
      .poll(
        async () =>
          (await bridgeStats(frame))['dropped.rate_limited'] -
          before['dropped.rate_limited'],
      )
      .toBeGreaterThanOrEqual(150);
    expect(
      (await bridgeStats(frame)).accepted - before.accepted,
    ).toBeLessThanOrEqual(40);
  });
});

test('BRIDGE-04 the frame refuses to open when the parent origin does not match', async ({
  page,
  request,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Needs location.ancestorOrigins (Chromium and WebKit; Firefox from 148).',
  );
  const since = Date.now();
  await page.goto('/origin-mismatch.html');
  const frame = await widgetFrame(page);
  await expect
    .poll(() =>
      frame.evaluate(
        () =>
          (document.querySelector('byteflock-frame-app') as HTMLElement).hidden,
      ),
    )
    .toBe(true);
  await expect
    .poll(async () =>
      (await telemetrySince(request, since, 'wk_acme_demo')).map((b) => b.code),
    )
    .toContain('ORIGIN_MISMATCH');
});

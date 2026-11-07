import { expect, test, type Frame, type Page } from '@playwright/test';
import {
  WIDGET_ORIGIN,
  telemetrySince,
  waitReady,
  widgetFrame,
} from './helpers';

/** Everything the frame could have persisted on its own origin. */
const frameStorage = (frame: Frame) =>
  frame.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    cookie: document.cookie,
    indexedDB: (await indexedDB.databases()).length,
    visitorId: localStorage.getItem('byteflock.visitorId'),
  }));

const consentNoticeShown = (frame: Frame) =>
  frame.evaluate(
    () =>
      !!document
        .querySelector('byteflock-frame-app')
        ?.shadowRoot?.querySelector('byteflock-consent-notice'),
  );

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test.describe('T-07 storage is consent-gated (Q-006, P1.5-T04)', () => {
  test('wk_acme_demo (consent required): nothing stored before consent, a visitor id after', async ({
    page,
  }) => {
    await page.goto('/clean.html?key=wk_acme_demo');
    await waitReady(page);
    const frame = await widgetFrame(page);
    await expect.poll(() => consentNoticeShown(frame)).toBe(true);
    expect(await frameStorage(frame)).toEqual({
      local: [],
      session: [],
      cookie: '',
      indexedDB: 0,
      visitorId: null,
    });

    await page.locator('#consent').click();
    await expect
      .poll(async () => (await frameStorage(frame)).local)
      .toEqual(['byteflock.visitorId']);
    const after = await frameStorage(frame);
    expect(after.visitorId).toMatch(UUID);
    expect(after.session).toEqual([]);
    expect(after.cookie).toBe('');
    expect(await consentNoticeShown(frame)).toBe(false);
  });

  test('wk_globex_demo (consent not required): a visitor id at once, nothing else', async ({
    page,
  }) => {
    await page.goto('/clean.html?key=wk_globex_demo');
    await waitReady(page);
    const frame = await widgetFrame(page, 'wk_globex_demo');
    await expect
      .poll(async () => (await frameStorage(frame)).local)
      .toEqual(['byteflock.visitorId']);
    const s = await frameStorage(frame);
    expect(s.visitorId).toMatch(UUID);
    expect([s.session, s.cookie, s.indexedDB]).toEqual([[], '', 0]);
    expect(await consentNoticeShown(frame)).toBe(false);
  });
});

test.describe('T-05 allowlist (D-21, ENDP-02a, BRIDGE-04 rule 7)', () => {
  test('the frame refuses a parent origin outside allowedOrigins; T-06 beacon carries codes only', async ({
    page,
    request,
  }) => {
    const since = Date.now();
    await page.goto('/wrong-domain.html');
    // No `ready`: the launcher reaches its unavailable state through the 5 s ready timeout.
    await expect(page.locator('script[data-widget-key]')).toHaveAttribute(
      'data-byteflock-chat',
      'unavailable',
      { timeout: 12_000 },
    );
    const frame = await widgetFrame(page, 'wk_wrong_domain');
    expect(
      await frame.evaluate(
        () =>
          (document.querySelector('byteflock-frame-app') as HTMLElement | null)
            ?.hidden,
      ),
    ).toBe(true);
    await expect
      .poll(async () =>
        (await telemetrySince(request, since, 'wk_wrong_domain')).map(
          (b) => b.code,
        ),
      )
      .toEqual(['ORIGIN_NOT_ALLOWED']);
    const [beacon] = await telemetrySince(request, since, 'wk_wrong_domain');
    // T-06 (ENDP-08): exactly these four keys; no visitor data, text or origin.
    expect(Object.keys(beacon).sort()).toEqual([
      'code',
      'frameVersion',
      'ts',
      'widgetKey',
    ]);
  });

  /**
   * Serves a stand-in dashboard page at http://localhost:3000 (intercepted, no server needed) that
   * embeds the frame and records the type of every message it receives.
   */
  async function fromDashboard(
    page: Page,
    mode: 'preview' | 'production',
    key: string,
  ) {
    await page.route('http://localhost:3000/__preview-test', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><title>Dashboard stand-in</title>
<script>window.__msgs = []; addEventListener('message', (e) => __msgs.push({ origin: e.origin, type: e.data && e.data.type }));</script>
<iframe title="Preview" src="${WIDGET_ORIGIN}/v1/frame/?key=${key}&v=1&mode=${mode}&parent=${encodeURIComponent('http://localhost:3000')}"></iframe>`,
      }),
    );
    // A fulfilled page has no network address, so Chrome's Local Network Access check would block
    // the frame on localhost. Proxying the widget origin through the same route keeps both sides in
    // one address space; responses, including the frame's security headers, pass through unchanged.
    await page.route(`${WIDGET_ORIGIN}/**`, async (route) =>
      route.fulfill({ response: await route.fetch() }),
    );
    await page.goto('http://localhost:3000/__preview-test');
    return () =>
      page.evaluate(() =>
        (window as unknown as { __msgs: { type: string }[] }).__msgs.map(
          (m) => m.type,
        ),
      );
  }

  test('preview mode from the dashboard origin is always allowed', async ({
    page,
  }) => {
    const received = await fromDashboard(page, 'preview', 'wk_wrong_domain');
    await expect.poll(received, { timeout: 10_000 }).toContain('ready');
  });

  test('a production embed on the dashboard origin is refused', async ({
    page,
  }) => {
    // wk_acme_demo allows only the playground origin; another key keeps the beacon test's count exact.
    const received = await fromDashboard(page, 'production', 'wk_acme_demo');
    await page.waitForTimeout(3000);
    expect(await received()).toEqual([]);
  });
});

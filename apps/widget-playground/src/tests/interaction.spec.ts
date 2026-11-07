import { expect, test } from '@playwright/test';
import {
  WIDGET_ORIGIN,
  launcherButton,
  launcherPanel,
  openWidget,
  waitReady,
  widgetFrame,
} from './helpers';

test.describe('keyboard and accessibility (PoC-A-AC05)', () => {
  test('Enter opens and focuses the composer; Esc closes and returns focus to the launcher', async ({
    page,
  }) => {
    await page.goto('/clean.html?key=wk_acme_demo');
    await waitReady(page);
    const button = launcherButton(page);
    await expect(button).toHaveAttribute('aria-label', /^Chat with Acme Corp/);
    await expect(
      page.locator('[data-byteflock-launcher] iframe'),
    ).toHaveAttribute('title', 'Chat with Acme Corp');

    await button.focus();
    await page.keyboard.press('Enter');
    await expect(launcherPanel(page)).toHaveAttribute('data-state', 'open');
    const frame = await widgetFrame(page);
    await expect
      .poll(() =>
        frame.evaluate(
          () =>
            document.activeElement?.shadowRoot?.activeElement?.tagName ?? '',
        ),
      )
      .toBe('TEXTAREA');

    await page.keyboard.press('Escape');
    await expect(launcherPanel(page)).toHaveAttribute('data-state', 'hidden');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.querySelector('[data-byteflock-launcher]')?.shadowRoot
              ?.activeElement?.className ?? '',
        ),
      )
      .toBe('launcher');
  });

  test('the unread count is announced in the accessible name and cleared on open', async ({
    page,
  }) => {
    await page.goto('/clean.html?key=wk_acme_demo');
    await waitReady(page);
    await expect(launcherButton(page)).toHaveAttribute(
      'aria-label',
      'Chat with Acme Corp, 1 unread message',
    );
    await openWidget(page);
    await expect(launcherButton(page)).toHaveAttribute(
      'aria-label',
      'Chat with Acme Corp',
    );
  });

  test('the public API queues calls made before the launcher is ready', async ({
    page,
  }) => {
    await page.goto('/clean.html?key=wk_acme_demo');
    await page.locator('#open').click(); // may run before ready
    await waitReady(page);
    await expect(launcherPanel(page)).toHaveAttribute('data-state', 'open');
  });

  test('a right-to-left locale sets dir="rtl" in the frame', async ({
    page,
  }) => {
    await page.goto('/clean.html?key=wk_acme_demo&locale=ar');
    await waitReady(page);
    const frame = await widgetFrame(page);
    await expect
      .poll(() => frame.evaluate(() => document.documentElement.dir))
      .toBe('rtl');
  });
});

test.describe('mobile (PoC-A-AC06)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the frame fills the viewport and the composer stays visible with the keyboard open', async ({
    page,
  }) => {
    await page.goto('/mobile.html?key=wk_acme_demo');
    await waitReady(page);
    await openWidget(page);
    await expect(launcherPanel(page)).toHaveAttribute(
      'data-layout',
      'fullscreen',
    );
    const box = await launcherPanel(page).boundingBox();
    expect(box?.width).toBeCloseTo(390, -1);
    expect(box?.height).toBeGreaterThan(800);

    // Approximate the on-screen keyboard by shrinking the viewport; the panel follows visualViewport.
    await page.setViewportSize({ width: 390, height: 500 });
    const composer = page
      .frameLocator('iframe[src*="/v1/frame/"]')
      .locator('textarea');
    await expect(composer).toBeInViewport();
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });
});

test.describe('frame response headers (PoC-A-AC11, ENDP-03)', () => {
  test('the frame document carries the five security headers', async ({
    request,
  }) => {
    const res = await request.get(
      `${WIDGET_ORIGIN}/v1/frame/?key=wk_acme_demo`,
    );
    expect(res.status()).toBe(200);
    const h = res.headers();
    expect(h['content-security-policy']).toContain("default-src 'none'");
    expect(h['content-security-policy']).toContain(
      "require-trusted-types-for 'script'",
    );
    expect(h['content-security-policy']).toContain('frame-ancestors *');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    expect(h['cross-origin-opener-policy']).toBe('same-origin');
    expect(h['x-content-type-options']).toBe('nosniff');
  });

  test('the iframe has the specified sandbox and no top navigation', async ({
    page,
  }) => {
    await page.goto('/clean.html?key=wk_acme_demo');
    await waitReady(page);
    const iframe = page.locator('[data-byteflock-launcher] iframe');
    await expect(iframe).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox',
    );
    await expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin');
    await expect(iframe).toHaveAttribute('allow', 'clipboard-write');
  });

  test('unknown paths on the widget origin return 404', async ({ request }) => {
    expect(
      (await request.get(`${WIDGET_ORIGIN}/v1/does-not-exist.js`)).status(),
    ).toBe(404);
  });
});

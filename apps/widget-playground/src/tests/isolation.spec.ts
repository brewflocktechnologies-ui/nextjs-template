import { expect, test } from '@playwright/test';
import {
  SECRET,
  cssVar,
  launcherButton,
  openWidget,
  typeInComposer,
  waitReady,
  widgetFrame,
} from './helpers';

test.describe('confidentiality and hostile hosts (PoC-A)', () => {
  test('T-01 hostile script cannot read composer text', async ({ page }) => {
    await page.goto('/hostile-script.html?key=wk_acme_demo');
    await waitReady(page);
    await openWidget(page);
    await typeInComposer(page, SECRET);

    await page.locator('#attack').click();
    const log = await page.locator('#attack-log').textContent();
    expect(log).not.toContain(SECRET);
    expect(log).toContain('no accessible frame document');
    expect(log).toContain('contentDocument is null');
    expect(log).toMatch(/contentWindow\.document threw SecurityError/);
    // Key events typed into the frame never reach the host document.
    expect(log).not.toContain('keydown:s');
  });

  test('T-01 rrweb recording contains no frame content', async ({ page }) => {
    await page.goto('/rrweb.html?key=wk_acme_demo');
    await waitReady(page);
    await openWidget(page);
    await typeInComposer(page, SECRET);

    await page.locator('#dump').click();
    const snapshot = (await page.locator('#snapshot').textContent()) ?? '';
    expect(snapshot.length).toBeGreaterThan(100);
    expect(snapshot).not.toContain(SECRET);
    expect(snapshot).not.toContain('Welcome to Acme Corp'); // the frame's greeting text
  });

  test('T-08 strict CSP with Trusted Types: widget works, no violations for the widget origin', async ({
    page,
  }) => {
    await page.goto('/strict-csp.html');
    await waitReady(page);
    await openWidget(page);
    const frame = page.frameLocator('iframe[src*="/v1/frame/"]');
    await expect(frame.locator('textarea')).toBeVisible();

    const violations = await page.evaluate(
      () =>
        (
          window as unknown as {
            __cspViolations: { blocked: string; directive: string }[];
          }
        ).__cspViolations,
    );
    expect(
      violations.filter((v) => v.blocked.includes('localhost:4400')),
    ).toEqual([]);
    // The page's own inline <style> was blocked, which proves the policy is enforced.
    expect(violations.some((v) => v.directive.startsWith('style-src'))).toBe(
      true,
    );
    await expect(page.locator('body')).not.toHaveCSS(
      'background-color',
      'rgb(255, 0, 0)',
    );
  });

  test('two instances are themed and operated independently', async ({
    page,
  }) => {
    await page.goto('/two-instances.html');
    await waitReady(page, 0);
    await waitReady(page, 1);
    const acme = await widgetFrame(page, 'wk_acme_demo');
    const globex = await widgetFrame(page, 'wk_globex_demo');
    expect(await cssVar(acme, '--sem-color-primary')).toBe('#1d4ed8');
    expect(await cssVar(globex, '--sem-color-primary')).toBe('#5eead4'); // Globex is dark mode

    // Launchers mount in the order their frames become ready, so address them by key.
    await page
      .locator(
        '[data-byteflock-launcher] .root:has(iframe[src*="wk_acme_demo"]) button.launcher',
      )
      .click();
    await expect(
      page.locator(
        '[data-byteflock-launcher] .root:has(iframe[src*="wk_globex_demo"]) .panel',
      ),
    ).toHaveAttribute('data-state', 'hidden');
    await expect(
      page.locator(
        '[data-byteflock-launcher] .root:has(iframe[src*="wk_globex_demo"])',
      ),
    ).toHaveAttribute('data-position', 'bottom-left');
  });

  test('hostile CSS does not reach the launcher or the frame', async ({
    page,
  }) => {
    await page.goto('/hostile-css.html?key=wk_acme_demo');
    await waitReady(page);
    const button = launcherButton(page);
    await expect(button).toHaveCSS('font-size', '15px');
    await expect(button).toHaveCSS('direction', 'ltr');
    expect(
      await button.evaluate((el) => getComputedStyle(el).fontFamily),
    ).toContain('system-ui');
    await expect(button).toHaveCSS('transform', 'none');
    await expect(button).toHaveCSS('background-color', 'rgb(29, 78, 216)');

    const frame = await widgetFrame(page);
    expect(await cssVar(frame, '--sem-color-primary')).toBe('#1d4ed8');
  });

  test('the curated font renders in the frame; the launcher keeps the system font', async ({
    page,
  }) => {
    await page.goto('/clean.html?key=wk_acme_demo');
    await waitReady(page);
    const frame = await widgetFrame(page);
    await expect
      .poll(() => frame.evaluate(() => document.fonts.check('600 12px Inter')))
      .toBe(true);
    expect(
      await launcherButton(page).evaluate(
        (el) => getComputedStyle(el).fontFamily,
      ),
    ).not.toContain('Inter');
  });

  test('the launcher re-mounts once after removal, then gives up', async ({
    page,
  }) => {
    await page.goto('/clean.html?key=wk_acme_demo');
    await waitReady(page);
    const host = page.locator('[data-byteflock-launcher]');
    await host.evaluate((el) => el.remove());
    await expect(host).toHaveCount(1);
    await host.evaluate((el) => el.remove());
    await page.waitForTimeout(300);
    await expect(host).toHaveCount(0);
  });

  test('the theme reaches the launcher: shape, colour and position per tenant', async ({
    page,
  }) => {
    await page.goto('/clean.html?key=wk_initech_demo');
    await waitReady(page);
    await expect(launcherButton(page)).toHaveAttribute('data-shape', 'pill');
    await expect(launcherButton(page)).toHaveCSS(
      'background-color',
      'rgb(180, 83, 9)',
    );
    const frame = await widgetFrame(page, 'wk_initech_demo');
    expect(await cssVar(frame, '--sem-radius-md')).toBe('9999px');
    expect(await cssVar(frame, '--sem-density-factor')).toBe('0.85');
  });
});

import { expect, test } from '@playwright/test';
import {
  DEFAULT_PRIMARY,
  cssVar,
  launcherButton,
  telemetrySince,
  waitReady,
  widgetFrame,
} from './helpers';

test.describe('failure modes (ENDP-07)', () => {
  test('frame blocked by CSP: disabled launcher, "Chat unavailable", one console warning', async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on(
      'console',
      (m) =>
        m.type() === 'warning' &&
        m.text().includes('[byteflock]') &&
        warnings.push(m.text()),
    );
    await page.goto('/frame-blocked.html?key=wk_acme_demo');
    await expect(page.locator('script[data-widget-key]')).toHaveAttribute(
      'data-byteflock-chat',
      'unavailable',
      {
        timeout: 10_000,
      },
    );
    await expect(launcherButton(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(launcherButton(page)).toHaveAttribute(
      'title',
      'Chat unavailable',
    );
    await page.waitForTimeout(500);
    expect(warnings).toHaveLength(1);
  });

  const cases = [
    {
      name: 'config timeout',
      query: 'case=timeout',
      key: 'wk_slow',
      code: 'CONFIG_TIMEOUT',
    },
    {
      name: 'invalid theme JSON',
      query: 'case=json',
      key: 'wk_broken_json',
      code: 'THEME_INVALID',
    },
    {
      name: 'unsupported theme version',
      query: 'case=version',
      key: 'wk_broken_version',
      code: 'THEME_UNSUPPORTED_VERSION',
    },
    {
      name: 'missing config',
      query: 'case=missing',
      key: 'wk_missing',
      code: 'CONFIG_INVALID',
    },
  ];

  for (const c of cases) {
    test(`${c.name}: embedded defaults and a ${c.code} beacon`, async ({
      page,
      request,
    }) => {
      const since = Date.now();
      await page.goto(`/slow-config.html?${c.query}`);
      await waitReady(page);
      const frame = await widgetFrame(page, c.key);
      expect(await cssVar(frame, '--sem-color-primary')).toBe(DEFAULT_PRIMARY);
      await expect
        .poll(async () =>
          (await telemetrySince(request, since, c.key)).map((b) => b.code),
        )
        .toContain(c.code);
      const beacon = (await telemetrySince(request, since, c.key))[0];
      // ENDP-08: exactly these four keys, no visitor data or text.
      expect(Object.keys(beacon).sort()).toEqual([
        'code',
        'frameVersion',
        'ts',
        'widgetKey',
      ]);
    });
  }
});

// The assembled widget on a real host page (D-26, P2.1-T17). Storybook scans each element on its
// own; this scans the launcher on the host page and, once open, the conversation frame (a
// cross-origin iframe that axe enters through Playwright). Same bar as P2.1-AC16.
import { expect, test } from '@playwright/test';
import { scanA11y } from './a11y';
import { openWidget, waitReady, widgetFrame } from './helpers';

const serious = (violations: { id: string; impact?: string | null }[]) =>
  violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => v.id);

test('axe: no serious or critical issues on the host page, closed and open', async ({
  page,
}) => {
  await page.goto('/clean.html?key=wk_acme_demo');
  await waitReady(page);
  const closed = await scanA11y(page);
  expect(serious(closed.violations)).toEqual([]);

  await openWidget(page);
  const frame = await widgetFrame(page);
  // Rendered once the composer has focus (opening focuses it, PoC-A-AC05).
  await expect
    .poll(() =>
      frame.evaluate(() => {
        let el: Element | null = document.activeElement;
        while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
        return el?.tagName ?? '';
      }),
    )
    .toBe('TEXTAREA');
  const open = await scanA11y(page);
  expect(serious(open.violations)).toEqual([]);
});

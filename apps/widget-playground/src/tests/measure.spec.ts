// PoC-A-T11 measurements (@measure, not in the default run). Run against the BUILT widget:
//   pnpm nx run @byteflock/widget:build
//   pnpm exec vite preview --config apps/widget/vite.config.mts      (serves dist on 4400)
//   MEASURE=1 pnpm exec playwright test --project=chromium --grep @measure   (from apps/widget-playground)
// Profile: Chromium, CPU 4× slowdown, "Fast 3G" network. Median of 5 runs. Results are printed and
// copied into docs/architecture/baselines.md.
import { expect, test, type Page } from '@playwright/test';

const RUNS = 5;
const median = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  // Cold cache every run: the launcher and frame assets are immutable and would otherwise be cached.
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
}

/** Milliseconds from navigation start until the condition holds, measured in the page. */
const timeUntil = (page: Page, condition: string) =>
  page.evaluate(
    (cond) =>
      new Promise<number>((resolve) => {
        const check = () =>
          new Function(`return (${cond})`)()
            ? resolve(performance.now())
            : requestAnimationFrame(check);
        check();
      }),
    condition,
  );

const LAUNCHER_PAINTED =
  "!!document.querySelector('[data-byteflock-launcher]')?.shadowRoot?.querySelector('button.launcher')?.getBoundingClientRect().width";
const READY =
  "document.querySelector('script[data-widget-key]')?.getAttribute('data-byteflock-chat') === 'ready'";

test.describe('@measure PoC-A baselines', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Throttling uses the Chrome DevTools Protocol.',
  );
  test.setTimeout(240_000);

  test('@measure launcher first paint and frame ready, frame created at idle vs on open', async ({
    page,
    request,
  }) => {
    // Refuse to measure the dev server: it serves unbundled modules.
    const loader = await (
      await request.get('http://localhost:4400/v1/loader.js')
    ).text();
    expect(loader, 'run against `vite preview` of the built widget').toMatch(
      /\/v1\/launcher\.[a-f0-9]+\.js/,
    );

    const paint: number[] = [];
    const readyIdle: number[] = [];
    const readyOnOpen: number[] = [];

    for (let i = 0; i < RUNS; i++) {
      await throttle(page);
      await page.goto('/clean.html?key=wk_acme_demo', { waitUntil: 'commit' });
      paint.push(await timeUntil(page, LAUNCHER_PAINTED));
      readyIdle.push(await timeUntil(page, READY));
    }

    for (let i = 0; i < RUNS; i++) {
      await throttle(page);
      await page.goto('/clean.html?key=wk_acme_demo&frame=open', {
        waitUntil: 'commit',
      });
      await timeUntil(page, LAUNCHER_PAINTED);
      const clicked = await page.evaluate(() => {
        const button = document
          .querySelector('[data-byteflock-launcher]')
          ?.shadowRoot?.querySelector('button.launcher') as HTMLButtonElement;
        button.click();
        return performance.now();
      });
      readyOnOpen.push((await timeUntil(page, READY)) - clicked);
    }

    const result = {
      'launcher first paint (from navigation)': median(paint),
      'frame ready, created at idle (from navigation)': median(readyIdle),
      'frame ready, created on open (from click)': median(readyOnOpen),
    };
    console.log(`\nPoC-A measurements, median of ${RUNS} (ms):`);
    for (const [k, v] of Object.entries(result))
      console.log(`  ${k}: ${Math.round(v)}`);
    for (const v of Object.values(result)) expect(v).toBeGreaterThan(0);
  });
});

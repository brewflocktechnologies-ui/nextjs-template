// axe scans for the playground suite (D-26, P2.1-T17; same helper as apps/admin-dashboard-e2e/src/a11y.ts,
// since projects do not share test code). Every scan is attached to the test as
// `axe-results`, so the Playwright JSON report carries what was scanned and what axe found; the
// quality report's Accessibility section reads it. Assertions stay in the tests.
import AxeBuilder from '@axe-core/playwright';
import { test, type Page } from '@playwright/test';

/** What one scan found; the shape attached to the test and returned to it. */
export interface A11yScan {
  url: string;
  excluded: string[];
  passes: number;
  incomplete: number;
  violations: {
    id: string;
    impact: string | null;
    help: string;
    nodes: string[];
  }[];
}

export async function scanA11y(
  page: Page,
  options: { exclude?: string[] } = {},
): Promise<A11yScan> {
  let builder = new AxeBuilder({ page });
  for (const selector of options.exclude ?? [])
    builder = builder.exclude(selector);
  const results = await builder.analyze();
  const scan: A11yScan = {
    url: page.url(),
    excluded: options.exclude ?? [],
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      help: v.help,
      nodes: v.nodes.map((n) => n.target.map(String).join(' ')),
    })),
  };
  await test.info().attach('axe-results', {
    contentType: 'application/json',
    body: JSON.stringify(scan),
  });
  return scan;
}

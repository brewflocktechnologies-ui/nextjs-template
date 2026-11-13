// Vitest reporter for the Storybook story tests (D-26, P2.1-T17). @storybook/addon-vitest puts
// each story's axe run in the test's meta as a report of type "a11y"; this writes those results to
// <project>/test-output/reports/storybook/story-a11y.json for the quality report's Accessibility section.
// Only the violations and counts are kept; full axe results are large.
import fs from 'node:fs';
import path from 'node:path';

export default class StoryA11yReporter {
  onInit(vitest) {
    this.root = vitest.config.root;
  }

  onTestRunEnd(testModules) {
    const stories = [];
    for (const mod of testModules) {
      for (const test of mod.children.allTests()) {
        const meta = test.meta() ?? {};
        const a11y = (meta.reports ?? []).filter((r) => r.type === 'a11y');
        const result = a11y[0]?.result ?? {};
        stories.push({
          storyId: meta.storyId ?? test.fullName,
          file: path
            .relative(this.root, mod.moduleId)
            .split(path.sep)
            .join('/'),
          state: test.result().state,
          scanned: a11y.length > 0,
          status: a11y[0]?.status ?? null,
          passes: result.passes?.length ?? 0,
          incomplete: result.incomplete?.length ?? 0,
          violations: (result.violations ?? []).map((v) => ({
            id: v.id,
            impact: v.impact ?? null,
            help: v.help,
            nodes: v.nodes.map((n) => [].concat(n.target).join(' ')),
          })),
        });
      }
    }
    const out = path.join(
      this.root,
      'test-output',
      'reports',
      'storybook',
      'story-a11y.json',
    );
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ stories }, null, 2) + '\n');
  }
}

// Builds the quality report (SPECS/DECISIONS.md D-26) from one or more run folders written by
// `pnpm verify`. CI merges the folders of all its jobs into one report.
//
//   node tools/scripts/report.mjs [runDir ...] [--out=<file>] [--summary]
//
// runDir defaults to reports/. --out defaults to <first runDir>/quality-report.md. --summary also
// appends the report to $GITHUB_STEP_SUMMARY. The report is Markdown so it reads the same in an
// editor, on GitHub and as plain text.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dirs = args.filter((a) => !a.startsWith('--'));
if (!dirs.length) dirs.push('reports');
const out =
  args.find((a) => a.startsWith('--out='))?.slice(6) ??
  path.join(dirs[0], 'quality-report.md');

// ---------------------------------------------------------------- reading

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};
const ls = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []);
// eslint-disable-next-line no-control-regex
const stripAnsi = (s = '') => s.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '');
const firstLines = (s, n) =>
  stripAnsi(s).trim().split('\n').slice(0, n).join('\n');
const lastLines = (s, n) =>
  stripAnsi(s).trimEnd().split('\n').slice(-n).join('\n');
const cell = (s) =>
  String(s ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const runs = [];
// A folder without run.json is a job that stopped before verify wrote its results (or never ran):
// the report names it and fails.
const missing = [];
for (const dir of dirs) {
  const run = readJson(path.join(dir, 'run.json'));
  if (!run) {
    console.error(`report: ${dir} has no run.json`);
    missing.push(dir);
    continue;
  }
  const projects = {};
  const projectsDir = path.join(dir, 'details', 'projects');
  for (const slug of ls(projectsDir)) {
    const name =
      Object.entries(run.projects ?? {}).find(([, s]) => s === slug)?.[0] ??
      slug;
    const p = (sub, file) => readJson(path.join(projectsDir, slug, sub, file));
    projects[name] = {
      eslint: p('lint', 'eslint.json'),
      vitest: p('test', 'vitest.json'),
      jest: p('test', 'jest.json'),
      storybook: p('storybook', 'vitest.json'),
      storyA11y: p('storybook', 'story-a11y.json'),
      playwright: p('e2e', 'playwright.json'),
      budgets: p('build', 'budgets.json'),
    };
  }
  const lhDir = path.join(dir, 'details', 'lighthouse');
  runs.push({
    dir,
    ...run,
    projects,
    policy: readJson(path.join(dir, 'details', 'policy.json')),
    testCount: readJson(path.join(dir, 'details', 'test-count.json')),
    lighthouse: {
      assertions: readJson(path.join(lhDir, 'assertion-results.json')),
      lhrs: ls(lhDir)
        .filter((f) => /^lhr-.*\.json$/.test(f))
        .map((f) => readJson(path.join(lhDir, f)))
        .filter(Boolean),
    },
    log: (step) => {
      try {
        return fs.readFileSync(path.join(dir, step.log), 'utf8');
      } catch {
        return '';
      }
    },
  });
}
if (!runs.length && !missing.length) {
  console.error('report: no runs to report');
  process.exit(1);
}
const multi = runs.length + missing.length > 1;

// ---------------------------------------------------------------- shaping

/** Playwright JSON → flat list of tests with their attachments. */
function playwrightTests(report) {
  const outList = [];
  const walk = (suite, trail) => {
    const here = suite.title ? [...trail, suite.title] : trail;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.at(-1);
        outList.push({
          title: [...here, spec.title].filter(Boolean).join(' › '),
          file: spec.file,
          project: t.projectName,
          status: t.status,
          error: last?.error?.message ?? last?.errors?.[0]?.message ?? '',
          attachments: (t.results ?? []).flatMap((r) => r.attachments ?? []),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const s of report?.suites ?? []) walk(s, []);
  return outList;
}

const axeScans = (tests) =>
  tests.flatMap((t) =>
    t.attachments
      .filter((a) => a.name === 'axe-results' && a.body)
      .map((a) => {
        try {
          return {
            test: t.title,
            ...JSON.parse(Buffer.from(a.body, 'base64').toString('utf8')),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean),
  );

/** Vitest or Jest JSON → counts and failures. */
function unitSummary(report) {
  const tests = (report?.testResults ?? []).flatMap((f) =>
    (f.assertionResults ?? []).map((a) => ({ ...a, file: f.name })),
  );
  const fileErrors = (report?.testResults ?? []).filter(
    (f) => f.status === 'failed' && !(f.assertionResults ?? []).length,
  );
  return {
    total: report?.numTotalTests ?? tests.length,
    passed:
      report?.numPassedTests ??
      tests.filter((t) => t.status === 'passed').length,
    failed:
      report?.numFailedTests ??
      tests.filter((t) => t.status === 'failed').length,
    skipped:
      report?.numPendingTests ??
      tests.filter((t) => ['pending', 'skipped', 'todo'].includes(t.status))
        .length,
    failures: [
      ...tests.filter((t) => t.status === 'failed'),
      ...fileErrors.map((f) => ({
        fullName: `${f.name} (file failed)`,
        failureMessages: [f.message],
      })),
    ],
    tests,
  };
}

const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];
const byImpact = (violations) => {
  const counts = Object.fromEntries(IMPACTS.map((i) => [i, 0]));
  for (const v of violations)
    counts[v.impact ?? 'minor'] = (counts[v.impact ?? 'minor'] ?? 0) + 1;
  return IMPACTS.map((i) => counts[i]).join(' / ');
};

const stepSummary = {};
const note = (run, id, text) => {
  stepSummary[`${run.dir}:${id}`] = text;
};

// ---------------------------------------------------------------- writing

const md = [];
const allSteps = runs.flatMap((r) => r.steps.map((s) => ({ run: r, ...s })));
const failedSteps = allSteps.filter((s) => s.status === 'FAIL');
const overall = failedSteps.length || missing.length ? 'FAIL' : 'PASS';

md.push('# Quality report', '');
md.push(
  `**Result: ${overall === 'PASS' ? 'PASS ✅' : 'FAIL ❌'}** · ${plural(allSteps.length, 'gate')} run, ${failedSteps.length} failed` +
    (multi ? ` · ${plural(runs.length, 'job')}` : '') +
    (missing.length
      ? ` · **${plural(missing.length, 'job')} without results**`
      : ''),
  '',
);
md.push('| Run | Commit | Branch | Platform | Started | Finished |');
md.push('| --- | --- | --- | --- | --- | --- |');
for (const r of runs) {
  md.push(
    `| ${cell(r.label)}${r.ci ? ` ([CI](${r.ci}))` : ''} | ${r.commit}${r.dirty ? ' (uncommitted changes)' : ''} | ${cell(r.branch)} | ${cell(`${r.platform}, Node ${r.node}`)} | ${r.startedAt} | ${r.finishedAt} |`,
  );
}
for (const dir of missing)
  md.push(
    `| ${cell(path.basename(dir))} | **no results**: the job stopped before \`pnpm verify\` wrote them, or did not run | | | | |`,
  );
if (runs.some((r) => r.affected))
  md.push(
    '',
    `Affected projects only: ${runs
      .filter((r) => r.affected)
      .map((r) => `${r.label} against ${r.affected.base}`)
      .join('; ')}.`,
  );
md.push('');

// Details are built first so the gate table can quote a one-line summary for each step.
const details = [];

// Policy
const policyRuns = runs.filter((r) => r.policy);
if (policyRuns.length) {
  details.push('### Policy checks', '');
  for (const r of policyRuns) {
    const checks = r.policy.checks;
    const bad = checks.filter((c) => c.status !== 'pass');
    note(
      r,
      'policy',
      `${checks.length - bad.length}/${checks.length} checks pass`,
    );
    if (multi) details.push(`**${r.label}**`, '');
    details.push(
      '| Check | Result | Seconds | Says |',
      '| --- | --- | --- | --- |',
    );
    for (const c of checks)
      details.push(
        `| ${c.check} | ${c.status} | ${c.seconds} | ${cell(firstLines(c.output, 1)).slice(0, 160)} |`,
      );
    details.push('');
    for (const c of bad)
      details.push(
        `<details><summary>${c.check} output</summary>`,
        '',
        '```text',
        firstLines(c.output, 40),
        '```',
        '',
        '</details>',
        '',
      );
  }
}

// Lint
const lintRows = runs.flatMap((r) =>
  Object.entries(r.projects)
    .filter(([, p]) => p.eslint)
    .map(([name, p]) => ({ run: r, name, ...p.eslint })),
);
if (lintRows.length) {
  details.push('### Lint', '');
  details.push(
    `| ${multi ? 'Run | ' : ''}Project | Files | Errors | Warnings |`,
    `| ${multi ? '--- | ' : ''}--- | --- | --- | --- |`,
  );
  for (const l of lintRows)
    details.push(
      `| ${multi ? `${cell(l.run.label)} | ` : ''}${l.name} | ${l.filesLinted} | ${l.errors} | ${l.warnings} |`,
    );
  details.push('');
  const errors = lintRows.flatMap((l) =>
    l.files.flatMap((f) =>
      f.messages
        .filter((m) => m.severity === 'error')
        .map((m) => ({ project: l.name, file: f.file, ...m })),
    ),
  );
  if (errors.length) {
    details.push(
      '| Project | File:line | Rule | Message |',
      '| --- | --- | --- | --- |',
    );
    for (const e of errors.slice(0, 100))
      details.push(
        `| ${e.project} | ${cell(`${e.file}:${e.line}`)} | ${e.ruleId ?? ''} | ${cell(e.message)} |`,
      );
    if (errors.length > 100)
      details.push('', `…and ${errors.length - 100} more errors.`);
    details.push('');
  }
  for (const r of runs) {
    const mine = lintRows.filter((l) => l.run === r);
    if (mine.length)
      note(
        r,
        'ltb',
        `lint: ${plural(
          mine.reduce((n, l) => n + l.errors, 0),
          'error',
        )}, ${plural(
          mine.reduce((n, l) => n + l.warnings, 0),
          'warning',
        )}`,
      );
  }
}

// Unit tests
const unitRows = runs.flatMap((r) =>
  Object.entries(r.projects).flatMap(([name, p]) => [
    ...(p.vitest
      ? [{ run: r, name, runner: 'Vitest', ...unitSummary(p.vitest) }]
      : []),
    ...(p.jest
      ? [{ run: r, name, runner: 'Jest', ...unitSummary(p.jest) }]
      : []),
  ]),
);
if (unitRows.length) {
  details.push('### Unit tests', '');
  details.push(
    `| ${multi ? 'Run | ' : ''}Project | Runner | Tests | Passed | Failed | Skipped |`,
    `| ${multi ? '--- | ' : ''}--- | --- | --- | --- | --- | --- |`,
  );
  for (const u of unitRows)
    details.push(
      `| ${multi ? `${cell(u.run.label)} | ` : ''}${u.name} | ${u.runner} | ${u.total} | ${u.passed} | ${u.failed} | ${u.skipped} |`,
    );
  details.push('');
  for (const u of unitRows)
    for (const f of u.failures.slice(0, 20))
      details.push(
        `<details><summary>❌ ${cell(u.name)}: ${cell(f.fullName)}</summary>`,
        '',
        '```text',
        firstLines((f.failureMessages ?? []).join('\n'), 30),
        '```',
        '',
        '</details>',
        '',
      );
  for (const r of runs) {
    const mine = unitRows.filter((u) => u.run === r);
    if (mine.length) {
      const total = mine.reduce((n, u) => n + u.total, 0);
      const failed = mine.reduce((n, u) => n + u.failed, 0);
      const prev = stepSummary[`${r.dir}:ltb`];
      note(
        r,
        'ltb',
        `${prev ? `${prev}; ` : ''}unit: ${total} tests, ${failed} failed`,
      );
    }
  }
}

// Storybook
const storyRows = runs.flatMap((r) =>
  Object.entries(r.projects)
    .filter(([, p]) => p.storybook)
    .map(([name, p]) => ({ run: r, name, ...unitSummary(p.storybook) })),
);
if (storyRows.length) {
  details.push('### Storybook story tests', '');
  details.push(
    `| ${multi ? 'Run | ' : ''}Project | Stories | Passed | Failed | Skipped |`,
    `| ${multi ? '--- | ' : ''}--- | --- | --- | --- | --- |`,
  );
  for (const s of storyRows)
    details.push(
      `| ${multi ? `${cell(s.run.label)} | ` : ''}${s.name} | ${s.total} | ${s.passed} | ${s.failed} | ${s.skipped} |`,
    );
  details.push('');
  for (const s of storyRows)
    for (const f of s.failures.slice(0, 20))
      details.push(
        `<details><summary>❌ ${cell(s.name)}: ${cell(f.fullName)}</summary>`,
        '',
        '```text',
        firstLines((f.failureMessages ?? []).join('\n'), 30),
        '```',
        '',
        '</details>',
        '',
      );
  for (const r of runs) {
    const mine = storyRows.filter((s) => s.run === r);
    if (mine.length)
      note(
        r,
        'storybook',
        `${mine.reduce((n, s) => n + s.total, 0)} stories, ${mine.reduce((n, s) => n + s.failed, 0)} failed`,
      );
  }
}

// End-to-end
const e2eRows = runs.flatMap((r) =>
  Object.entries(r.projects)
    .filter(([, p]) => p.playwright)
    .map(([name, p]) => ({
      run: r,
      name,
      tests: playwrightTests(p.playwright),
      stats: p.playwright.stats ?? {},
    })),
);
if (e2eRows.length) {
  details.push('### End-to-end', '');
  details.push(
    `| ${multi ? 'Run | ' : ''}Project | Browser | Passed | Failed | Flaky | Skipped | Seconds |`,
    `| ${multi ? '--- | ' : ''}--- | --- | --- | --- | --- | --- | --- |`,
  );
  for (const e of e2eRows) {
    const browsers = [...new Set(e.tests.map((t) => t.project))].join(', ');
    details.push(
      `| ${multi ? `${cell(e.run.label)} | ` : ''}${e.name} | ${browsers} | ${e.stats.expected ?? 0} | ${e.stats.unexpected ?? 0} | ${e.stats.flaky ?? 0} | ${e.stats.skipped ?? 0} | ${Math.round((e.stats.duration ?? 0) / 1000)} |`,
    );
  }
  details.push('');
  for (const e of e2eRows)
    for (const t of e.tests
      .filter((x) => x.status === 'unexpected' || x.status === 'flaky')
      .slice(0, 30))
      details.push(
        `<details><summary>${t.status === 'flaky' ? '⚠️ flaky' : '❌'} ${cell(e.name)} [${t.project}]: ${cell(t.title)}</summary>`,
        '',
        `\`${t.file}\``,
        '',
        '```text',
        firstLines(t.error, 30),
        '```',
        '',
        '</details>',
        '',
      );
  for (const r of runs) {
    const mine = e2eRows.filter((e) => e.run === r);
    if (!mine.length) continue;
    const sum = (k) => mine.reduce((n, e) => n + (e.stats[k] ?? 0), 0);
    const text = `${sum('expected')} passed, ${sum('unexpected')} failed, ${sum('flaky')} flaky`;
    for (const id of ['e2e', 'smoke', 'visual', 'measure']) note(r, id, text);
  }
}

// Bundle budgets
const budgetRuns = runs.flatMap((r) =>
  Object.entries(r.projects)
    .filter(([, p]) => p.budgets)
    .map(([name, p]) => ({ run: r, name, ...p.budgets })),
);
if (budgetRuns.length) {
  details.push('### Widget bundle budgets (gzip bytes)', '');
  for (const b of budgetRuns) {
    if (multi) details.push(`**${b.run.label}**`, '');
    details.push(
      '| Bundle | Raw | Gzip | Brotli | Budget | Headroom |',
      '| --- | --- | --- | --- | --- | --- |',
    );
    for (const [name, s] of Object.entries(b.sizes)) {
      const head =
        s.budget == null
          ? 'no budget'
          : `${s.budget - s.gzip} B (${Math.round(((s.budget - s.gzip) / s.budget) * 100)}%)`;
      details.push(
        `| ${name} | ${s.raw} | ${s.gzip} | ${s.brotli} | ${s.budget ?? '—'} | ${s.gzip > (s.budget ?? Infinity) ? `**over by ${s.gzip - s.budget} B**` : head} |`,
      );
    }
    details.push('');
    if (b.problems.length)
      details.push(
        'Bundle assertions failed:',
        '',
        ...b.problems.map((p) => `- ${p}`),
        '',
      );
    note(
      b.run,
      'widget-build',
      b.problems.length
        ? `${plural(b.problems.length, 'problem')}`
        : 'all bundles within budget',
    );
  }
}

// Test count
for (const r of runs.filter((x) => x.testCount)) {
  const t = r.testCount;
  details.push('### Test count', '');
  if (multi) details.push(`**${r.label}**`, '');
  details.push(
    `Total **${t.total}** against a recorded floor of ${t.recorded}.`,
    '',
  );
  details.push(
    '| Runner and project | Now | Recorded |',
    '| --- | --- | --- |',
  );
  for (const [k, n] of Object.entries(t.counts)) {
    const was = t.floor?.[k];
    details.push(
      `| ${k} | ${n} | ${was ?? '—'}${was != null && n < was ? ' **(lower)**' : ''} |`,
    );
  }
  details.push('');
}

// Lighthouse
const lhRuns = runs.filter((r) => r.lighthouse.lhrs.length);
if (lhRuns.length) {
  details.push('### Lighthouse', '');
  details.push(
    '| Run | URL | Performance | Accessibility | Best practices | LCP ms | TBT ms |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const r of lhRuns) {
    for (const lhr of r.lighthouse.lhrs) {
      const score = (k) =>
        lhr.categories?.[k]?.score == null
          ? '—'
          : Math.round(lhr.categories[k].score * 100);
      const ms = (k) => Math.round(lhr.audits?.[k]?.numericValue ?? 0);
      details.push(
        `| ${cell(r.label)} | ${cell(lhr.finalDisplayedUrl ?? lhr.finalUrl)} | ${score('performance')} | ${score('accessibility')} | ${score('best-practices')} | ${ms('largest-contentful-paint')} | ${ms('total-blocking-time')} |`,
      );
    }
    const failedAssertions = (r.lighthouse.assertions ?? []).filter(
      (a) => !a.passed,
    );
    if (failedAssertions.length) {
      details.push('', 'Assertions not met:', '');
      for (const a of failedAssertions)
        details.push(
          `- ${a.level}: ${a.auditId ?? a.name} ${a.operator ?? ''} ${a.expected ?? ''} (actual ${a.actual ?? '?'})`,
        );
    }
    details.push('');
    note(
      r,
      'lighthouse',
      `${r.lighthouse.lhrs.length} runs; accessibility ${r.lighthouse.lhrs.map((l) => Math.round((l.categories?.accessibility?.score ?? 0) * 100)).join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------- accessibility

const a11y = [];
const lintA11y = lintRows.flatMap((l) =>
  l.files.flatMap((f) =>
    f.messages
      .filter((m) => (m.ruleId ?? '').startsWith('jsx-a11y/'))
      .map((m) => ({ project: l.name, file: f.file, ...m })),
  ),
);
const stories = runs.flatMap((r) =>
  Object.entries(r.projects).flatMap(([name, p]) =>
    (p.storyA11y?.stories ?? []).map((s) => ({ run: r, project: name, ...s })),
  ),
);
const storyViolations = stories.flatMap((s) =>
  s.violations.map((v) => ({
    where: `story ${s.storyId}`,
    project: s.project,
    ...v,
  })),
);
const scans = e2eRows.flatMap((e) =>
  axeScans(e.tests).map((s) => ({ run: e.run, project: e.name, ...s })),
);
const scanViolations = scans.flatMap((s) =>
  s.violations.map((v) => ({
    where: `${s.url}${s.excluded?.length ? ` (excluding ${s.excluded.join(', ')})` : ''}`,
    project: s.project,
    ...v,
  })),
);
const contrast = unitRows
  .filter((u) => u.name === '@byteflock/theme')
  .flatMap((u) => u.tests.filter((t) => /contrast/i.test(t.fullName ?? '')));
const lhA11y = lhRuns
  .flatMap((r) =>
    r.lighthouse.lhrs.map((l) => l.categories?.accessibility?.score),
  )
  .filter((s) => s != null);

const any =
  lintRows.length ||
  stories.length ||
  scans.length ||
  contrast.length ||
  lhA11y.length;
if (any) {
  a11y.push('## Accessibility', '');
  a11y.push(
    '| Source | Scanned | Findings (critical / serious / moderate / minor) | Fails the gate on |',
    '| --- | --- | --- | --- |',
  );
  if (lintRows.length)
    a11y.push(
      `| Lint (\`jsx-a11y\`) | ${lintRows.filter((l) => l.files !== undefined).reduce((n, l) => n + l.filesLinted, 0)} files | ${plural(lintA11y.filter((m) => m.severity === 'error').length, 'error')}, ${plural(lintA11y.filter((m) => m.severity === 'warning').length, 'warning')} | errors only (the rules are warnings today) |`,
    );
  if (stories.length)
    a11y.push(
      `| Storybook + axe | ${stories.filter((s) => s.scanned).length} of ${stories.length} stories | ${byImpact(storyViolations)} | any violation (\`a11y: { test: 'error' }\`) |`,
    );
  if (scans.length)
    a11y.push(
      `| End-to-end + axe | ${plural(scans.length, 'page scan')} on ${new Set(scans.map((s) => s.url.replace(/\?.*$/, ''))).size} pages | ${byImpact(scanViolations)} | serious or critical (most tests); any (P1.6-AC12 chrome) |`,
    );
  if (contrast.length)
    a11y.push(
      `| Theme contrast tests | ${plural(contrast.length, 'test')} | ${contrast.filter((t) => t.status === 'failed').length} failed | any failure |`,
    );
  if (lhA11y.length)
    a11y.push(
      `| Lighthouse | ${plural(lhA11y.length, 'run')} | score ${lhA11y.map((s) => Math.round(s * 100)).join(', ')} (minimum 95) | warns only for now |`,
    );
  a11y.push('');

  const violations = [...storyViolations, ...scanViolations];
  if (violations.length) {
    a11y.push('### Violations by rule', '');
    a11y.push(
      '| Rule | Impact | Where | Elements | Help |',
      '| --- | --- | --- | --- | --- |',
    );
    const order = (v) => IMPACTS.indexOf(v.impact ?? 'minor');
    for (const v of [...violations]
      .sort((a, b) => order(a) - order(b) || a.id.localeCompare(b.id))
      .slice(0, 150))
      a11y.push(
        `| \`${v.id}\` | ${v.impact ?? '—'} | ${cell(`${v.project}: ${v.where}`)} | ${cell(v.nodes.slice(0, 3).join(', '))}${v.nodes.length > 3 ? ` (+${v.nodes.length - 3})` : ''} | ${cell(v.help)} |`,
      );
    if (violations.length > 150)
      a11y.push('', `…and ${violations.length - 150} more.`);
    a11y.push('');
  } else if (stories.length || scans.length) {
    a11y.push('axe found no violations in any scanned story or page.', '');
  }
  if (lintA11y.length) {
    a11y.push('### Lint accessibility findings', '');
    a11y.push(
      '| Project | File:line | Rule | Severity | Message |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const m of lintA11y.slice(0, 100))
      a11y.push(
        `| ${m.project} | ${cell(`${m.file}:${m.line}`)} | ${m.ruleId} | ${m.severity} | ${cell(m.message)} |`,
      );
    a11y.push('');
  }
  if (scans.length) {
    a11y.push('<details><summary>Every end-to-end axe scan</summary>', '');
    a11y.push(
      '| Project | Test | URL | Passed rules | Needs review | Violations |',
      '| --- | --- | --- | --- | --- | --- |',
    );
    for (const s of scans)
      a11y.push(
        `| ${s.project} | ${cell(s.test)} | ${cell(s.url)} | ${s.passes} | ${s.incomplete} | ${s.violations.length} |`,
      );
    a11y.push('', '</details>', '');
  }
}

// ---------------------------------------------------------------- gate table and assembly

md.push('## Gates', '');
md.push(
  `| ${multi ? 'Run | ' : ''}Gate | Result | Seconds | Summary |`,
  `| ${multi ? '--- | ' : ''}--- | --- | --- | --- |`,
);
for (const s of allSteps)
  md.push(
    `| ${multi ? `${cell(s.run.label)} | ` : ''}${cell(s.name)} | ${s.status === 'pass' ? 'pass' : '**FAIL**'} | ${s.seconds} | ${cell(stepSummary[`${s.run.dir}:${s.id}`] ?? '')} |`,
  );
md.push('');

if (failedSteps.length) {
  md.push('## Failures', '');
  for (const s of failedSteps) {
    md.push(
      `### ${s.name}${multi ? ` (${s.run.label})` : ''}`,
      '',
      `\`${s.cmd}\``,
      '',
      'Last lines of output:',
      '',
      '```text',
      lastLines(s.run.log(s), 40),
      '```',
      '',
    );
  }
}

md.push(...a11y);
if (details.length) md.push('## Details', '', ...details);
md.push(
  '---',
  '',
  `Generated by \`tools/scripts/report.mjs\` from ${dirs.map((d) => `\`${path.relative(process.cwd(), d) || '.'}\``).join(', ')} (D-26). Full step logs are in each run's \`logs/\` folder.`,
  '',
);

const text = md.join('\n');
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, text);
console.log(`report: wrote ${out} (${overall})`);
if (args.includes('--summary') && process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');

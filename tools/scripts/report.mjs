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
      routeBudgets: p('budgets', 'routes.json'),
      coverage: p(path.join('test', 'coverage'), 'coverage-summary.json'),
    };
  }
  const lhDir = path.join(dir, 'details', 'lighthouse');
  runs.push({
    dir,
    ...run,
    projects,
    policy: readJson(path.join(dir, 'details', 'policy.json')),
    testCount: readJson(path.join(dir, 'details', 'test-count.json')),
    audit: readJson(path.join(dir, 'details', 'audit.json')),
    dbSafety: readJson(path.join(dir, 'details', 'db-safety.json')),
    coverageFloor: readJson(path.join(dir, 'details', 'coverage-floor.json')),
    secrets: readJson(path.join(dir, 'details', 'secrets.json')),
    unused: readJson(path.join(dir, 'details', 'unused.json')),
    // D-28: the metrics of the run this folder held before (kept by verify.mjs and visual.mjs).
    previous: readJson(path.join(dir, 'previous-metrics.json')),
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

// Dashboard route budgets (D-29)
const routeRuns = runs.flatMap((r) =>
  Object.entries(r.projects)
    .filter(([, p]) => p.routeBudgets)
    .map(([name, p]) => ({ run: r, name, ...p.routeBudgets })),
);
for (const b of routeRuns) {
  details.push('### Dashboard route budgets (first-load JS, gzip bytes)', '');
  if (multi) details.push(`**${b.run.label}**`, '');
  details.push(
    '| Route | Raw | Gzip | Budget | Headroom |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const [route, s] of Object.entries(b.sizes)) {
    const head =
      s.budget == null
        ? 'no budget'
        : s.gzip > s.budget
          ? `**over by ${s.gzip - s.budget} B**`
          : `${s.budget - s.gzip} B (${Math.round(((s.budget - s.gzip) / s.budget) * 100)}%)`;
    details.push(
      `| ${cell(route)} | ${s.raw} | ${s.gzip} | ${s.budget ?? '—'} | ${head} |`,
    );
  }
  details.push('');
  if (b.problems.length)
    details.push(
      'Route budget problems:',
      '',
      ...b.problems.map((p) => `- ${p}`),
      '',
    );
  const prev = stepSummary[`${b.run.dir}:ltb`];
  note(
    b.run,
    'ltb',
    `${prev ? `${prev}; ` : ''}routes: ${b.problems.length ? `${plural(b.problems.length, 'problem')}` : 'within budget'}`,
  );
}

// Unused code and dependencies (D-29)
const UNUSED_FAIL = [
  'files',
  'dependencies',
  'devDependencies',
  'optionalPeerDependencies',
  'unlisted',
  'binaries',
  'unresolved',
];
const UNUSED_WARN = [
  'exports',
  'types',
  'nsExports',
  'nsTypes',
  'enumMembers',
  'duplicates',
];
function unusedOf(r) {
  const by = {};
  for (const issue of r.unused?.result?.issues ?? [])
    for (const kind of [...UNUSED_FAIL, ...UNUSED_WARN])
      for (const item of issue[kind] ?? [])
        (by[kind] ??= []).push({
          file: issue.file,
          name: item.name ?? issue.file,
          line: item.line,
        });
  return by;
}
for (const r of runs.filter((x) => x.unused)) {
  const by = unusedOf(r);
  const failing = UNUSED_FAIL.reduce((n, k) => n + (by[k]?.length ?? 0), 0);
  const warning = UNUSED_WARN.reduce((n, k) => n + (by[k]?.length ?? 0), 0);
  note(
    r,
    'unused',
    `${plural(failing, 'failing finding')}, ${plural(warning, 'warning')}`,
  );
  details.push('### Unused code and dependencies (knip)', '');
  if (multi) details.push(`**${r.label}**`, '');
  if (!r.unused.result) {
    details.push(
      'knip did not produce a readable result; see the step log.',
      '',
    );
    continue;
  }
  details.push('| Kind | Count | Fails the gate |', '| --- | --- | --- |');
  for (const k of [...UNUSED_FAIL, ...UNUSED_WARN])
    if (by[k]?.length)
      details.push(
        `| ${k} | ${by[k].length} | ${UNUSED_FAIL.includes(k) ? 'yes' : 'no (warning)'} |`,
      );
  if (!failing && !warning) details.push('| (none) | 0 | |');
  details.push('');
  const listed = [...UNUSED_FAIL, ...UNUSED_WARN].flatMap((k) =>
    (by[k] ?? []).map((x) => ({ kind: k, ...x })),
  );
  if (listed.length) {
    details.push(
      '<details><summary>Every finding</summary>',
      '',
      '| Kind | File | Name |',
      '| --- | --- | --- |',
    );
    for (const x of listed.slice(0, 200))
      details.push(
        `| ${x.kind} | ${cell(x.file)}${x.line ? `:${x.line}` : ''} | ${cell(x.name)} |`,
      );
    details.push('', '</details>', '');
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
  if (lintRows.length) {
    // D-29: only JSX files in projects where the jsx-a11y rules are on count as checked.
    const withJsx = lintRows.filter((l) => l.jsxFiles > 0);
    const checked = withJsx.filter((l) => l.jsxA11yRules > 0);
    const unchecked = withJsx.filter((l) => !l.jsxA11yRules);
    a11y.push(
      `| Lint (\`jsx-a11y\`) | ${checked.reduce((n, l) => n + l.jsxFiles, 0)} JSX files in ${checked.map((l) => l.name).join(', ') || 'no project'}${unchecked.length ? `; **not checked:** ${unchecked.map((l) => `${l.name} (${l.jsxFiles})`).join(', ')}` : ''} | ${plural(lintA11y.filter((m) => m.severity === 'error').length, 'error')}, ${plural(lintA11y.filter((m) => m.severity === 'warning').length, 'warning')} | any finding (rules are errors, D-29) |`,
    );
  }
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
// D-28: the trend against the previous run goes here; it needs every section's numbers first.
const trendAt = md.length;

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

// ---------------------------------------------------------------- security and data safety (D-27)

const security = [];
const auditRuns = runs.filter((r) => r.audit);
if (auditRuns.length) {
  security.push('### Dependency audit', '');
  for (const r of auditRuns) {
    if (multi) security.push(`**${r.label}**`, '');
    if (r.audit.skipped) {
      security.push(`Skipped: ${r.audit.skipped}.`, '');
      continue;
    }
    const c = r.audit.counts;
    security.push(
      '| Scope | Critical | High | Moderate | Low |',
      '| --- | --- | --- | --- | --- |',
    );
    security.push(
      `| Production dependencies | ${c.production.critical} | ${c.production.high} | ${c.production.moderate} | ${c.production.low} |`,
    );
    security.push(
      `| All dependencies (dev tooling included) | ${c.all.critical} | ${c.all.high} | ${c.all.moderate} | ${c.all.low} |`,
      '',
    );
    security.push(
      `Checked on ${r.audit.checkedOn}. High and critical advisories fail the gate in production dependencies always, and in dev tooling unless excused in \`tools/audit-exceptions.json\`; moderate and low are shown only.`,
      '',
    );
    if (r.audit.excused?.length) {
      security.push('Excused (dev tooling, each with an expiry date):', '');
      security.push(
        '| Advisory | Package | Severity | Expires | Fixed in | Reason |',
        '| --- | --- | --- | --- | --- | --- |',
      );
      for (const e of r.audit.excused)
        security.push(
          `| ${e.id} | ${e.package} | ${e.severity} | ${e.expires} | ${cell(e.fixedIn ?? 'no release')} | ${cell(e.reason).slice(0, 140)}… |`,
        );
      security.push('');
    }
    if (r.audit.failures?.length)
      security.push(
        'Failing:',
        '',
        ...r.audit.failures.map((f) => `- ${f}`),
        '',
      );
  }
}

const dbRuns = runs.filter((r) => r.dbSafety);
if (dbRuns.length) {
  security.push('### Database safety (tenant isolation)', '');
  for (const r of dbRuns) {
    const d = r.dbSafety;
    if (multi) security.push(`**${r.label}**`, '');
    const yes = (b) => (b ? 'yes' : 'no');
    security.push(
      `Application role \`${d.appRole}\`: ${d.failures.length ? '**problems found**' : 'not a superuser, no BYPASSRLS, owns nothing, cannot truncate'}.`,
      '',
    );
    security.push(
      '| Table | Kind | RLS enabled | RLS forced | Policies | App can read | App can write |',
      '| --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const t of d.tables)
      security.push(
        `| ${t.table} | ${t.kind} | ${t.kind === 'tenant' ? yes(t.rls) : '—'} | ${t.kind === 'tenant' ? yes(t.forced) : '—'} | ${t.policies} | ${yes(t.appRead)} | ${yes(t.appWrite)} |`,
      );
    security.push('');
    if (d.failures.length)
      security.push('Failing:', '', ...d.failures.map((f) => `- ${f}`), '');
  }
}
for (const r of runs.filter((x) => x.secrets)) {
  security.push('### Secret scan', '');
  if (multi) security.push(`**${r.label}**`, '');
  security.push(
    `${r.secrets.filesScanned} files scanned (tracked and new, not git history): ${r.secrets.findings.length ? `**${plural(r.secrets.findings.length, 'finding')}**` : 'no secrets found'}.`,
    '',
  );
  if (r.secrets.findings.length) {
    security.push('| File | Line | Rule |', '| --- | --- | --- |');
    for (const f of r.secrets.findings)
      security.push(`| ${cell(f.file)} | ${f.line || '—'} | ${f.rule} |`);
    security.push('');
  }
}
if (security.length) md.push('## Security and data safety', '', ...security);

// ---------------------------------------------------------------- coverage (D-27)

// A floor is keyed by folder (libs/theme), a project by package name (@byteflock/theme): they match
// on the last segment.
const floorFor = (run, projectName) => {
  const floors = run.coverageFloor?.floors ?? {};
  const key = Object.keys(floors).find(
    (k) => k.split('/').pop() === projectName.split('/').pop(),
  );
  return key ? floors[key] : undefined;
};
const coverageRows = runs.flatMap((r) =>
  Object.entries(r.projects)
    .filter(([, p]) => p.coverage?.total)
    .map(([name, p]) => ({
      run: r,
      name,
      total: p.coverage.total,
      floor: floorFor(r, name),
    })),
);
if (coverageRows.length) {
  md.push('## Coverage', '');
  md.push(
    `| ${multi ? 'Run | ' : ''}Project | Lines | Statements | Functions | Branches |`,
    `| ${multi ? '--- | ' : ''}--- | --- | --- | --- | --- |`,
  );
  const show = (row, m) => {
    const t = row.total[m];
    const pct = t.total === 0 ? 'n/a' : `${t.pct}%`;
    return row.floor ? `${pct} (floor ${row.floor[m]}%)` : pct;
  };
  for (const row of coverageRows)
    md.push(
      `| ${multi ? `${cell(row.run.label)} | ` : ''}${row.name} | ${show(row, 'lines')} | ${show(row, 'statements')} | ${show(row, 'functions')} | ${show(row, 'branches')} |`,
    );
  md.push('');
  md.push(
    'Unit-test coverage only (V8; Vitest and Jest). Storybook stories and end-to-end tests are not counted, so the figure is a lower bound for the widget and the UI libraries, whose behaviour is mostly tested there. The test run fails below a floor; floors only go up (`tools/coverage-floor.json`, `COVERAGE-LOWERED:` to lower one).',
    '',
  );
  for (const r of runs.filter((x) => x.coverageFloor?.lowered?.length))
    md.push(
      `Floors lowered in ${r.label}: ${r.coverageFloor.lowered.join('; ')}.`,
      '',
    );
}
if (details.length) md.push('## Details', '', ...details);
md.push(
  '---',
  '',
  `Generated by \`tools/scripts/report.mjs\` from ${dirs.map((d) => `\`${path.relative(process.cwd(), d) || '.'}\``).join(', ')} (D-26). Full step logs are in each run's \`logs/\` folder.`,
  '',
);

// ---------------------------------------------------------------- metrics and trend (D-28)

// One flat set of numbers per run. `better` says which direction is an improvement; durations are
// shown but not judged. Saved as metrics.json in the run folder; verify.mjs and visual.mjs keep the
// previous one as previous-metrics.json, which the next report compares against.
function metricsFor(r) {
  const m = {};
  const put = (key, value, better) => {
    if (Number.isFinite(value)) m[key] = { value, better };
  };
  const sum = (rows, f) => rows.reduce((n, x) => n + f(x), 0);
  const mine = (rows) => rows.filter((x) => x.run === r);

  put(
    'Gates failed',
    r.steps.filter((s) => s.status === 'FAIL').length,
    'lower',
  );
  for (const s of r.steps) put(`Seconds: ${s.name}`, s.seconds, null);
  if (r.policy)
    put(
      'Policy checks failed',
      r.policy.checks.filter((c) => c.status !== 'pass').length,
      'lower',
    );
  const units = mine(unitRows);
  if (units.length) {
    put(
      'Unit tests',
      sum(units, (u) => u.total),
      'higher',
    );
    put(
      'Unit tests failed',
      sum(units, (u) => u.failed),
      'lower',
    );
  }
  const storyRuns = mine(storyRows);
  if (storyRuns.length) {
    put(
      'Stories',
      sum(storyRuns, (s) => s.total),
      'higher',
    );
    put(
      'Stories failed',
      sum(storyRuns, (s) => s.failed),
      'lower',
    );
  }
  const e2e = mine(e2eRows);
  if (e2e.length) {
    put(
      'End-to-end passed',
      sum(e2e, (e) => e.stats.expected ?? 0),
      'higher',
    );
    put(
      'End-to-end failed',
      sum(e2e, (e) => e.stats.unexpected ?? 0),
      'lower',
    );
    put(
      'End-to-end flaky',
      sum(e2e, (e) => e.stats.flaky ?? 0),
      'lower',
    );
  }
  const lint = mine(lintRows);
  if (lint.length) {
    put(
      'Lint errors',
      sum(lint, (l) => l.errors),
      'lower',
    );
    put(
      'Lint warnings',
      sum(lint, (l) => l.warnings),
      'lower',
    );
  }
  const myScans = scans.filter((s) => s.run === r);
  const myStories = stories.filter((s) => s.run === r);
  if (myScans.length || myStories.length) {
    const found = [
      ...myStories.flatMap((s) => s.violations),
      ...myScans.flatMap((s) => s.violations),
    ];
    put(
      'Accessibility: pages and stories scanned',
      myScans.length + myStories.filter((s) => s.scanned).length,
      'higher',
    );
    for (const impact of IMPACTS)
      put(
        `Accessibility: ${impact} findings`,
        found.filter((v) => (v.impact ?? 'minor') === impact).length,
        'lower',
      );
  }
  for (const b of budgetRuns.filter((x) => x.run === r))
    for (const [name, s] of Object.entries(b.sizes))
      put(`Bundle gzip bytes: ${name}`, s.gzip, 'lower');
  for (const b of routeRuns.filter((x) => x.run === r))
    for (const [route, s] of Object.entries(b.sizes))
      put(`Route JS gzip bytes: ${route}`, s.gzip, 'lower');
  for (const c of coverageRows.filter((x) => x.run === r))
    if (c.total.lines.total)
      put(`Coverage lines %: ${c.name}`, c.total.lines.pct, 'higher');
  if (r.audit?.counts) {
    const p = r.audit.counts.production;
    const a = r.audit.counts.all;
    put('Audit: production high or critical', p.high + p.critical, 'lower');
    put('Audit: all high or critical', a.high + a.critical, 'lower');
    put('Audit: all moderate', a.moderate, 'lower');
  }
  if (r.secrets)
    put('Secret scan findings', r.secrets.findings.length, 'lower');
  if (r.unused?.result) {
    const by = unusedOf(r);
    put(
      'Unused files and dependencies',
      UNUSED_FAIL.reduce((n, k) => n + (by[k]?.length ?? 0), 0),
      'lower',
    );
    put(
      'Unused exports and types',
      UNUSED_WARN.reduce((n, k) => n + (by[k]?.length ?? 0), 0),
      'lower',
    );
  }
  if (r.testCount) put('Test count', r.testCount.total, 'higher');
  return m;
}

const trend = [];
for (const r of runs) {
  const now = metricsFor(r);
  try {
    fs.writeFileSync(
      path.join(r.dir, 'metrics.json'),
      JSON.stringify(
        {
          commit: r.commit,
          finishedAt: r.finishedAt,
          label: r.label,
          metrics: now,
        },
        null,
        2,
      ) + '\n',
    );
  } catch {
    // A read-only folder (a downloaded artifact) still gets its report.
  }
  if (!r.previous?.metrics) continue;
  const before = r.previous.metrics;
  const rows = [];
  let unchanged = 0;
  for (const key of [
    ...new Set([...Object.keys(before), ...Object.keys(now)]),
  ]) {
    const a = before[key]?.value;
    const b = now[key]?.value;
    if (a === b) {
      unchanged++;
      continue;
    }
    const better = now[key]?.better ?? before[key]?.better;
    let verdict = '';
    if (a !== undefined && b !== undefined && better) {
      const improved = better === 'higher' ? b > a : b < a;
      verdict = improved ? 'better' : '**worse**';
    }
    const delta =
      a !== undefined && b !== undefined
        ? `${b > a ? '+' : ''}${Math.round((b - a) * 100) / 100}`
        : a === undefined
          ? 'new'
          : 'gone';
    rows.push({
      key,
      a,
      b,
      delta,
      verdict,
      seconds: !better && key.startsWith('Seconds'),
    });
  }
  trend.push(`### ${multi ? `${r.label}: ` : ''}since the previous run`, '');
  trend.push(
    `Compared with the run of ${r.previous.finishedAt ?? 'unknown date'} (commit ${r.previous.commit ?? '?'}) in the same folder.`,
    '',
  );
  const judged = rows.filter((x) => !x.seconds);
  if (judged.length) {
    trend.push(
      '| Metric | Previous | Now | Change | |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const x of judged)
      trend.push(
        `| ${cell(x.key)} | ${x.a ?? '—'} | ${x.b ?? '—'} | ${x.delta} | ${x.verdict} |`,
      );
    trend.push('');
  } else trend.push('No result changed.', '');
  const timing = rows.filter((x) => x.seconds);
  if (timing.length)
    trend.push(
      `Durations: ${timing.map((x) => `${x.key.replace('Seconds: ', '')} ${x.a ?? '—'} → ${x.b ?? '—'} s`).join('; ')}.`,
      '',
    );
  trend.push(`${plural(unchanged, 'metric')} unchanged.`, '');
}
if (trend.length) md.splice(trendAt, 0, '## Trend', '', ...trend);
else
  md.splice(
    trendAt,
    0,
    '## Trend',
    '',
    'No previous run in this folder to compare with (the first run, or a fresh CI runner).',
    '',
  );

const text = md.join('\n');
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, text);
console.log(`report: wrote ${out} (${overall})`);
if (args.includes('--summary') && process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');

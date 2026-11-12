// Dashboard route budgets (D-29, P2.1-T20). Target: `pnpm nx run @byteflock/admin-dashboard:budgets`
// (after `next build`; pnpm verify runs it with lint, test, typecheck and build).
//
// The first-load JavaScript of a page route is the shared runtime chunks every page loads
// (build-manifest.json `rootMainFiles`) plus the chunks of its layouts and page (Next's client
// reference manifest, `entryJSFiles`). Each route's gzip size must stay within budgets.json, set by
// the widget's method: budget = ceil(baseline × 1.15), larger only with a written exception
// (check-budget-exception). A new route needs a budget; a budget for a route that is gone fails.
//
//   node scripts/route-budgets.mjs                    check
//   node scripts/route-budgets.mjs --write-baseline   record today's sizes as baselines and budgets
//
// The result is written to test-output/reports/budgets/routes.json for the quality report.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, process.env.NEXT_DIST_DIR || '.next');
const budgetsFile = path.join(root, 'budgets.json');
const writeBaseline = process.argv.includes('--write-baseline');

if (!fs.existsSync(path.join(dist, 'build-manifest.json'))) {
  console.error(
    `route-budgets: no production build in ${path.relative(root, dist)}; run the build target first`,
  );
  process.exit(1);
}
const shared =
  JSON.parse(fs.readFileSync(path.join(dist, 'build-manifest.json'), 'utf8'))
    .rootMainFiles ?? [];

/** Every page route with the client manifest that lists its chunks. */
function pageManifests(dir = path.join(dist, 'server', 'app'), prefix = '') {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory())
      found.push(
        ...pageManifests(path.join(dir, entry.name), `${prefix}/${entry.name}`),
      );
    else if (entry.name === 'page_client-reference-manifest.js')
      found.push({ route: prefix || '/', file: path.join(dir, entry.name) });
  }
  return found;
}

const gzipOf = (files) =>
  files.reduce(
    (n, f) =>
      n + gzipSync(fs.readFileSync(path.join(dist, f)), { level: 9 }).length,
    0,
  );
const rawOf = (files) =>
  files.reduce((n, f) => n + fs.statSync(path.join(dist, f)).size, 0);

const routes = {};
for (const { route, file } of pageManifests()) {
  if (route === '/_global-error') continue; // Next's error boundary, not a page anyone navigates to.
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  const manifest = Object.values(context.__RSC_MANIFEST ?? {})[0];
  const entries = manifest?.entryJSFiles ?? {};
  const routeDir = route === '/' ? '' : route;
  // The page's own entry, and the layouts above it (`.../app/layout`, `.../app/settings/layout`, ...).
  const page = Object.keys(entries).find(
    (k) =>
      k.endsWith(`/app${routeDir}/page`) ||
      (route === '/_not-found' && k.endsWith('/app/not-found')),
  );
  const appRoot = page?.slice(0, page.indexOf('/app/') + 4);
  const layouts = Object.keys(entries).filter((k) => {
    if (!k.endsWith('/layout') || !appRoot || !k.startsWith(appRoot))
      return false;
    const dir = k.slice(appRoot.length, -'/layout'.length);
    return routeDir === dir || routeDir.startsWith(`${dir}/`) || dir === '';
  });
  const files = [
    ...new Set([
      ...shared,
      ...layouts.flatMap((k) => entries[k]),
      ...(page ? entries[page] : []),
    ]),
  ];
  routes[route] = {
    gzip: gzipOf(files),
    raw: rawOf(files),
    chunks: files.length,
    pageFound: Boolean(page),
  };
}

const doc = fs.existsSync(budgetsFile)
  ? JSON.parse(fs.readFileSync(budgetsFile, 'utf8'))
  : {
      $comment:
        'Dashboard route budgets: first-load JavaScript per page route, gzip bytes (D-29). Checked by scripts/route-budgets.mjs after next build; the method is checked by tools/scripts/policy/check-budget-exception.mjs.',
      method:
        'budget = ceil(baseline × 1.15). A budget above that needs an entry in exceptions and a BUDGET-EXCEPTION: line in the pull request.',
      baseline: {},
      budgets: {},
      exceptions: {},
    };

if (writeBaseline) {
  doc.baseline = {
    source: `next build, ${new Date().toISOString().slice(0, 10)}`,
  };
  doc.budgets = {};
  for (const [route, r] of Object.entries(routes).sort()) {
    doc.baseline[route] = r.gzip;
    doc.budgets[route] = Math.ceil(r.gzip * 1.15);
  }
  fs.writeFileSync(budgetsFile, JSON.stringify(doc, null, 2) + '\n');
  console.log(
    `route-budgets: recorded ${Object.keys(routes).length} routes in budgets.json`,
  );
}

const problems = [];
console.log('\ndashboard first-load JS per route (bytes)');
for (const [route, r] of Object.entries(routes).sort()) {
  const budget = doc.budgets[route];
  if (!r.pageFound)
    problems.push(
      `${route}: its page entry was not found in the client manifest`,
    );
  if (budget === undefined)
    problems.push(
      `${route}: no budget in budgets.json (a new route needs one)`,
    );
  else if (r.gzip > budget)
    problems.push(
      `${route}: ${r.gzip} B gzip exceeds the budget of ${budget} B`,
    );
  console.log(
    `  ${route.padEnd(42)} raw ${String(r.raw).padStart(8)}  gzip ${String(r.gzip).padStart(7)}  budget ${budget ?? 'none'}${budget !== undefined && r.gzip > budget ? '  OVER' : ''}`,
  );
}
for (const route of Object.keys(doc.budgets))
  if (!routes[route])
    problems.push(
      `${route}: has a budget but is not a route any more (remove it)`,
    );

const out = path.join(root, 'test-output', 'reports', 'budgets', 'routes.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  JSON.stringify(
    {
      sizes: Object.fromEntries(
        Object.entries(routes).map(([route, r]) => [
          route,
          { raw: r.raw, gzip: r.gzip, budget: doc.budgets[route] ?? null },
        ]),
      ),
      problems,
    },
    null,
    2,
  ) + '\n',
);

if (problems.length) {
  console.error(`\nroute-budgets failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `route-budgets: ${Object.keys(routes).length} routes within budget\n`,
);

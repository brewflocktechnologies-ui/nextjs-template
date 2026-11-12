// Policy (D-27, P2.1-T18): known vulnerabilities in dependencies.
//
// - A high or critical advisory in a PRODUCTION dependency always fails; nothing excuses it.
// - A high or critical advisory in a dev dependency fails unless tools/audit-exceptions.json lists
//   it with a reason and an expiry date. An expired entry fails, and so does an entry whose
//   advisory no longer appears (remove it).
// - Moderate and low advisories are reported, never failing.
// - Offline (the registry cannot be reached): skipped with a notice locally, a failure when CI is
//   set, like check-codeowners. A security gate that silently passes offline is worse than none.
//
// The check proves itself first: it runs negative cases and fails if one of them passes.
// With BYTEFLOCK_REPORT_DIR set (pnpm verify), the result is also written to details/audit.json.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
const BLOCKING = new Set(['high', 'critical']);
const SEVERITIES = ['critical', 'high', 'moderate', 'low', 'info'];

/** The advisories of one `pnpm audit --json` result, flattened. */
export function advisoriesOf(audit) {
  return Object.values(audit.advisories ?? {}).map((a) => ({
    id: a.github_advisory_id,
    severity: a.severity,
    package: a.module_name,
    fixedIn: a.patched_versions,
    title: a.title,
    example: a.findings?.[0]?.paths?.[0] ?? '',
  }));
}

/**
 * Pure decision. `all` and `prod` are `pnpm audit --json` results (all dependencies; production
 * only), `exceptions` the parsed exceptions file, `today` an ISO date (YYYY-MM-DD).
 */
export function evaluate({ all, prod, exceptions, today }) {
  const advisories = advisoriesOf(all);
  const prodIds = new Set(advisoriesOf(prod).map((a) => a.id));
  const listed = exceptions?.exceptions ?? {};
  const failures = [];
  const seen = new Set();

  for (const a of advisories) {
    if (!BLOCKING.has(a.severity)) continue;
    const inProd = prodIds.has(a.id);
    const where = `${a.package} (${a.id}, ${a.severity}): ${a.title ?? ''} [fixed in ${a.fixedIn ?? 'no release'}; e.g. ${a.example}]`;
    if (inProd) {
      failures.push(`production dependency, cannot be excused: ${where}`);
      continue;
    }
    const entry = listed[a.id];
    if (!entry) {
      failures.push(`dev dependency without an exception: ${where}`);
      continue;
    }
    seen.add(a.id);
    if (!entry.reason || !entry.expires)
      failures.push(`exception ${a.id} needs a reason and an expires date`);
    else if (entry.expires < today)
      failures.push(`exception ${a.id} expired on ${entry.expires}: ${where}`);
  }
  for (const id of Object.keys(listed)) {
    const current = advisories.find((a) => a.id === id);
    if (!current || !BLOCKING.has(current.severity))
      failures.push(
        `stale exception ${id}: the advisory no longer appears at high or critical; remove it`,
      );
  }

  const count = (list) =>
    Object.fromEntries(
      SEVERITIES.map((s) => [s, list.filter((a) => a.severity === s).length]),
    );
  return {
    failures,
    counts: { all: count(advisories), production: count(advisoriesOf(prod)) },
    excused: advisories
      .filter((a) => BLOCKING.has(a.severity) && seen.has(a.id))
      .map((a) => ({ ...a, ...listed[a.id] })),
    advisories,
  };
}

/** Negative and positive cases; returns the cases that did not behave. */
export function selfTest() {
  const adv = (id, severity, pkg = 'pkg') => ({
    github_advisory_id: id,
    severity,
    module_name: pkg,
    title: 't',
    patched_versions: '>=2',
    findings: [{ paths: [`.>${pkg}`] }],
  });
  const audit = (...a) => ({
    advisories: Object.fromEntries(a.map((x, i) => [i, x])),
  });
  const none = audit();
  const ex = (o) => ({ exceptions: o });
  const cases = [
    [
      'prod high fails',
      {
        all: audit(adv('G1', 'high')),
        prod: audit(adv('G1', 'high')),
        exceptions: ex({}),
        today: '2026-01-01',
      },
      false,
    ],
    [
      'prod high is not excused',
      {
        all: audit(adv('G1', 'critical')),
        prod: audit(adv('G1', 'critical')),
        exceptions: ex({ G1: { reason: 'x', expires: '2099-01-01' } }),
        today: '2026-01-01',
      },
      false,
    ],
    [
      'dev high without exception fails',
      {
        all: audit(adv('G2', 'high')),
        prod: none,
        exceptions: ex({}),
        today: '2026-01-01',
      },
      false,
    ],
    [
      'expired exception fails',
      {
        all: audit(adv('G2', 'high')),
        prod: none,
        exceptions: ex({ G2: { reason: 'x', expires: '2025-12-31' } }),
        today: '2026-01-01',
      },
      false,
    ],
    [
      'exception without a reason fails',
      {
        all: audit(adv('G2', 'high')),
        prod: none,
        exceptions: ex({ G2: { expires: '2099-01-01' } }),
        today: '2026-01-01',
      },
      false,
    ],
    [
      'stale exception fails',
      {
        all: none,
        prod: none,
        exceptions: ex({ G3: { reason: 'x', expires: '2099-01-01' } }),
        today: '2026-01-01',
      },
      false,
    ],
    [
      'excused dev high passes',
      {
        all: audit(adv('G2', 'high')),
        prod: none,
        exceptions: ex({ G2: { reason: 'x', expires: '2099-01-01' } }),
        today: '2026-01-01',
      },
      true,
    ],
    [
      'moderate and low never fail',
      {
        all: audit(adv('G4', 'moderate'), adv('G5', 'low')),
        prod: audit(adv('G4', 'moderate')),
        exceptions: ex({}),
        today: '2026-01-01',
      },
      true,
    ],
  ];
  return cases
    .filter(
      ([, input, shouldPass]) =>
        (evaluate(input).failures.length === 0) !== shouldPass,
    )
    .map(([name]) => name);
}

function pnpmAudit(args) {
  const r = spawnSync(['pnpm', 'audit', '--json', ...args].join(' '), {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  try {
    const json = JSON.parse(r.stdout);
    return json.advisories ? json : null;
  } catch {
    return null;
  }
}

function writeDetails(details) {
  const dir = process.env.BYTEFLOCK_REPORT_DIR;
  if (!dir) return;
  const out = path.join(dir, 'details', 'audit.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(details, null, 2) + '\n');
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const broken = selfTest();
  if (broken.length) {
    console.error(
      `check-audit: self-test failed, the check does not catch: ${broken.join('; ')}`,
    );
    process.exit(1);
  }

  const all = pnpmAudit([]);
  const prod = all ? pnpmAudit(['--prod']) : null;
  if (!all || !prod) {
    const message = 'could not run pnpm audit (is the registry reachable?)';
    writeDetails({ skipped: message });
    if (process.env.CI) {
      console.error(`check-audit: ${message}`);
      process.exit(1);
    }
    console.log(
      `check-audit: ${message}; skipped locally (an error when CI is set)`,
    );
    process.exit(0);
  }

  const exceptions = JSON.parse(
    fs.readFileSync(path.join(root, 'tools', 'audit-exceptions.json'), 'utf8'),
  );
  const today = new Date().toISOString().slice(0, 10);
  const result = evaluate({ all, prod, exceptions, today });
  writeDetails({ checkedOn: today, ...result });

  const c = result.counts;
  console.log(
    `check-audit: production ${c.production.critical} critical, ${c.production.high} high, ${c.production.moderate} moderate, ${c.production.low} low; all dependencies ${c.all.critical} critical, ${c.all.high} high, ${c.all.moderate} moderate, ${c.all.low} low; ${result.excused.length} high/critical excused`,
  );
  if (result.failures.length) {
    console.error(`check-audit:\n  ${result.failures.join('\n  ')}`);
    process.exit(1);
  }
}

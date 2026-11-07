// Generates the widget's config and theme documents for the local tenants (P1.3-T12) from
// validation/tenants.json and the validated theme fixtures in libs/theme/fixtures/valid.
//
//   node tools/scripts/generate-widget-fixtures.mjs           write validation/widget-fixtures/v1
//   node tools/scripts/generate-widget-fixtures.mjs --check   fail if they are stale
//
// Only the tenants' files are generated. The deliberate failure fixtures (t_broken, wk_broken_*,
// wk_slow, wk_wrong_domain) are hand-written and left alone. `pnpm stack:reset` copies the result into the widget.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'validation', 'widget-fixtures', 'v1');
const { tenants } = JSON.parse(
  fs.readFileSync(path.join(root, 'validation', 'tenants.json'), 'utf8'),
);
const check = process.argv.includes('--check');

const files = new Map();
for (const t of tenants) {
  const theme = JSON.parse(fs.readFileSync(path.join(root, t.theme), 'utf8'));
  files.set(`themes/${t.tenantId}/${theme.revision}.json`, theme);
  files.set(`config/${t.widgetKey}.json`, {
    schemaVersion: 1,
    tenantId: t.tenantId,
    themeRevision: theme.revision,
    locale: { default: t.locale, supported: t.supportedLocales },
    features: { proactive: t.proactive, consent: t.consent },
    launcher: { position: theme.launcher.position },
    allowedOrigins: t.allowedOrigins,
  });
}

const stale = [];
for (const [rel, doc] of files) {
  const target = path.join(out, rel);
  const text = JSON.stringify(doc, null, 2) + '\n';
  const current = fs.existsSync(target)
    ? fs.readFileSync(target, 'utf8')
    : null;
  if (current === text) continue;
  stale.push(rel);
  if (!check) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
}

if (check && stale.length) {
  console.error(
    `widget fixtures are stale; run node tools/scripts/generate-widget-fixtures.mjs:\n  ${stale.join('\n  ')}`,
  );
  process.exit(1);
}
console.log(
  check
    ? `widget fixtures: ${files.size} files up to date`
    : `widget fixtures: ${stale.length} of ${files.size} files written`,
);

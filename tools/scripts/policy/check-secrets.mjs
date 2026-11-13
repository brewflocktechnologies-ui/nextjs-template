// Policy (D-28, P2.1-T19): no secrets in the repository.
//
// Scans every tracked file and every new file git would add (not ignored) for private keys, cloud
// and service tokens, JWTs, URLs with a password, and quoted password/secret/token assignments.
// Fails on committed `.env` files other than `.env.development` and `*.example`, and on key files.
// Allowed by name: the local development database passwords of D-24 (`byteflock`,
// `byteflock_app`), placeholders and values built from variables. One line can opt out with a
// `secret-scan: allow <reason>` comment on it or on the line above.
//
// Findings name the file, line and rule, never the value. Git history is not scanned.
// The check proves itself first: planted tokens (built at run time, so this file holds none) must
// each be found. With BYTEFLOCK_REPORT_DIR set, details/secrets.json is written for the report.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

/** The local development passwords of D-24, committed on purpose. */
export const DEV_PASSWORDS = new Set(['byteflock', 'byteflock_app']);
const PLACEHOLDER =
  /^(<.*>|\$\{.*\}|\{\{.*\}\}|x+|\*+|changeme|example|password|secret|placeholder|dummy|test|redacted)$/i;

export const RULES = [
  [
    'private key',
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/,
  ],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  [
    'GitHub token',
    /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/,
  ],
  ['Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ['Stripe live key', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['npm token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b/],
  [
    'JSON Web Token',
    /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  ],
];
const URL_CREDENTIALS =
  /\b[a-z][a-z0-9+.-]*:\/\/([^\s/:@'"`]+):([^\s/@'"`]+)@/gi;
const ASSIGNMENT =
  /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key)\b["']?\s*[:=]\s*["'`]([^"'`\s]{8,})["'`]/gi;

const isAllowedValue = (value) =>
  DEV_PASSWORDS.has(value) ||
  PLACEHOLDER.test(value) ||
  value.includes('${') ||
  value.includes('process.env');

/** Pure: findings in one file's text. */
export function scanText(file, text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (
      /secret-scan: allow\s+\S/.test(line) ||
      /secret-scan: allow\s+\S/.test(lines[i - 1] ?? '')
    )
      return;
    const hit = (rule) => findings.push({ file, line: i + 1, rule });
    for (const [rule, re] of RULES) if (re.test(line)) hit(rule);
    for (const m of line.matchAll(URL_CREDENTIALS))
      if (!isAllowedValue(m[2])) hit('password in a URL');
    for (const m of line.matchAll(ASSIGNMENT))
      if (!isAllowedValue(m[1])) hit('quoted secret assignment');
  });
  return findings;
}

/** Pure: a problem with the file itself (its name), or null. */
export function fileProblem(file) {
  const base = path.posix.basename(file);
  if (
    /^\.env(\..+)?$/.test(base) &&
    !/\.example$/.test(base) &&
    base !== '.env.development'
  )
    return 'environment file committed (only .env.development and *.example may be)';
  if (
    /\.(pem|key|p12|pfx|jks|keystore)$/i.test(base) ||
    /^id_(rsa|dsa|ecdsa|ed25519)$/.test(base)
  )
    return 'key file committed';
  return null;
}

/** Planted cases; returns the ones that were not caught (or wrongly caught). */
export function selfTest() {
  const r = (n, chars = 'A1b2C3d4E5') =>
    chars.repeat(Math.ceil(n / chars.length)).slice(0, n);
  const planted = [
    ['private key', '-----BEGIN ' + 'RSA PRIVATE KEY-----'],
    ['AWS access key', 'aws = "AKIA' + 'ABCDEFGHIJKLMNOP"'],
    ['GitHub token', 'token: gh' + 'p_' + r(36)],
    ['Slack token', 'xox' + 'b-' + r(24)],
    ['Stripe live key', 'sk' + '_live_' + r(24)],
    ['Google API key', 'AI' + 'za' + r(35)],
    ['npm token', 'np' + 'm_' + r(36)],
    ['Anthropic API key', 'sk-' + 'ant-' + r(40)],
    ['OpenAI API key', 'sk-' + r(40)],
    ['JSON Web Token', 'ey' + 'J' + r(20) + '.ey' + 'J' + r(20) + '.' + r(20)],
    ['password in a URL', 'postgres://admin:' + r(16) + '@db.example.com/prod'],
    ['quoted secret assignment', 'const api' + 'Key = "' + r(24) + '";'],
  ];
  const missed = planted
    .filter(([rule, text]) => !scanText('x', text).some((f) => f.rule === rule))
    .map(([rule]) => `misses ${rule}`);
  const clean = [
    'postgres://byteflock_app:byteflock_app@localhost:5440/byteflock',
    'postgres://${user}:${user}@127.0.0.1:5440/db',
    'password: "changeme"',
    'secret = "' + r(24) + '" // secret-scan: allow test fixture',
  ];
  const noisy = clean
    .filter((t) => scanText('x', t).length)
    .map((t) => `flags clean text: ${t.slice(0, 30)}`);
  const files = [
    ['.env', true],
    ['apps/x/.env.production', true],
    ['.env.local.example', false],
    ['apps/admin-dashboard/.env.development', false],
    ['certs/server.pem', true],
    ['id_rsa', true],
  ]
    .filter(([f, bad]) => Boolean(fileProblem(f)) !== bad)
    .map(([f]) => `wrong file verdict: ${f}`);
  return [...missed, ...noisy, ...files];
}

const BINARY =
  /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|mp4|webm)$/i;
const SKIP = new Set(['pnpm-lock.yaml']);

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const broken = selfTest();
  if (broken.length) {
    console.error(`check-secrets: self-test failed: ${broken.join('; ')}`);
    process.exit(1);
  }
  const files = execFileSync(
    'git',
    ['ls-files', '-co', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\0')
    .filter(Boolean);
  const findings = [];
  let scanned = 0;
  for (const file of files) {
    const problem = fileProblem(file);
    if (problem) findings.push({ file, line: 0, rule: problem });
    if (BINARY.test(file) || SKIP.has(path.posix.basename(file))) continue;
    const full = path.join(root, file);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue; // deleted in the working tree
    }
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;
    scanned++;
    findings.push(...scanText(file, fs.readFileSync(full, 'utf8')));
  }
  if (process.env.BYTEFLOCK_REPORT_DIR) {
    const out = path.join(
      process.env.BYTEFLOCK_REPORT_DIR,
      'details',
      'secrets.json',
    );
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(
      out,
      JSON.stringify({ filesScanned: scanned, findings }, null, 2) + '\n',
    );
  }
  if (findings.length) {
    console.error(
      `check-secrets: ${findings.length} finding(s) in ${scanned} files:\n  ${findings.map((f) => `${f.file}${f.line ? `:${f.line}` : ''}: ${f.rule}`).join('\n  ')}`,
    );
    process.exit(1);
  }
  console.log(
    `check-secrets: ${scanned} files scanned, no secrets; self-test passed`,
  );
}

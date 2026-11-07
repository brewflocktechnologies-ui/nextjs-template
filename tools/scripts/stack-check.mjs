// Checks the local stack (SPECS/validation/local-stack.md). Node only, so it works on Windows
// without curl.
//
//   pnpm stack:check              check once
//   pnpm stack:check --wait 120   retry for up to 120 s while the dev servers start
//
// Required endpoints fail the check; endpoints a later phase adds are reported as "not yet".
import { FRAME_HEADERS } from '../../apps/widget/src/headers.config.ts';

const args = process.argv.slice(2);
const waitIndex = args.indexOf('--wait');
const waitSeconds = waitIndex >= 0 ? Number(args[waitIndex + 1] ?? 120) : 0;

const endpoints = [
  {
    // `/` redirects to the tenant switcher without a session (P1.6 proxy); probe the public page.
    name: 'Admin dashboard',
    url: 'http://localhost:3000/dev/session',
    required: true,
    type: 'text/html',
  },
  {
    name: 'Widget playground',
    url: 'http://localhost:4300/',
    required: true,
    type: 'text/html',
  },
  {
    name: 'Widget frame',
    url: 'http://localhost:4400/v1/frame/',
    required: true,
    frame: true,
    type: 'text/html',
  },
  {
    name: 'Widget loader',
    url: 'http://localhost:4400/v1/loader.js',
    required: true,
    from: 'PoC-A',
    type: 'javascript',
  },
  {
    name: 'Widget config (wk_acme_demo)',
    url: 'http://localhost:4400/v1/config/wk_acme_demo.json',
    required: true,
    from: 'PoC-A',
    type: 'json',
  },
];

async function probe(url) {
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    return { status: res.status, headers: res.headers };
  } catch (error) {
    return { status: 0, error: error.cause?.code ?? error.message };
  }
}

// Up means a 2xx/3xx answer with the expected content type, so an HTML fallback page never
// counts as a JavaScript or JSON endpoint.
const isUp = (r, type) =>
  r.status >= 200 &&
  r.status < 400 &&
  (!type || (r.headers?.get('content-type') ?? '').includes(type));
const deadline = Date.now() + waitSeconds * 1000;
let results;
for (;;) {
  results = await Promise.all(
    endpoints.map(async (e) => ({ ...e, result: await probe(e.url) })),
  );
  const requiredUp = results
    .filter((r) => r.required)
    .every((r) => isUp(r.result, r.type));
  if (requiredUp || Date.now() >= deadline) break;
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

let failed = false;
for (const r of results) {
  const up = isUp(r.result, r.type);
  const label = up ? 'OK  ' : r.required ? 'FAIL' : 'not yet';
  const detail = r.result.status ? `HTTP ${r.result.status}` : r.result.error;
  console.log(
    `${label.padEnd(8)} ${r.name.padEnd(30)} ${r.url}  (${detail}${!up && !r.required ? `, arrives in ${r.from}` : ''})`,
  );
  if (r.required && !up) failed = true;

  if (r.frame && up) {
    for (const [name, value] of Object.entries(FRAME_HEADERS)) {
      const actual = r.result.headers.get(name);
      const ok = actual === value;
      if (!ok) failed = true;
      console.log(
        `         ${ok ? 'header ok ' : 'HEADER BAD'} ${name}${ok ? '' : `: got ${actual ?? '(missing)'}`}`,
      );
    }
  }
}

if (failed) {
  console.error('\nstack:check failed. Is `pnpm stack` running?');
  process.exit(1);
}
console.log('\nstack:check passed');

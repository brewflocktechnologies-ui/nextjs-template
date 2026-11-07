# Contract: public widget endpoints, response headers and embedding (ENDP)

Source: ARCH-001 §8.7, §10.7, §10.11, Appendix C (ADR-007, ADR-009), §13 T-08, T-12. Static files live in `apps/widget/public/v1/`; headers are defined once in `apps/widget/src/headers.config.ts` (D-14) and applied by the Vite dev/preview plugin locally and emitted as `dist/_headers` at build for the static host.

## ENDP-01 Paths (all under the widget origin)

| Path                                    | Content                                                                                    | `Cache-Control`                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `/v1/loader.js`                         | Tiny loader, IIFE, the one mutable entry                                                   | `public, max-age=300`                            |
| `/v1/launcher.[hash].js`                | Launcher ESM bundle                                                                        | `public, max-age=31536000, immutable`            |
| `/v1/frame/` (`index.html`)             | Frame document                                                                             | `public, max-age=60, must-revalidate`            |
| `/v1/frame/assets/*.[hash].*`           | Frame bundles, CSS                                                                         | `public, max-age=31536000, immutable`            |
| `/v1/config/{widgetKey}.json`           | Bootstrap config (ENDP-02)                                                                 | `public, max-age=60, stale-while-revalidate=600` |
| `/v1/themes/{tenantId}/{revision}.json` | Validated theme document (THEME contract)                                                  | `public, max-age=31536000, immutable`            |
| `/v1/fonts/{family}/*.woff2`            | Curated font files                                                                         | `public, max-age=31536000, immutable`            |
| `/v1/telemetry`                         | `POST` beacon sink (dev plugin stub; static host returns 204 via a function or is ignored) | `no-store`                                       |

`widgetKey` is public, revocable and non-secret (Q-008). Nothing under `/v1/` is tenant-authenticated.

## ENDP-02 Config document

```json
{
  "schemaVersion": 1,
  "tenantId": "t_acme",
  "themeRevision": 3,
  "locale": { "default": "en-AU", "supported": ["en-AU", "en-US"] },
  "features": { "proactive": true, "consent": "required" },
  "launcher": { "position": "bottom-right" },
  "allowedOrigins": ["https://www.customer.example", "http://localhost:4300"]
}
```

- `consent`: `'required' | 'notRequired'` (Q-006). `proactive` (Q-015) tells the launcher whether to create the frame at idle or on first open.
- Validated in the frame by a hand-written guard (same style as THEME-04). Unknown keys ignored; missing required keys → `CONFIG_INVALID`.

## ENDP-02a Domain allowlist (Q-014, D-21)

- `allowedOrigins` is required in every config document: 1–20 entries, each an exact origin matching `^https?://[a-z0-9.-]+(:[0-9]{1,5})?$` (no path, no wildcard, lower case).
- The frame checks the expected parent origin (BRIDGE-04 rule 2) against the list before it posts `ready`, and checks the pinned origin again after the first inbound message. Not listed → the frame renders nothing, posts nothing to the parent, and sends one `ORIGIN_NOT_ALLOWED` beacon. The launcher then reaches its unavailable state through the normal 5 s `ready` timeout.
- In `mode=preview`, the build-time dashboard origin is always allowed, whatever the list says.
- Local tenants list `http://localhost:4300` (the playground). The failure fixture `wk_wrong_domain` lists only `https://customer.example`.
- The list is edited in the dashboard at `/settings/widget` (P1.6-T12) and written into the config document by the publish stub.

## ENDP-03 Frame document response headers

| Header                       | Value (Phase 1)                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`    | `default-src 'none'; script-src 'self'; style-src 'self' 'nonce-{nonce}'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://rt.<platform>; frame-ancestors *; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'; trusted-types lit-html byteflock-frame` |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                                                                                                                                                                                                                                                                    |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=(), payment=()`                                                                                                                                                                                                                                               |
| `Cross-Origin-Opener-Policy` | `same-origin`                                                                                                                                                                                                                                                                                        |
| `X-Content-Type-Options`     | `nosniff`                                                                                                                                                                                                                                                                                            |

Notes: the frame is a static document, so the `nonce` is per-build (acceptable in Phase 1 because the frame injects no inline styles at runtime except through `adoptedStyleSheets`/constructable stylesheets, which are not subject to `style-src`); if a runtime nonce is ever needed, it becomes a server concern. `frame-ancestors *` stays even with the allowlist (D-21): one static frame document serves every widget key, so per-key restriction is enforced by the frame bootstrap (ENDP-02a), not by the header. Locally `connect-src` adds `http://localhost:4400` (self) only; `rt.<platform>` is a placeholder until the realtime phase.

## ENDP-04 Iframe element attributes (set by the launcher)

```html
<iframe src="https://widget.<platform>/v1/frame/?key=wk_…&locale=en-AU&parent=https%3A%2F%2Fcustomer.example&v=1" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" allow="clipboard-write" referrerpolicy="strict-origin" title="<localised: Chat with {brand.name}>" loading="eager"></iframe>
```

No `allow-top-navigation`. The iframe `title` and the launcher button's accessible name come from the loader's `data-launcher-label` attribute (set by the tenant in the snippet), falling back to a per-locale default table inside the launcher ("Chat" for `en`). They never come from the bridge: `launcherTheme` carries no text (BRIDGE-02), so no host-page-visible string can originate from the frame.

## ENDP-05 Customer host-page requirements (the embedding promise)

Snippet:

```html
<script async src="https://widget.<platform>/v1/loader.js" data-widget-key="wk_…" data-locale="en-AU"></script>
```

If the customer enforces CSP, they add exactly:

```
script-src https://widget.<platform>;
frame-src  https://widget.<platform>;
```

Nothing else: no `connect-src`, `style-src`, `font-src`, `img-src`, and no Trusted Types policy for the widget. The playground's `strict-csp.html` fixture asserts this at every release (PoC-A criterion 4; `[auto]` from P1.5).

Optional declarative API: `<byteflock-chat-v1 widget-key="…">`, defined only if `customElements.get('byteflock-chat-v1') === undefined`.

Public JS API (queued until ready): `window.ByteflockChat('open' | 'close' | 'identify' | 'consent' | 'locale', payload?)`. The loader records calls in `window.ByteflockChat.q` until the launcher is ready, in the style of analytics snippets.

## ENDP-06 Loader behaviour

1. Feature-detect `attachShadow`, `customElements`, `postMessage`, `IntersectionObserver`, `fetch`, dynamic `import()`. Missing → set `data-byteflock-chat="unsupported"` on its own `<script>` and exit. No other DOM mutation.
2. Read `data-widget-key` (required; `^wk_[a-z0-9_]{3,40}$`), `data-locale`, `data-position`, `data-launcher` (`auto` | `manual`), `data-launcher-label`.
3. Derive `widgetOrigin` from `document.currentScript.src` (fallback: the script element found by `data-widget-key`).
4. `import(widgetOrigin + '/v1/launcher.[hash].js')` (hash injected at build, D-15) and hand over config + queue.
5. Must not: fetch, inject styles, use `innerHTML`, touch `localStorage`, or reference `window.parent`.

## ENDP-07 Failure behaviour (ARCH-001 §10.10)

| Failure                                          | Observable behaviour                                                                                                   | Fixture                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Unsupported browser                              | `data-byteflock-chat="unsupported"`, nothing else                                                                      | unit test with stubbed globals          |
| Loader blocked by CSP                            | nothing renders; CSP report on customer side                                                                           | `frame-blocked.html` variant            |
| Frame blocked (`frame-src`) or no `ready` in 5 s | launcher disabled state, tooltip "Chat unavailable", one `console.warn`, `data-byteflock-chat="unavailable"`           | `frame-blocked.html`                    |
| Config/theme fetch failure or timeout (2 s)      | frame renders embedded defaults; `error` beacon                                                                        | `slow-config.html`                      |
| Unsupported theme version                        | embedded defaults; `THEME_UNSUPPORTED_VERSION` beacon                                                                  | `slow-config.html?case=version`         |
| Origin mismatch                                  | frame refuses to open; beacon only                                                                                     | Playwright negative test                |
| Parent origin not in `allowedOrigins`            | frame renders nothing and posts nothing; `ORIGIN_NOT_ALLOWED` beacon; launcher reaches the unavailable state after 5 s | `wrong-domain.html?key=wk_wrong_domain` |
| Host removes the launcher container              | `MutationObserver` re-mounts once, then gives up                                                                       | `hostile-script.html`                   |

## ENDP-08 Telemetry payload

`navigator.sendBeacon('/v1/telemetry', JSON.stringify({ widgetKey, code, frameVersion, ts }))` from the frame only. No message text, no visitor data, no URLs. A unit test asserts the payload's key set is exactly these four (T-06, `[auto]` from P1.7).

## ENDP-09 Build outputs (D-15)

`pnpm nx run @byteflock/widget:build` produces:

```
apps/widget/dist/
  _headers                       # emitted from headers.config.ts
  v1/loader.js                   # IIFE, no static imports, size recorded
  v1/launcher.[hash].js
  v1/frame/index.html
  v1/frame/assets/*.[hash].{js,css}
  v1/config/*.json               # copied from public/
  v1/themes/**/*.json
  v1/fonts/**
```

`assert-bundle.mjs` (BOUND-05) runs as part of the `build` target and fails the build on leakage or budget breach.

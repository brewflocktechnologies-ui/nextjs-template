# Embedding the Byteflock chat widget

Customer embedding guide (ARCH-001 Appendix C, ENDP-05), final for Phase 1 (P1.5-T10). Every promise below is checked by the playground suite in `apps/widget-playground/src/tests`, for example the two-directive CSP by "T-08 strict CSP" and the domain allowlist by "T-05 allowlist".

## The snippet

```html
<script async src="https://widget.<platform>/v1/loader.js" data-widget-key="wk_…" data-locale="en-AU" data-launcher-label="Chat with Acme"></script>
```

| Attribute             | Required | Meaning                                                                                    |
| --------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `data-widget-key`     | yes      | Your public widget key from the dashboard. It is not a secret.                             |
| `data-locale`         | no       | Visitor language as a BCP-47 tag, for example `en-AU`. Defaults to your configured locale. |
| `data-launcher-label` | no       | Accessible name of the launcher and title of the chat frame. Defaults to "Chat".           |
| `data-position`       | no       | `bottom-right` or `bottom-left`. Defaults to your theme's position.                        |

A declarative alternative is `<byteflock-chat-v1 widget-key="wk_…"></byteflock-chat-v1>`, after the loader script.

## Content Security Policy

If your site sends a Content-Security-Policy, add exactly:

```text
script-src https://widget.<platform>;
frame-src  https://widget.<platform>;
```

Use `child-src` instead of `frame-src` only for very old policies. Nothing else is needed: no `connect-src`, `style-src`, `font-src` or `img-src` entry, and no Trusted Types policy. The widget makes no network requests from your page, injects no inline styles or scripts into your document, and never uses `innerHTML`.

## JavaScript API

Calls made before the widget has loaded are queued.

```js
ByteflockChat('open');
ByteflockChat('close');
ByteflockChat('consent', { granted: true });
ByteflockChat('locale', { tag: 'de-DE' });
ByteflockChat('identify', { traits: { externalId: 'c-42', name: 'Sam', email: 'sam@example.com' } });
```

If `ByteflockChat` is not defined yet when your code runs, use the queue form:

```js
window.ByteflockChat =
  window.ByteflockChat ||
  function () {
    (ByteflockChat.q = ByteflockChat.q || []).push(arguments);
  };
```

`identify` traits come from your page and are treated as claimed, not verified, until signed identity verification exists. They are never sent back to your page.

The widget dispatches `byteflock-chat:consent-request` on `window` when your consent configuration requires the visitor's consent. Answer with `ByteflockChat('consent', { granted })`. The visitor can also answer in the chat panel itself.

## What the widget stores

Only one value, and only on the widget's own origin: a random visitor ID (`byteflock.visitorId`), so a returning visitor keeps their conversation. Nothing is stored on your origin, and no cookies are set.

- If your configuration requires consent, the ID is written only after consent is granted. Withdrawing consent deletes it.
- If your configuration does not require consent, the ID is written when the chat loads.

Browsers that partition or block third-party storage may forget the ID between visits; the chat still works.

## What your page can and cannot see

- The conversation runs in a frame on our origin. Scripts on your page, including analytics, tag managers and session-replay tools that record the DOM, cannot read messages or what the visitor types.
- Screenshot-based recording tools can still capture what is displayed on screen.
- The launcher button lives in a closed-off style scope: your CSS does not change its appearance, and its CSS does not change your page.
- The loader sets `data-byteflock-chat` on its own script tag: `loading`, `ready`, `unavailable` or `unsupported` (old browser; nothing else is changed on your page).

## When something goes wrong

| What happens                                          | What your visitors see                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| Your CSP lacks the `frame-src` entry                  | A greyed-out launcher titled "Chat unavailable"; one console warning |
| The page's origin is not in the key's allowed domains | The same, after about five seconds                                   |
| Your theme or configuration cannot be loaded          | The chat works in a neutral grey theme                               |
| A script removes the launcher                         | It is restored once; if removed again, it stays removed              |
| The browser is too old                                | No launcher; the script tag reads `unsupported`                      |

In every case your page keeps working and the widget sends no data from your page.

## Allowed domains

Each widget key works only on the origins listed in its domain settings in the dashboard (D-21): up to 20 exact origins such as `https://www.example.com`, with scheme and port, no paths and no wildcards. List every variant you serve, for example both `https://example.com` and `https://www.example.com`.

On any other origin the chat frame renders nothing, sends nothing to the page, and the launcher shows "Chat unavailable". The dashboard's own theme preview always works.

## Versions

Everything is served under `/v1/`. `loader.js` is cached for 5 minutes and always loads the current `v1` launcher; all other files are immutable. A future `v2` will have its own loader URL, and `v1` keeps receiving fixes during a published deprecation window.

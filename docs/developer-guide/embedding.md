# Embedding the Byteflock chat widget

Draft for the customer embedding guide (ARCH-001 Appendix C, ENDP-05). Verified against the playground's strict-CSP fixture by `apps/widget-playground/src/tests/isolation.spec.ts` ("T-08 strict CSP").

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

The widget dispatches `byteflock-chat:consent-request` on `window` when your consent configuration requires the visitor's consent. Answer with `ByteflockChat('consent', { granted })`.

## What your page can and cannot see

- The conversation runs in a frame on our origin. Scripts on your page, including analytics, tag managers and session-replay tools that record the DOM, cannot read messages or what the visitor types.
- Screenshot-based recording tools can still capture what is displayed on screen.
- The launcher button lives in a closed-off style scope: your CSS does not change its appearance, and its CSS does not change your page.
- The loader sets `data-byteflock-chat` on its own script tag: `loading`, `ready`, `unavailable` (the chat frame did not load, for example because `frame-src` is missing) or `unsupported` (old browser; nothing else is changed on your page).

## Allowed domains

Each widget key works only on the origins listed in its dashboard domain settings (D-21, from P1.5). On any other site the chat frame stays blank and the launcher shows "Chat unavailable".

## Versions

Everything is served under `/v1/`. `loader.js` is cached for 5 minutes and always loads the current `v1` launcher; all other files are immutable. A future `v2` will have its own loader URL, and `v1` keeps receiving fixes during a published deprecation window.

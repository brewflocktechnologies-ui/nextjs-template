# @byteflock/chat-widget

Lit elements and controllers for the widget's conversation frame (P1.5, ADR-007). The code runs only inside the cross-origin frame served from the widget origin, never on the customer's page. No React or Next.js (lint-enforced, BOUND-03).

## Elements

Every element uses Shadow DOM, Lit constructable stylesheets (the frame CSP blocks `<style>`), logical CSS properties and `--sem-*` variables only, and never `innerHTML` or `unsafeHTML`. Each file exports its tag name and a `define…()` function; `defineAll()` registers all six.

| Tag                            | Purpose                                     | Events                           |
| ------------------------------ | ------------------------------------------- | -------------------------------- |
| `byteflock-frame-header`       | Brand bar with a close button               | `frame-close`                    |
| `byteflock-message`            | One message with a localised time           |                                  |
| `byteflock-message-list`       | Focusable, live-announced scrolling list    |                                  |
| `byteflock-composer`           | Message box; Enter sends, Shift+Enter wraps | `composer-send` `{ text }`       |
| `byteflock-consent-notice`     | Placeholder consent prompt (Q-012 wording)  | `consent-decision` `{ granted }` |
| `byteflock-unavailable-notice` | Shown when chat cannot be offered           |                                  |

Strings come from `src/i18n` through `t(key, locale)`: exact locale, then language, then English. `dirOf(locale)` returns `rtl` for `ar`, `he`, `fa` and `ur`.

## Controllers

- **`ThemeController`** applies resolved `--sem-*` variables to the frame document (unknown keys are rejected and returned) and follows `light`, `dark` or `system` appearance through `matchMedia`. `setTheme(theme)` resolves a validated theme with `@byteflock/theme/resolve`.
- **`TransportController`** is the transport interface: `connect`, `disconnect`, `send`, `subscribe`, `pause`, `resume`, `status`. `InMemoryTransport` is an echo bot that answers after 300 ms; the real transport arrives with the realtime phase.
- **`ConsentController`** holds `unknown`, `granted`, `denied` or `notRequired`. Its `storage` facade throws `ConsentRequiredError` unless storage is allowed; `visitorId()` creates `byteflock.visitorId` only then. It is the only file allowed to touch browser storage: lint forbids `localStorage`, `sessionStorage`, `indexedDB` and `document.cookie` everywhere else in this library and in `apps/widget/src/frame`.

## Storybook and tests

```bash
pnpm nx run @byteflock/chat-widget:storybook        # http://localhost:4700
pnpm nx run @byteflock/chat-widget:test-storybook   # every story in Chromium: play() and axe
pnpm nx test @byteflock/chat-widget                 # controllers, transport, i18n (jsdom)
```

The Tenant toolbar applies the Acme, Globex and Initech fixtures with `ThemeController`; the Locale toolbar switches `lang` and `dir`. `Composites/Conversation` runs the list and composer under each tenant, for side-by-side comparison with ui-react's `Composites/FilterDialog` on port 4600. Stories query inside shadow roots in `play()`; any axe violation fails the run.

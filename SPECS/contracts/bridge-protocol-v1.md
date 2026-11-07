# Contract: bridge protocol v1 (BRIDGE)

Source: ARCH-001 §10.5, Appendix A (ADR-007), §13 T-02. Implemented in PoC-A (`apps/widget/src/bridge/protocol.ts`), hardened in P1.5. Changes to `protocol.ts` require the `CONTRACT-CHANGE:` PR trailer.

## BRIDGE-01 Envelope

```ts
type Envelope = { v: 1; type: string; id: string; payload: Record<string, unknown> };
```

- `v` must be exactly `1`. `type` ≤ 32 chars, `^[a-z][a-z.]*$`. `id` ≤ 64 chars.
- Any message that is not a plain object, has a wrong `v`, an unknown `type`, a missing or non-object `payload`, or **any payload key not listed for that type** is dropped and counted under `dropped.<reason>`.
- No message in either direction ever carries message text, composer text, visitor data, tokens, cookies or URLs with secrets. `identify` is the single exception for tenant-supplied traits and is host → frame only; the frame never echoes it.

## BRIDGE-02 Frame → host messages

| `type`                                                                                                                              | Payload                                              | Validation on the launcher side (re-validated, never trusted)       |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| `ready`                                                                                                                             | `{ launcherTheme: LauncherTheme }`                   | Every field validated again by the launcher; unknown fields dropped |
| `state`                                                                                                                             | `{ open: boolean }`                                  | boolean                                                             |
| `unread`                                                                                                                            | `{ count: number }`                                  | integer 0–99, clamped                                               |
| `layout` (defined, not sent in Phase 1: the launcher picks panel or full screen from the host viewport, which the frame cannot see) | `{ mode: 'panel' \| 'fullscreen', height?: number }` | enum; `height` integer 0–2000                                       |
| `error`                                                                                                                             | `{ code: ErrorCode }`                                | enum only, no free text                                             |
| `consent.request`                                                                                                                   | `{}`                                                 | —                                                                   |

```ts
type LauncherTheme = {
  bg: `#${string}`; // ^#[0-9a-f]{6}$
  fg: `#${string}`; // ^#[0-9a-f]{6}$
  radius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  icon: 'chat' | 'help' | 'message';
  position: 'bottom-right' | 'bottom-left';
  shape: 'circle' | 'pill'; // added in PoC-A: the tenant fixtures need circle vs pill launchers
};
type ErrorCode = 'CONFIG_TIMEOUT' | 'CONFIG_INVALID' | 'THEME_INVALID' | 'THEME_UNSUPPORTED_VERSION' | 'ORIGIN_MISMATCH' | 'ORIGIN_NOT_ALLOWED' | 'FRAME_INIT_FAILED' | 'RATE_LIMITED';
```

## BRIDGE-03 Host → frame messages

| `type`          | Payload                                                              | Notes                                                                                                                                                                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`          | `{}`                                                                 |                                                                                                                                                                                                                                                                                                                |
| `close`         | `{}`                                                                 |                                                                                                                                                                                                                                                                                                                |
| `consent`       | `{ granted: boolean }`                                               | Gates persistence (THEME-free; see P1.5 consent gate)                                                                                                                                                                                                                                                          |
| `locale`        | `{ tag: string }`                                                    | BCP-47, ≤ 35 chars, pattern `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$`                                                                                                                                                                                                                                              |
| `identify`      | `{ traits: { externalId?: string, name?: string, email?: string } }` | each ≤ 256 chars; stored as _claimed_; never echoed; no other keys                                                                                                                                                                                                                                             |
| `visibility`    | `{ hidden: boolean }`                                                | page visibility hint                                                                                                                                                                                                                                                                                           |
| `theme.preview` | `{ vars: Record<string, string> }`                                   | **Preview mode only** (`mode=preview` in frame URL) **and** pinned parent origin equals the configured dashboard origin. Keys must be in the resolver's published key list; values pass the shape guard's value rules. In production mode the message is dropped and counted as `dropped.theme_in_production`. |

## BRIDGE-04 Origin and source rules

1. The launcher always posts with `targetOrigin = widgetOrigin` (derived from the loader script's own `src`, never from the page).
2. The frame determines the expected parent origin from `location.ancestorOrigins[0]` when available, otherwise from the `parent` URL parameter. If both exist and differ, the frame refuses to open (`ORIGIN_MISMATCH`).
3. The first inbound message must satisfy `event.origin === expectedParentOrigin && event.source === window.parent`. The frame then **pins** both and ignores any message from another origin or source for its lifetime.
4. The frame posts with `targetOrigin = pinnedParentOrigin`. Before pinning, the frame posts nothing except that it may post `ready` to `expectedParentOrigin` once.
5. The launcher ignores messages whose `event.origin !== widgetOrigin` or whose `event.source !== iframe.contentWindow`.
6. On `ORIGIN_MISMATCH` the frame reports only to its own telemetry endpoint; nothing is posted to the parent.
7. Before posting `ready`, and again after pinning, the frame checks the parent origin against the config's `allowedOrigins` (ENDP-02a, D-21). Not listed → refuse as in rule 6 with code `ORIGIN_NOT_ALLOWED`. In `mode=preview` the build-time dashboard origin is always allowed.

## BRIDGE-05 Rate limiting

Token bucket per message type in the frame: capacity 20, refill 20/s (constants in `protocol.ts`). Excess messages are dropped and counted under `dropped.rate_limited`; the frame emits at most one `error { code: 'RATE_LIMITED' }` per 10 s. The launcher applies the same limiter to inbound messages.

## BRIDGE-06 Counters and observability

`bridgeStats(): Record<string, number>` exposes drop counters in the frame (test hook, readable by Playwright via `window.__byteflockBridgeStats` only when `mode=test` is in the URL and the origin is a playground origin). The launcher exposes nothing on the host page beyond the `data-byteflock-chat` status attribute on the script tag (`loading` → `ready` | `unsupported` | `unavailable`).

## BRIDGE-07 Versioning

The envelope `v` and the `/v1/` path move together. There is no runtime negotiation: the loader loads the launcher major it was built for, and the launcher only talks to `/v1/frame/`. A v2 ships at `/v2/` with its own loader; `/v1/` receives fixes during its deprecation window.

## BRIDGE-08 Required negative tests (PoC-A, `[auto]` from P1.5)

Each test must assert both that the effect did **not** happen and that the matching counter incremented.

| Case                                                                        | Expected                                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Message from wrong origin                                                   | dropped, `dropped.origin`                                              |
| Message with correct origin, wrong source (another iframe)                  | dropped, `dropped.source`                                              |
| Malformed envelope (string, array, `v: 2`, missing `id`)                    | dropped, `dropped.envelope`                                            |
| Unknown `type`                                                              | dropped, `dropped.type`                                                |
| Known type with extra payload key                                           | dropped, `dropped.payload`                                             |
| `theme.preview` in production mode                                          | dropped, `dropped.theme_in_production`; frame CSS variables unchanged  |
| `theme.preview` in preview mode from a non-dashboard origin                 | dropped, `dropped.origin`                                              |
| Flood of 200 `open` messages in 1 s                                         | ≤ 20 processed; `dropped.rate_limited` ≥ 180; one `RATE_LIMITED` error |
| `ready` with `launcherTheme.bg = 'red'` (invalid colour)                    | launcher keeps the embedded default; counter on launcher side          |
| `unread { count: 500 }`                                                     | badge shows 99                                                         |
| Parent origin not in `allowedOrigins` (`wk_wrong_domain` on the playground) | no `ready`; frame renders nothing; one `ORIGIN_NOT_ALLOWED` beacon     |

## BRIDGE-09 Implementation notes

- `protocol.ts` exports the type tables, the validators (`parseEnvelope`, `validateHostToFrame`, `validateFrameToHost`), the limiter, and nothing else. No DOM access in that module so it is unit-testable in Node.
- Validators are hand-written (no schema library in the widget bundle). Unit tests in Vitest (Node) cover every row of BRIDGE-02/03 with valid and invalid payloads.

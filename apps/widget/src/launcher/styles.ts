// Launcher styles, applied through adoptedStyleSheets inside a Shadow DOM (ARCH-001 §10.2).
//
// The host element is reachable by the customer's CSS (e.g. `* { all: unset !important }` beats any
// :host rule), so the host carries nothing that matters. All layout lives on `.root`, inside the
// shadow tree, where page selectors cannot reach, and nothing inherits from the page: every element
// that shows text sets its own font. Constructable stylesheets are not subject to the page's style-src.
// Colours come from launcherTheme at runtime as custom properties set through CSSOM on `.root`.

export const LAUNCHER_CSS = `
:host {
  all: initial;
}
.root {
  all: initial;
  position: fixed;
  /* Maximum value: a host element with the same z-index loses because the launcher is appended last. */
  z-index: 2147483647;
  inset-block-end: 20px;
  inset-inline-end: 20px;
  inset-inline-start: auto;
  direction: ltr;
  color-scheme: light;
  --bf-bg: #334155;
  --bf-fg: #ffffff;
  --bf-radius: 9999px;
  --bf-font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.root[data-position="bottom-left"] {
  inset-inline-start: 20px;
  inset-inline-end: auto;
}
.launcher {
  all: initial;
  box-sizing: border-box;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-inline-size: 56px;
  block-size: 56px;
  padding-inline: 18px;
  border-radius: var(--bf-radius);
  background: var(--bf-bg);
  color: var(--bf-fg);
  font: var(--bf-font);
  font-weight: 600;
  direction: ltr;
  cursor: pointer;
  box-shadow: 0 4px 12px rgb(15 23 42 / 0.25);
  transition: transform 120ms ease;
}
.launcher[data-shape="circle"] {
  inline-size: 56px;
  padding-inline: 0;
  border-radius: 9999px;
}
.launcher[data-shape="circle"] .label {
  display: none;
}
.launcher[data-shape="pill"] {
  border-radius: 9999px;
}
.launcher:hover {
  transform: translateY(-1px);
}
.launcher:focus-visible {
  outline: 3px solid var(--bf-bg);
  outline-offset: 3px;
}
.launcher[aria-disabled="true"] {
  opacity: 0.55;
  cursor: not-allowed;
}
.label {
  all: initial;
  font: var(--bf-font);
  font-weight: 600;
  color: inherit;
}
.launcher svg {
  inline-size: 24px;
  block-size: 24px;
  fill: currentColor;
}
.badge {
  all: initial;
  position: absolute;
  inset-block-start: -4px;
  inset-inline-end: -4px;
  min-inline-size: 20px;
  block-size: 20px;
  padding-inline: 5px;
  box-sizing: border-box;
  border-radius: 10px;
  background: #b91c1c;
  color: #ffffff;
  font: 600 12px/20px system-ui, sans-serif;
  text-align: center;
}
.badge[hidden] {
  display: none;
}
.panel {
  all: initial;
  position: fixed;
  inset-block-end: 88px;
  inset-inline-end: 20px;
  inline-size: 380px;
  block-size: min(640px, calc(100dvh - 120px));
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgb(15 23 42 / 0.3);
  background: #ffffff;
}
.root[data-position="bottom-left"] .panel {
  inset-inline-start: 20px;
  inset-inline-end: auto;
}
.panel[data-state="hidden"] {
  /* Created at idle and kept alive while closed (ARCH-001 §10.3): hidden, not removed. */
  visibility: hidden;
  pointer-events: none;
  inline-size: 0;
  block-size: 0;
  box-shadow: none;
}
.panel[data-layout="fullscreen"] {
  inset: 0;
  inline-size: 100vw;
  block-size: var(--bf-viewport-height, 100dvh);
  border-radius: 0;
}
iframe {
  all: initial;
  display: block;
  inline-size: 100%;
  block-size: 100%;
  border: 0;
}
@media (prefers-reduced-motion: reduce) {
  .launcher {
    transition: none;
  }
}
`;

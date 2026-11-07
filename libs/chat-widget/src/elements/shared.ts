// Shared element plumbing (P1.5-T01). Every element: Shadow DOM, styles as Lit constructable
// stylesheets (the frame CSP blocks <style>), logical CSS properties only, no innerHTML/unsafeHTML.
import { css } from 'lit';

export interface ChatMessage {
  id: string;
  from: 'agent' | 'visitor';
  text: string;
  at: Date;
}

/** Registers a custom element once; safe to call repeatedly. */
export function defineOnce(tag: string, ctor: CustomElementConstructor): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

/** Base styles every element shares; spacing elsewhere scales with --sem-density-factor. */
export const base = css`
  :host {
    box-sizing: border-box;
    font-family: var(--sem-font-family-sans);
    color: var(--sem-color-on-surface);
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  button {
    font: inherit;
    cursor: pointer;
  }
  button:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--sem-color-focus-ring);
    outline-offset: 2px;
  }
`;

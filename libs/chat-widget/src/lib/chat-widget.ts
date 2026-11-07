// Placeholder (P1.1-T03). Real frame elements arrive in PoC-A and P1.5.
// It exists so the Lit import graph is real and the boundary rules have something to check.
import { LIB_NAME as designTokens } from '@byteflock/design-tokens';
import { LIB_NAME as theme } from '@byteflock/theme';
import { LitElement, html } from 'lit';

export const LIB_NAME = 'chat-widget';
export const DEPENDS_ON = [theme, designTokens] as const;
export const PLACEHOLDER_TAG = 'byteflock-placeholder';

export class ByteflockPlaceholder extends LitElement {
  override render() {
    return html`<span>${LIB_NAME}</span>`;
  }
}

/** Registers the element once; safe to call repeatedly and on pages that already define it. */
export function definePlaceholder(): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(PLACEHOLDER_TAG)) {
    customElements.define(PLACEHOLDER_TAG, ByteflockPlaceholder);
  }
}

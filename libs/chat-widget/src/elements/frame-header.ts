import { LitElement, css, html } from 'lit';
import { t } from '../i18n/t';
import { base, defineOnce } from './shared';

export const FRAME_HEADER_TAG = 'byteflock-frame-header';

/** Brand bar with a close button. Fires `frame-close` (bubbles, composed). */
export class ByteflockFrameHeader extends LitElement {
  static override properties = {
    brandName: { type: String, attribute: 'brand-name' },
    locale: { type: String },
  };
  declare brandName: string;
  declare locale: string;

  constructor() {
    super();
    this.brandName = 'Chat';
    this.locale = 'en';
  }

  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding-block: calc(0.75rem * var(--sem-density-factor, 1));
        padding-inline: calc(1rem * var(--sem-density-factor, 1));
        background: var(--sem-color-primary);
        color: var(--sem-color-on-primary);
        /* Invisible normally and takes no space; separates the header in Windows High Contrast. */
        outline: 1px solid transparent;
        outline-offset: -1px;
      }
      h1 {
        margin: 0;
        font-size: calc(1.05rem * var(--sem-type-scale, 1));
        font-weight: 600;
      }
      button {
        border: 0;
        background: transparent;
        color: inherit;
        padding-block: 0.25rem;
        padding-inline: 0.5rem;
        border-radius: var(--sem-radius-md);
      }
    `,
  ];

  private close() {
    this.dispatchEvent(
      new CustomEvent('frame-close', { bubbles: true, composed: true }),
    );
  }

  override render() {
    return html`<header>
      <h1>${this.brandName}</h1>
      <button
        type="button"
        aria-label=${t('header.close', this.locale)}
        @click=${this.close}
      >
        ✕
      </button>
    </header>`;
  }
}

export const defineFrameHeader = () =>
  defineOnce(FRAME_HEADER_TAG, ByteflockFrameHeader);

declare global {
  interface HTMLElementTagNameMap {
    [FRAME_HEADER_TAG]: ByteflockFrameHeader;
  }
}

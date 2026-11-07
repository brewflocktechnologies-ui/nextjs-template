import { LitElement, css, html } from 'lit';
import { t } from '../i18n/t';
import { base, defineOnce } from './shared';

export const UNAVAILABLE_NOTICE_TAG = 'byteflock-unavailable-notice';

/** Shown when chat cannot be offered; announced politely. */
export class ByteflockUnavailableNotice extends LitElement {
  static override properties = { locale: { type: String } };
  declare locale: string;

  constructor() {
    super();
    this.locale = 'en';
  }

  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      p {
        margin: 0;
        padding: calc(1rem * var(--sem-density-factor, 1));
      }
    `,
  ];

  override render() {
    return html`<p role="status">${t('unavailable.text', this.locale)}</p>`;
  }
}

export const defineUnavailableNotice = () =>
  defineOnce(UNAVAILABLE_NOTICE_TAG, ByteflockUnavailableNotice);

declare global {
  interface HTMLElementTagNameMap {
    [UNAVAILABLE_NOTICE_TAG]: ByteflockUnavailableNotice;
  }
}

import { LitElement, css, html } from 'lit';
import { t } from '../i18n/t';
import { base, defineOnce } from './shared';

export const CONSENT_NOTICE_TAG = 'byteflock-consent-notice';

export interface ConsentDecisionDetail {
  granted: boolean;
}

/** Placeholder consent prompt (wording is Q-012's). Fires `consent-decision` with `{ granted }`. */
export class ByteflockConsentNotice extends LitElement {
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
      section {
        display: grid;
        gap: 0.5rem;
        padding: calc(0.75rem * var(--sem-density-factor, 1));
        background: var(--sem-color-surface-variant);
        color: var(--sem-color-on-surface-variant);
        border-block-end: 1px solid var(--sem-color-outline);
      }
      p {
        margin: 0;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
      }
      button {
        padding-block: 0.25rem;
        padding-inline: 0.75rem;
        border-radius: var(--sem-radius-md);
        border: 1px solid var(--sem-color-outline);
        background: var(--sem-color-surface);
        color: var(--sem-color-on-surface);
      }
      button.accept {
        border-color: transparent;
        background: var(--sem-color-primary);
        color: var(--sem-color-on-primary);
      }
    `,
  ];

  private decide(granted: boolean) {
    this.dispatchEvent(
      new CustomEvent<ConsentDecisionDetail>('consent-decision', {
        detail: { granted },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    return html`<section role="region" aria-label="Consent">
      <p>${t('consent.text', this.locale)}</p>
      <div class="actions">
        <button type="button" class="accept" @click=${() => this.decide(true)}>
          ${t('consent.accept', this.locale)}
        </button>
        <button type="button" @click=${() => this.decide(false)}>
          ${t('consent.decline', this.locale)}
        </button>
      </div>
    </section>`;
  }
}

export const defineConsentNotice = () =>
  defineOnce(CONSENT_NOTICE_TAG, ByteflockConsentNotice);

declare global {
  interface HTMLElementTagNameMap {
    [CONSENT_NOTICE_TAG]: ByteflockConsentNotice;
  }
  interface HTMLElementEventMap {
    'consent-decision': CustomEvent<ConsentDecisionDetail>;
  }
}

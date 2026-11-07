import { LitElement, css, html } from 'lit';
import { t } from '../i18n/t';
import { base, defineOnce } from './shared';

export const COMPOSER_TAG = 'byteflock-composer';

export interface ComposerSendDetail {
  text: string;
}

/**
 * Message box. Enter sends, Shift+Enter adds a line. Fires `composer-send` with `{ text }`
 * (bubbles, composed) and clears itself; empty or whitespace-only text is ignored.
 */
export class ByteflockComposer extends LitElement {
  static override properties = {
    locale: { type: String },
    disabled: { type: Boolean, reflect: true },
  };
  declare locale: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.locale = 'en';
    this.disabled = false;
  }

  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      form {
        display: flex;
        gap: 0.5rem;
        padding: calc(0.75rem * var(--sem-density-factor, 1));
        border-block-start: 1px solid var(--sem-color-outline);
      }
      textarea {
        flex: 1;
        resize: none;
        min-block-size: 2.5rem;
        padding: 0.5rem;
        font: inherit;
        color: var(--sem-color-on-surface);
        background: var(--sem-color-surface);
        border: 1px solid var(--sem-color-outline);
        border-radius: var(--sem-radius-md);
      }
      button {
        border: 0;
        padding-inline: 1rem;
        border-radius: var(--sem-radius-md);
        background: var(--sem-color-primary);
        color: var(--sem-color-on-primary);
      }
      button:disabled {
        opacity: 0.6;
        cursor: default;
      }
    `,
  ];

  private get box(): HTMLTextAreaElement | null {
    return this.renderRoot.querySelector('textarea');
  }

  override focus(): void {
    this.updateComplete.then(() => this.box?.focus());
  }

  private send(event: Event) {
    event.preventDefault();
    const box = this.box;
    const text = box?.value.trim();
    if (!box || !text || this.disabled) return;
    box.value = '';
    this.dispatchEvent(
      new CustomEvent<ComposerSendDetail>('composer-send', {
        detail: { text },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) this.send(event);
  }

  override render() {
    return html`<form @submit=${this.send}>
      <textarea
        aria-label=${t('composer.label', this.locale)}
        placeholder=${t('composer.placeholder', this.locale)}
        rows="1"
        ?disabled=${this.disabled}
        @keydown=${this.onKeydown}
      ></textarea>
      <button type="submit" ?disabled=${this.disabled}>
        ${t('composer.send', this.locale)}
      </button>
    </form>`;
  }
}

export const defineComposer = () => defineOnce(COMPOSER_TAG, ByteflockComposer);

declare global {
  interface HTMLElementTagNameMap {
    [COMPOSER_TAG]: ByteflockComposer;
  }
  interface HTMLElementEventMap {
    'composer-send': CustomEvent<ComposerSendDetail>;
  }
}

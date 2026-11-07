import { LitElement, css, html } from 'lit';
import { t } from '../i18n/t';
import { base, defineOnce, type ChatMessage } from './shared';

export const MESSAGE_TAG = 'byteflock-message';

/** One chat message with a localised timestamp (Intl.DateTimeFormat). */
export class ByteflockMessage extends LitElement {
  static override properties = {
    message: { attribute: false },
    locale: { type: String },
  };
  declare message: ChatMessage | undefined;
  declare locale: string;

  constructor() {
    super();
    this.message = undefined;
    this.locale = 'en';
  }

  static override styles = [
    base,
    css`
      :host {
        display: block;
        max-inline-size: 80%;
      }
      :host([from='visitor']) {
        align-self: flex-end;
      }
      .bubble {
        padding-block: calc(0.5rem * var(--sem-density-factor, 1));
        padding-inline: calc(0.75rem * var(--sem-density-factor, 1));
        border-radius: var(--sem-radius-md);
        background: var(--sem-color-surface-variant);
        color: var(--sem-color-on-surface-variant);
        overflow-wrap: anywhere;
      }
      :host([from='visitor']) .bubble {
        background: var(--sem-color-accent);
        color: var(--sem-color-on-accent);
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      time {
        display: block;
        font-size: 0.75em;
      }
    `,
  ];

  override updated() {
    if (this.message) this.setAttribute('from', this.message.from);
  }

  override render() {
    const m = this.message;
    if (!m) return html``;
    const time = new Intl.DateTimeFormat(this.locale, {
      hour: 'numeric',
      minute: '2-digit',
    });
    const who = t(
      m.from === 'agent' ? 'message.fromAgent' : 'message.fromVisitor',
      this.locale,
    );
    return html`<div class="bubble">
      <span class="sr-only">${who}: </span>${m.text}
      <time datetime=${m.at.toISOString()}>${time.format(m.at)}</time>
    </div>`;
  }
}

export const defineMessage = () => defineOnce(MESSAGE_TAG, ByteflockMessage);

declare global {
  interface HTMLElementTagNameMap {
    [MESSAGE_TAG]: ByteflockMessage;
  }
}

import { LitElement, css, html } from 'lit';
import { t } from '../i18n/t';
import { defineMessage } from './message';
import { base, defineOnce, type ChatMessage } from './shared';

export const MESSAGE_LIST_TAG = 'byteflock-message-list';

/** Scrolling, live-announced list of messages; keeps the newest in view. */
export class ByteflockMessageList extends LitElement {
  static override properties = {
    messages: { attribute: false },
    locale: { type: String },
  };
  declare messages: ChatMessage[];
  declare locale: string;

  constructor() {
    super();
    this.messages = [];
    this.locale = 'en';
    defineMessage();
  }

  static override styles = [
    base,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-block-size: 0;
      }
      /* The list is the scroll region; it is focusable so keyboard users can scroll it. */
      ol {
        flex: 1;
        overflow-y: auto;
        margin: 0;
        padding: calc(1rem * var(--sem-density-factor, 1));
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: calc(0.5rem * var(--sem-density-factor, 1));
      }
      ol:focus-visible {
        outline: 2px solid var(--sem-color-focus-ring);
        outline-offset: -2px;
      }
      li {
        display: flex;
        flex-direction: column;
      }
    `,
  ];

  override updated(changed: Map<string, unknown>) {
    if (changed.has('messages'))
      this.renderRoot
        .querySelector('li:last-child')
        ?.scrollIntoView?.({ block: 'end' });
  }

  override render() {
    return html`<ol
      tabindex="0"
      aria-live="polite"
      aria-label=${t('messages.label', this.locale)}
    >
      ${this.messages.map(
        (m) =>
          html`<li>
            <byteflock-message
              .message=${m}
              locale=${this.locale}
            ></byteflock-message>
          </li>`,
      )}
    </ol>`;
  }
}

export const defineMessageList = () =>
  defineOnce(MESSAGE_LIST_TAG, ByteflockMessageList);

declare global {
  interface HTMLElementTagNameMap {
    [MESSAGE_LIST_TAG]: ByteflockMessageList;
  }
}

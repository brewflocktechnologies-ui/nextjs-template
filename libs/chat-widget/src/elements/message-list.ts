import { LitElement, css, html, type PropertyValues } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { t } from '../i18n/t';
import { defineMessage } from './message';
import { base, defineOnce, type ChatMessage } from './shared';

export const MESSAGE_LIST_TAG = 'byteflock-message-list';

/** Distance from the end of the list that still counts as "reading the newest messages". */
const NEAR_END_PX = 48;

/**
 * Scrolling, live-announced list of messages. Follows new messages while the visitor is at the
 * end (or has just sent one), and leaves them where they are while they read older messages.
 */
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

  /** Whether the next update should keep the newest message in view. */
  private followEnd = true;

  private get scroller(): HTMLOListElement | null {
    return this.renderRoot?.querySelector('ol') ?? null;
  }

  override willUpdate(changed: PropertyValues<this>) {
    if (!changed.has('messages')) return;
    // Measured before the new messages render, so it reflects where the visitor was reading.
    const ol = this.scroller;
    const previous = changed.get('messages') as ChatMessage[] | undefined;
    const last = this.messages.at(-1);
    const sentByVisitor =
      last?.from === 'visitor' && last.id !== previous?.at(-1)?.id;
    this.followEnd =
      !ol ||
      sentByVisitor ||
      ol.scrollHeight - ol.scrollTop - ol.clientHeight <= NEAR_END_PX;
  }

  override updated(changed: PropertyValues<this>) {
    if (!changed.has('messages') || !this.followEnd) return;
    // Each message renders its own shadow content after this update; scroll once they have,
    // so the list's final height is known. `settled` lets callers and tests wait for it.
    const items = [
      ...this.renderRoot.querySelectorAll<LitElement>('byteflock-message'),
    ];
    this.settled = Promise.all(items.map((m) => m.updateComplete)).then(() => {
      const ol = this.scroller;
      if (ol) ol.scrollTop = ol.scrollHeight;
    });
  }

  /** Resolves once the list has scrolled after its latest update. */
  settled: Promise<void> = Promise.resolve();

  override render() {
    return html`<ol
      tabindex="0"
      aria-live="polite"
      aria-label=${t('messages.label', this.locale)}
    >
      ${repeat(
        this.messages,
        (m) => m.id,
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

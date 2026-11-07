// Frame shell elements (PoC-A). P1.5 moves reusable elements into @byteflock/chat-widget.
// Rules: Shadow DOM, styles via Lit's constructable stylesheets (no <style> tags, which the frame's
// CSP blocks), logical CSS properties, no innerHTML or unsafeHTML.
import { LitElement, css, html, nothing } from 'lit';

export interface ChatMessage {
  id: number;
  from: 'agent' | 'visitor';
  text: string;
  at: Date;
}

export class ByteflockFrameApp extends LitElement {
  static override properties = {
    brandName: { type: String },
    messages: { attribute: false },
    available: { type: Boolean },
    locale: { type: String },
  };

  // Declared, not initialised as class fields: with modern class-field semantics an initialiser
  // would shadow Lit's reactive accessors (https://lit.dev/msg/class-field-shadowing).
  declare brandName: string;
  declare messages: ChatMessage[];
  declare available: boolean;
  declare locale: string;

  constructor() {
    super();
    this.brandName = 'Chat';
    this.messages = [];
    this.available = true;
    this.locale = 'en';
  }

  static override styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      background: var(--sem-color-surface);
      color: var(--sem-color-on-surface);
      font-family: var(--sem-font-family-sans);
      font-size: calc(1rem * var(--sem-type-scale, 1));
      line-height: 1.5;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-block: calc(0.75rem * var(--sem-density-factor, 1));
      padding-inline: calc(1rem * var(--sem-density-factor, 1));
      background: var(--sem-color-primary);
      color: var(--sem-color-on-primary);
    }
    h1 {
      margin: 0;
      font-size: 1.05em;
      font-weight: 600;
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
    .close {
      border: 0;
      background: transparent;
      color: inherit;
      padding: 0.25rem 0.5rem;
      border-radius: var(--sem-radius-md);
    }
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
    li {
      max-inline-size: 80%;
      padding-block: calc(0.5rem * var(--sem-density-factor, 1));
      padding-inline: calc(0.75rem * var(--sem-density-factor, 1));
      border-radius: var(--sem-radius-md);
      background: var(--sem-color-surface-variant);
      color: var(--sem-color-on-surface-variant);
    }
    li.visitor {
      align-self: flex-end;
      background: var(--sem-color-accent);
      color: var(--sem-color-on-accent);
    }
    time {
      display: block;
      font-size: 0.75em;
      opacity: 0.8;
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
    .send {
      border: 0;
      padding-inline: 1rem;
      border-radius: var(--sem-radius-md);
      background: var(--sem-color-primary);
      color: var(--sem-color-on-primary);
    }
    .unavailable {
      padding: 1rem;
    }
  `;

  private get composer(): HTMLTextAreaElement | null {
    return this.renderRoot.querySelector('textarea');
  }

  focusComposer(): void {
    this.updateComplete.then(() => this.composer?.focus());
  }

  private close() {
    this.dispatchEvent(
      new CustomEvent('frame-close', { bubbles: true, composed: true }),
    );
  }

  private send(event: Event) {
    event.preventDefault();
    const box = this.composer;
    const text = box?.value.trim();
    if (!box || !text) return;
    this.messages = [
      ...this.messages,
      { id: Date.now(), from: 'visitor', text, at: new Date() },
    ];
    box.value = '';
    this.updateComplete.then(() => {
      const list = this.renderRoot.querySelector('ol');
      list?.lastElementChild?.scrollIntoView({ block: 'end' });
    });
  }

  private onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) this.send(event);
  }

  override render() {
    const time = new Intl.DateTimeFormat(this.locale, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return html`
      <header>
        <h1>${this.brandName}</h1>
        <button
          class="close"
          type="button"
          aria-label="Close chat"
          @click=${this.close}
        >
          ✕
        </button>
      </header>
      ${this.available
        ? html`
            <ol aria-live="polite" aria-label="Messages">
              ${this.messages.map(
                (m) =>
                  html`<li class=${m.from}>
                    ${m.text}<time>${time.format(m.at)}</time>
                  </li>`,
              )}
            </ol>
            <form @submit=${this.send}>
              <textarea
                aria-label="Message"
                placeholder="Type your message"
                rows="1"
                @keydown=${this.onKeydown}
              ></textarea>
              <button class="send" type="submit">Send</button>
            </form>
          `
        : nothing}
    `;
  }
}

if (!customElements.get('byteflock-frame-app')) {
  customElements.define('byteflock-frame-app', ByteflockFrameApp);
}

declare global {
  interface HTMLElementTagNameMap {
    'byteflock-frame-app': ByteflockFrameApp;
  }
}

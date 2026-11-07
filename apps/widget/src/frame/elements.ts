// The frame's root element: composes the @byteflock/chat-widget elements (P1.5-T05).
// Rules: Shadow DOM, constructable stylesheets only (the frame CSP blocks <style>), logical CSS
// properties, no innerHTML or unsafeHTML.
import { LitElement, css, html, nothing } from 'lit';
import {
  defineAll,
  type ByteflockComposer,
  type ChatMessage,
} from '@byteflock/chat-widget';

defineAll();

export type { ChatMessage };

export class ByteflockFrameApp extends LitElement {
  static override properties = {
    brandName: { type: String },
    messages: { attribute: false },
    available: { type: Boolean },
    locale: { type: String },
    consentPending: { type: Boolean },
  };

  // Declared, not initialised as class fields: with modern class-field semantics an initialiser
  // would shadow Lit's reactive accessors (https://lit.dev/msg/class-field-shadowing).
  declare brandName: string;
  declare messages: ChatMessage[];
  declare available: boolean;
  declare locale: string;
  declare consentPending: boolean;

  constructor() {
    super();
    this.brandName = 'Chat';
    this.messages = [];
    this.available = true;
    this.locale = 'en';
    this.consentPending = false;
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
    byteflock-message-list {
      flex: 1;
    }
  `;

  focusComposer(): void {
    this.updateComplete.then(() =>
      (
        this.renderRoot.querySelector(
          'byteflock-composer',
        ) as ByteflockComposer | null
      )?.focus(),
    );
  }

  override render() {
    return html`
      <byteflock-frame-header
        brand-name=${this.brandName}
        locale=${this.locale}
      ></byteflock-frame-header>
      ${this.available
        ? html`
            ${this.consentPending
              ? html`<byteflock-consent-notice
                  locale=${this.locale}
                ></byteflock-consent-notice>`
              : nothing}
            <byteflock-message-list
              .messages=${this.messages}
              locale=${this.locale}
            ></byteflock-message-list>
            <byteflock-composer locale=${this.locale}></byteflock-composer>
          `
        : html`<byteflock-unavailable-notice
            locale=${this.locale}
          ></byteflock-unavailable-notice>`}
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

// @byteflock/chat-widget: Lit elements and controllers for the widget frame (P1.5).
// Runs only inside the cross-origin frame; never on the customer's page.
export * from './elements/shared';
export * from './elements/frame-header';
export * from './elements/message';
export * from './elements/message-list';
export * from './elements/composer';
export * from './elements/consent-notice';
export * from './elements/unavailable-notice';
export * from './controllers/theme-controller';
export * from './controllers/transport-controller';
export * from './controllers/consent-controller';
export * from './transport/in-memory';
export * from './i18n/t';

import { defineComposer } from './elements/composer';
import { defineConsentNotice } from './elements/consent-notice';
import { defineFrameHeader } from './elements/frame-header';
import { defineMessage } from './elements/message';
import { defineMessageList } from './elements/message-list';
import { defineUnavailableNotice } from './elements/unavailable-notice';

/** Registers every element once. */
export function defineAll(): void {
  defineFrameHeader();
  defineMessage();
  defineMessageList();
  defineComposer();
  defineConsentNotice();
  defineUnavailableNotice();
}

/** Library identity (kept for the project-graph placeholders). */
export const LIB_NAME = 'chat-widget';

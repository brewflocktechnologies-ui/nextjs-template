// English strings for the frame elements (P1.5-T01). Keys are `<element>.<purpose>`.
// Consent wording is a placeholder until Q-012 provides the legal text.
export const en = {
  'header.close': 'Close chat',
  'messages.label': 'Messages',
  'message.fromAgent': 'Agent',
  'message.fromVisitor': 'You',
  'composer.label': 'Message',
  'composer.placeholder': 'Type your message',
  'composer.send': 'Send',
  'consent.label': 'Consent',
  'consent.text':
    'To keep this conversation, the chat stores a visitor ID in your browser. (Placeholder wording.)',
  'consent.accept': 'Allow',
  'consent.decline': 'No thanks',
  'unavailable.text': 'Chat is unavailable right now. Please try again later.',
  greeting: 'Hi! Welcome to {brand}. How can we help?',
  'agent.reply': 'Thanks for your message. An agent will reply shortly.',
} as const;

export type StringKey = keyof typeof en;
export type StringTable = Readonly<Record<StringKey, string>>;

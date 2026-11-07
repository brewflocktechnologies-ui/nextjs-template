import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, within } from 'storybook/test';
import type { ByteflockMessageList } from './message-list';
import type { ChatMessage } from './shared';

const at = new Date('2026-11-07T09:30:00Z');
export const SAMPLE: ChatMessage[] = [
  { id: '1', from: 'agent', text: 'Hi! How can we help?', at },
  { id: '2', from: 'visitor', text: 'My parcel has not arrived.', at },
  {
    id: '3',
    from: 'agent',
    text: 'Sorry about that. Could you share the order number?',
    at,
  },
];

const meta: Meta = {
  title: 'Elements/MessageList',
  tags: ['a11y'],
  render: (args, { globals }) =>
    html`<byteflock-message-list
      .messages=${args.messages}
      locale=${globals.locale}
      style="block-size: 20rem"
    ></byteflock-message-list>`,
  args: { messages: SAMPLE },
};
export default meta;

export const ThreeMessages: StoryObj = {
  play: async ({ canvasElement }) => {
    const list = canvasElement.querySelector(
      'byteflock-message-list',
    ) as ByteflockMessageList;
    await list.updateComplete;
    const inner = within(list.shadowRoot as unknown as HTMLElement);
    await expect(inner.getByRole('list', { name: 'Messages' })).toBeVisible();
    await expect(inner.getAllByRole('listitem')).toHaveLength(3);
    const messages = (list.shadowRoot as ShadowRoot).querySelectorAll(
      'byteflock-message',
    );
    await expect(messages[1].getAttribute('from')).toBe('visitor');
  },
};

export const Empty: StoryObj = {
  args: { messages: [] },
  play: async ({ canvasElement }) => {
    const list = canvasElement.querySelector(
      'byteflock-message-list',
    ) as ByteflockMessageList;
    await list.updateComplete;
    await expect(
      within(list.shadowRoot as unknown as HTMLElement).queryAllByRole(
        'listitem',
      ),
    ).toHaveLength(0);
  },
};

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
    await expect(inner.getByRole('log', { name: 'Messages' })).toBeVisible();
    await expect(inner.getByRole('list')).toBeVisible();
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

const many = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    from: i % 2 ? 'visitor' : 'agent',
    text: `Message number ${i} with enough words to take some room in the list.`,
    at,
  }));

const scrollerOf = async (canvasElement: HTMLElement) => {
  const list = canvasElement.querySelector(
    'byteflock-message-list',
  ) as ByteflockMessageList;
  await list.updateComplete;
  await list.settled;
  const ol = (list.shadowRoot as ShadowRoot).querySelector(
    '.log',
  ) as HTMLElement;
  const atEnd = () => ol.scrollHeight - ol.scrollTop - ol.clientHeight <= 2;
  const add = async (m: ChatMessage) => {
    list.messages = [...list.messages, m];
    await list.updateComplete;
    await list.settled;
  };
  return { list, ol, atEnd, add };
};

/** A visitor reading older messages is not pulled down when an agent message arrives. */
export const ReadingHistoryStaysPut: StoryObj = {
  args: { messages: many(30) },
  play: async ({ canvasElement }) => {
    const { ol, atEnd, add } = await scrollerOf(canvasElement);
    await expect(atEnd()).toBe(true);
    ol.scrollTop = 0;
    await add({
      id: 'new-agent',
      from: 'agent',
      text: 'Are you still there?',
      at,
    });
    await expect(ol.scrollTop).toBe(0);
  },
};

/** At the end, new messages stay in view; the visitor's own message always scrolls. */
export const FollowsNewMessages: StoryObj = {
  args: { messages: many(30) },
  play: async ({ canvasElement }) => {
    const { ol, atEnd, add } = await scrollerOf(canvasElement);
    await add({ id: 'a1', from: 'agent', text: 'One more thing.', at });
    await expect(atEnd()).toBe(true);
    ol.scrollTop = 0;
    await add({ id: 'v1', from: 'visitor', text: 'Yes, here.', at });
    await expect(atEnd()).toBe(true);
  },
};

/** Messages are keyed by id: adding older history does not rebind existing elements. */
export const KeyedByMessageId: StoryObj = {
  play: async ({ canvasElement }) => {
    const { list } = await scrollerOf(canvasElement);
    const element = (id: string) =>
      [
        ...(list.shadowRoot as ShadowRoot).querySelectorAll(
          'byteflock-message',
        ),
      ].find(
        (el) => (el as unknown as { message: ChatMessage }).message.id === id,
      );
    const before = element('2');
    list.messages = [
      { id: '0', from: 'agent', text: 'Earlier message', at },
      ...list.messages,
    ];
    await list.updateComplete;
    await expect(element('2')).toBe(before);
  },
};

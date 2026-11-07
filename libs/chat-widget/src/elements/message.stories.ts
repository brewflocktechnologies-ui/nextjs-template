import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import type { ByteflockMessage } from './message';
import type { ChatMessage } from './shared';

const at = new Date('2026-11-07T09:30:00Z');

const meta: Meta = {
  title: 'Elements/Message',
  tags: ['a11y'],
  render: (args, { globals }) =>
    html`<byteflock-message
      .message=${args.message as ChatMessage}
      locale=${globals.locale}
    ></byteflock-message>`,
};
export default meta;

async function check(canvasElement: HTMLElement, who: string, text: string) {
  const el = canvasElement.querySelector(
    'byteflock-message',
  ) as ByteflockMessage;
  await el.updateComplete;
  const root = el.shadowRoot as ShadowRoot;
  await expect(root.textContent).toContain(text);
  await expect(root.querySelector('.sr-only')?.textContent).toContain(who);
  await expect(root.querySelector('time')?.getAttribute('datetime')).toBe(
    at.toISOString(),
  );
}

export const FromAgent: StoryObj = {
  args: {
    message: { id: '1', from: 'agent', text: 'Hi! How can we help?', at },
  },
  play: ({ canvasElement }) =>
    check(canvasElement, 'Agent', 'Hi! How can we help?'),
};

export const FromVisitor: StoryObj = {
  args: {
    message: { id: '2', from: 'visitor', text: 'Where is my order?', at },
  },
  play: async ({ canvasElement }) => {
    await check(canvasElement, 'You', 'Where is my order?');
    await expect(
      canvasElement.querySelector('byteflock-message')?.getAttribute('from'),
    ).toBe('visitor');
  },
};

export const LongText: StoryObj = {
  args: {
    message: {
      id: '3',
      from: 'agent',
      text: 'A very long word: supercalifragilisticexpialidocious-and-a-tracking-number-AB1234567890XYZ',
      at,
    },
  },
  play: ({ canvasElement }) =>
    check(canvasElement, 'Agent', 'supercalifragilistic'),
};

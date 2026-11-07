// The message list and composer together, under each tenant (P1.5-AC02, ARCH-001 §14.4 item 4):
// the same theme fixtures as ui-react's FilterDialog stories, applied by the same resolver.
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { TENANTS, type TenantId } from '../../.storybook/themes';
import { InMemoryTransport } from '../transport/in-memory';
import type { ByteflockComposer } from './composer';
import type { ByteflockMessageList } from './message-list';
import { SAMPLE } from './message-list.stories';

function conversation(locale: string) {
  const transport = new InMemoryTransport();
  void transport.connect();
  let list: ByteflockMessageList | null = null;
  transport.subscribe((e) => {
    if (list)
      list.messages = [
        ...list.messages,
        { id: e.id, from: 'agent', text: e.text, at: new Date(e.at) },
      ];
  });
  const onSend = (e: CustomEvent<{ text: string }>) => {
    list = (e.currentTarget as HTMLElement).querySelector(
      'byteflock-message-list',
    );
    if (!list) return;
    list.messages = [
      ...list.messages,
      {
        id: `v-${list.messages.length}`,
        from: 'visitor',
        text: e.detail.text,
        at: new Date(),
      },
    ];
    transport.send({ type: 'message', text: e.detail.text });
  };
  return html`<div
    style="display:flex;flex-direction:column;block-size:28rem;max-inline-size:24rem;border:1px solid var(--sem-color-outline)"
    @composer-send=${onSend}
  >
    <byteflock-frame-header
      brand-name="Support"
      locale=${locale}
    ></byteflock-frame-header>
    <byteflock-message-list
      style="flex:1"
      .messages=${SAMPLE}
      locale=${locale}
    ></byteflock-message-list>
    <byteflock-composer locale=${locale}></byteflock-composer>
  </div>`;
}

const meta: Meta = {
  title: 'Composites/Conversation',
  tags: ['a11y'],
  render: (_, { globals }) => conversation(String(globals.locale ?? 'en')),
};
export default meta;

async function sendAndGetReply(canvasElement: HTMLElement) {
  const composer = canvasElement.querySelector(
    'byteflock-composer',
  ) as ByteflockComposer;
  const list = canvasElement.querySelector(
    'byteflock-message-list',
  ) as ByteflockMessageList;
  await composer.updateComplete;
  await userEvent.click(
    within(composer.shadowRoot as unknown as HTMLElement).getByRole('textbox'),
  );
  await userEvent.keyboard('Is anyone there?{Enter}');
  const items = () =>
    within(list.shadowRoot as unknown as HTMLElement).getAllByRole('listitem');
  await waitFor(() => expect(items()).toHaveLength(4));
  // The in-memory transport answers after 300 ms.
  await waitFor(() => expect(items()).toHaveLength(5), { timeout: 2000 });
}

const tenantStory = (tenant: Exclude<TenantId, 'default'>): StoryObj => ({
  globals: { tenant },
  play: async ({ canvasElement }) => {
    const theme = TENANTS[tenant].theme;
    const appearance = theme.appearance.mode === 'dark' ? 'dark' : 'light';
    await expect(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--sem-color-primary')
        .trim(),
    ).toBe(theme.color[appearance].primary);
    await sendAndGetReply(canvasElement);
  },
});

export const Acme = tenantStory('acme');
export const Globex = tenantStory('globex');
export const Initech = tenantStory('initech');

/** P1.5-AC09: an Arabic locale renders right to left. */
export const RightToLeft: StoryObj = {
  globals: { locale: 'ar' },
  play: async () => {
    await expect(document.documentElement.dir).toBe('rtl');
    await expect(document.documentElement.lang).toBe('ar');
  },
};

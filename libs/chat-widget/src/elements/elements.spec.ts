// Unit tests (jsdom) for the composer's input-method guard and the message list's keyed rendering
// and follow-the-end scrolling. The Storybook stories cover the same behaviour in Chromium with
// real layout; here scroll metrics are stubbed.
import { defineComposer, type ByteflockComposer } from './composer';
import { defineMessageList, type ByteflockMessageList } from './message-list';
import type { ChatMessage } from './shared';

const at = new Date('2026-11-14T09:00:00Z');
const msg = (id: string, from: ChatMessage['from'] = 'agent'): ChatMessage => ({
  id,
  from,
  text: `message ${id}`,
  at,
});

beforeAll(() => {
  defineComposer();
  defineMessageList();
});
afterEach(() => document.body.replaceChildren());

describe('composer', () => {
  async function setup() {
    const el = document.createElement(
      'byteflock-composer',
    ) as ByteflockComposer;
    document.body.append(el);
    await el.updateComplete;
    const box = el.shadowRoot!.querySelector('textarea')!;
    const sent: string[] = [];
    el.addEventListener('composer-send', (e) => sent.push(e.detail.text));
    const press = (init: KeyboardEventInit) =>
      box.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, ...init }),
      );
    return { el, box, sent, press };
  }

  it('does not send on Enter while an input method is composing', async () => {
    const { box, sent, press } = await setup();
    box.value = 'にほんご';
    press({ key: 'Enter', isComposing: true });
    press({ key: 'Enter', keyCode: 229 });
    expect(sent).toEqual([]);
    press({ key: 'Enter' });
    expect(sent).toEqual(['にほんご']);
    expect(box.value).toBe('');
  });

  it('ignores Shift+Enter, empty text and a disabled composer', async () => {
    const { el, box, sent, press } = await setup();
    box.value = 'two lines';
    press({ key: 'Enter', shiftKey: true });
    box.value = '   ';
    press({ key: 'Enter' });
    el.disabled = true;
    await el.updateComplete;
    box.value = 'blocked';
    press({ key: 'Enter' });
    expect(sent).toEqual([]);
  });
});

describe('message list', () => {
  async function setup(messages: ChatMessage[]) {
    const el = document.createElement(
      'byteflock-message-list',
    ) as ByteflockMessageList;
    el.messages = messages;
    document.body.append(el);
    await el.updateComplete;
    // Let the first render's scroll finish before stubbing the metrics.
    await el.settled;
    const ol = el.shadowRoot!.querySelector<HTMLElement>('.log')!;
    // jsdom has no layout: a 1000 px tall list in a 200 px window.
    let top = 0;
    Object.defineProperty(ol, 'scrollHeight', {
      configurable: true,
      get: () => 1000,
    });
    Object.defineProperty(ol, 'clientHeight', {
      configurable: true,
      get: () => 200,
    });
    Object.defineProperty(ol, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (v: number) => (top = Math.min(v, 800)),
    });
    const add = async (m: ChatMessage) => {
      el.messages = [...el.messages, m];
      await el.updateComplete;
      await el.settled;
    };
    return { el, ol, add };
  }

  it('follows new messages when the visitor is at the end', async () => {
    const { ol, add } = await setup([msg('1'), msg('2')]);
    ol.scrollTop = 800;
    await add(msg('3'));
    expect(ol.scrollTop).toBe(800);
  });

  it('leaves a visitor reading older messages where they are', async () => {
    const { ol, add } = await setup([msg('1'), msg('2')]);
    ol.scrollTop = 100;
    await add(msg('3'));
    expect(ol.scrollTop).toBe(100);
  });

  it("always shows the visitor's own new message", async () => {
    const { ol, add } = await setup([msg('1'), msg('2')]);
    ol.scrollTop = 100;
    await add(msg('4', 'visitor'));
    expect(ol.scrollTop).toBe(800);
  });

  it('keys elements by message id when older messages are prepended', async () => {
    const { el } = await setup([msg('1'), msg('2')]);
    const byId = (id: string) =>
      [...el.shadowRoot!.querySelectorAll('byteflock-message')].find(
        (m) => (m as unknown as { message: ChatMessage }).message.id === id,
      );
    const before = byId('2');
    el.messages = [msg('0'), ...el.messages];
    await el.updateComplete;
    expect(byId('2')).toBe(before);
    expect(el.shadowRoot!.querySelectorAll('li')).toHaveLength(3);
  });
});

describe('accessibility details', () => {
  it('exposes the messages as a labelled log around a list', async () => {
    const el = document.createElement(
      'byteflock-message-list',
    ) as ByteflockMessageList;
    el.messages = [msg('1')];
    document.body.append(el);
    await el.updateComplete;
    const log = el.shadowRoot?.querySelector('[role="log"]');
    expect(log?.getAttribute('aria-label')).toBe('Messages');
    expect(log?.getAttribute('tabindex')).toBe('0');
    expect(log?.querySelector('ol > li')).not.toBeNull();
    expect(log?.hasAttribute('aria-live')).toBe(false);
  });

  it('sets the sender attribute before the first render', async () => {
    const list = document.createElement(
      'byteflock-message-list',
    ) as ByteflockMessageList;
    list.messages = [msg('1', 'visitor')];
    document.body.append(list);
    await list.updateComplete;
    const message = list.shadowRoot?.querySelector('byteflock-message');
    await (message as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    expect(message?.getAttribute('from')).toBe('visitor');
  });

  it('limits the composer to 2000 characters', async () => {
    const el = document.createElement(
      'byteflock-composer',
    ) as ByteflockComposer;
    document.body.append(el);
    await el.updateComplete;
    expect(
      el.shadowRoot?.querySelector('textarea')?.getAttribute('maxlength'),
    ).toBe('2000');
  });
});

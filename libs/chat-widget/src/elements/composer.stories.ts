import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { ByteflockComposer } from './composer';

const shadow = (el: Element) => within(el.shadowRoot as unknown as HTMLElement);

const meta: Meta = {
  title: 'Elements/Composer',
  tags: ['a11y'],
  render: (_, { globals }) =>
    html`<byteflock-composer locale=${globals.locale}></byteflock-composer>`,
};
export default meta;

export const Default: StoryObj = {
  play: async ({ canvasElement }) => {
    const composer = canvasElement.querySelector(
      'byteflock-composer',
    ) as ByteflockComposer;
    await composer.updateComplete;
    const onSend = fn();
    canvasElement.addEventListener('composer-send', (e) =>
      onSend((e as CustomEvent).detail),
    );
    const box = shadow(composer).getByRole('textbox', { name: 'Message' });

    await userEvent.click(box);
    await userEvent.keyboard('   {Enter}');
    await expect(onSend).not.toHaveBeenCalled();

    (box as HTMLTextAreaElement).value = '';
    await userEvent.keyboard('Where is my order?{Enter}');
    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith({ text: 'Where is my order?' }),
    );
    await expect(box).toHaveValue('');
  },
};

/** Shift+Enter adds a line instead of sending; the Send button sends. */
export const MultiLine: StoryObj = {
  play: async ({ canvasElement }) => {
    const composer = canvasElement.querySelector(
      'byteflock-composer',
    ) as ByteflockComposer;
    await composer.updateComplete;
    const onSend = fn();
    canvasElement.addEventListener('composer-send', (e) =>
      onSend((e as CustomEvent).detail),
    );
    await userEvent.click(
      shadow(composer).getByRole('textbox', { name: 'Message' }),
    );
    await userEvent.keyboard('line one{Shift>}{Enter}{/Shift}line two');
    await expect(onSend).not.toHaveBeenCalled();
    await userEvent.click(
      shadow(composer).getByRole('button', { name: 'Send' }),
    );
    await expect(onSend).toHaveBeenLastCalledWith({
      text: 'line one\nline two',
    });
  },
};

export const Disabled: StoryObj = {
  render: () => html`<byteflock-composer disabled></byteflock-composer>`,
  play: async ({ canvasElement }) => {
    const composer = canvasElement.querySelector(
      'byteflock-composer',
    ) as ByteflockComposer;
    await composer.updateComplete;
    await expect(
      shadow(composer).getByRole('textbox', { name: 'Message' }),
    ).toBeDisabled();
    await expect(
      shadow(composer).getByRole('button', { name: 'Send' }),
    ).toBeDisabled();
  },
};

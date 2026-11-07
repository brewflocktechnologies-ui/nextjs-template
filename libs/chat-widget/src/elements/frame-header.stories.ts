import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { ByteflockFrameHeader } from './frame-header';

const meta: Meta = {
  title: 'Elements/FrameHeader',
  tags: ['a11y'],
  render: (args, { globals }) =>
    html`<byteflock-frame-header
      brand-name=${args.brandName}
      locale=${globals.locale}
    ></byteflock-frame-header>`,
  args: { brandName: 'Acme Corp' },
};
export default meta;

export const Default: StoryObj = {
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector(
      'byteflock-frame-header',
    ) as ByteflockFrameHeader;
    await header.updateComplete;
    const inner = within(header.shadowRoot as unknown as HTMLElement);
    await expect(
      inner.getByRole('heading', { name: 'Acme Corp' }),
    ).toBeVisible();
    const onClose = fn();
    canvasElement.addEventListener('frame-close', onClose);
    inner.getByRole('button', { name: 'Close chat' }).focus();
    await userEvent.keyboard('{Enter}');
    await expect(onClose).toHaveBeenCalledTimes(1);
  },
};

export const LongBrandName: StoryObj = {
  args: { brandName: 'A Particularly Long Company Name For Support Pty Ltd' },
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector(
      'byteflock-frame-header',
    ) as ByteflockFrameHeader;
    await header.updateComplete;
    await expect(
      within(header.shadowRoot as unknown as HTMLElement).getByRole('button', {
        name: 'Close chat',
      }),
    ).toBeVisible();
  },
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, within } from 'storybook/test';
import type { ByteflockUnavailableNotice } from './unavailable-notice';

const meta: Meta = {
  title: 'Elements/UnavailableNotice',
  tags: ['a11y'],
  render: (_, { globals }) =>
    html`<byteflock-unavailable-notice
      locale=${globals.locale}
    ></byteflock-unavailable-notice>`,
};
export default meta;

export const Default: StoryObj = {
  play: async ({ canvasElement }) => {
    const notice = canvasElement.querySelector(
      'byteflock-unavailable-notice',
    ) as ByteflockUnavailableNotice;
    await notice.updateComplete;
    await expect(
      within(notice.shadowRoot as unknown as HTMLElement).getByRole('status'),
    ).toHaveTextContent('Chat is unavailable right now.');
  },
};

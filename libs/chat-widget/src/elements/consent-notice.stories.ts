import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { ByteflockConsentNotice } from './consent-notice';

const meta: Meta = {
  title: 'Elements/ConsentNotice',
  tags: ['a11y'],
  render: (args) =>
    html`<byteflock-consent-notice
      locale=${args.locale}
    ></byteflock-consent-notice>`,
  args: { locale: 'en' },
};
export default meta;

async function setup(canvasElement: HTMLElement) {
  const notice = canvasElement.querySelector(
    'byteflock-consent-notice',
  ) as ByteflockConsentNotice;
  await notice.updateComplete;
  const onDecision = fn();
  canvasElement.addEventListener('consent-decision', (e) =>
    onDecision((e as CustomEvent).detail),
  );
  return {
    inner: within(notice.shadowRoot as unknown as HTMLElement),
    onDecision,
  };
}

export const Default: StoryObj = {
  play: async ({ canvasElement }) => {
    const { inner, onDecision } = await setup(canvasElement);
    await userEvent.click(inner.getByRole('button', { name: 'Allow' }));
    await expect(onDecision).toHaveBeenLastCalledWith({ granted: true });
    inner.getByRole('button', { name: 'No thanks' }).focus();
    await userEvent.keyboard('{Enter}');
    await expect(onDecision).toHaveBeenLastCalledWith({ granted: false });
  },
};

export const AustralianEnglish: StoryObj = {
  args: { locale: 'en-AU' },
  play: async ({ canvasElement }) => {
    const { inner } = await setup(canvasElement);
    await expect(inner.getByText(/recognise you/)).toBeVisible();
  },
};

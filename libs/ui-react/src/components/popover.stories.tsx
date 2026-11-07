import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from './ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from './ui/popover';

const meta: Meta = { title: 'Components/Popover', tags: ['a11y'] };
export default meta;

const render = (defaultOpen = false) => (
  <Popover defaultOpen={defaultOpen}>
    <PopoverTrigger render={<Button variant="outline" />}>
      Customer details
    </PopoverTrigger>
    <PopoverContent>
      <PopoverTitle>Ava Nguyen</PopoverTitle>
      <PopoverDescription>Customer since 2024, plan Pro.</PopoverDescription>
    </PopoverContent>
  </Popover>
);

export const Default: StoryObj = {
  render: () => render(),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const trigger = within(canvasElement).getByRole('button', {
      name: 'Customer details',
    });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await expect(
      await body.findByText('Customer since 2024, plan Pro.'),
    ).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        body.queryByText('Customer since 2024, plan Pro.'),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const Open: StoryObj = {
  render: () => render(true),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole('dialog', {
        name: 'Ava Nguyen',
      }),
    ).toBeVisible();
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '../components/ui/popover';

/** PoC-B item 1: a dialog with a nested popover. Esc closes the innermost layer only. */
const meta: Meta = { title: 'PoC/Dialog with nested popover' };
export default meta;

export const Default: StoryObj = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>Open settings</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conversation settings</DialogTitle>
          <DialogDescription>
            Choose how this conversation is routed.
          </DialogDescription>
        </DialogHeader>
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>
            Choose priority
          </PopoverTrigger>
          <PopoverContent>
            <PopoverTitle>Priority</PopoverTitle>
            <PopoverDescription>High, normal or low.</PopoverDescription>
          </PopoverContent>
        </Popover>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Open settings' });

    await userEvent.click(trigger);
    const dialog = await body.findByRole('dialog', {
      name: 'Conversation settings',
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Choose priority' }),
    );
    await expect(await body.findByText('High, normal or low.')).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(body.queryByText('High, normal or low.')).not.toBeInTheDocument(),
    );
    await expect(
      body.getByRole('dialog', { name: 'Conversation settings' }),
    ).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        body.queryByRole('dialog', { name: 'Conversation settings' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

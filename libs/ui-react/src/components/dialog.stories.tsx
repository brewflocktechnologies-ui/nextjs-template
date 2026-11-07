import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from './ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from './ui/popover';

/** PoC-B item 1: a dialog with a nested popover. Esc closes the innermost layer only. */
const meta: Meta = { title: 'Components/Dialog', tags: ['a11y'] };
export default meta;

export const WithNestedPopover: StoryObj = {
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

/** Opened by keyboard, closed by its own button; focus returns to the trigger. */
export const Default: StoryObj = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>Close conversation</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Close this conversation?</DialogTitle>
          <DialogDescription>The customer can reopen it.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const trigger = within(canvasElement).getByRole('button', {
      name: 'Close conversation',
    });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await body.findByRole('dialog', {
      name: 'Close this conversation?',
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() =>
      expect(body.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

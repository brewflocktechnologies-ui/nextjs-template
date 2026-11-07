import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';

/** A tooltip on a button. Keyboard focus shows it; Esc hides it. */
const meta: Meta = { title: 'PoC/Tooltip' };
export default meta;

export const Default: StoryObj = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" />}>
          Assign conversation
        </TooltipTrigger>
        <TooltipContent>Assign this conversation to an agent</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', {
      name: 'Assign conversation',
    });

    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await expect(
      await body.findByText('Assign this conversation to an agent'),
    ).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        body.queryByText('Assign this conversation to an agent'),
      ).not.toBeInTheDocument(),
    );
    await expect(trigger).toHaveFocus();
  },
};

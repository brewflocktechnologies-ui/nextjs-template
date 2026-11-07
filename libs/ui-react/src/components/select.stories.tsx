import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const STATUSES = ['Open', 'Pending', 'Closed'];

function StatusSelect({ disabled = false }: { disabled?: boolean }) {
  return (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="status">Status</Label>
      <Select defaultValue="Open" disabled={disabled}>
        <SelectTrigger id="status" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const meta: Meta = { title: 'Components/Select', tags: ['a11y'] };
export default meta;

export const Default: StoryObj = {
  render: () => <StatusSelect />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('combobox', { name: 'Status' });
    await expect(trigger).toHaveTextContent('Open');

    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    await body.findByRole('listbox');
    await waitFor(() =>
      expect(body.getByRole('option', { name: 'Open' })).toHaveFocus(),
    );
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(body.getByRole('option', { name: 'Pending' })).toHaveFocus(),
    );
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(trigger).toHaveTextContent('Pending'));
    await waitFor(() =>
      expect(body.queryByRole('listbox')).not.toBeInTheDocument(),
    );
  },
};

export const Disabled: StoryObj = {
  render: () => <StatusSelect disabled />,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('combobox', { name: 'Status' }),
    ).toHaveAttribute('data-disabled');
  },
};

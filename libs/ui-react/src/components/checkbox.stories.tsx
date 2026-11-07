import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['a11y'],
  args: { id: 'unread', onCheckedChange: fn() },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox {...args} />
      <Label htmlFor={args.id}>Only unread</Label>
    </div>
  ),
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const box = within(canvasElement).getByRole('checkbox', {
      name: 'Only unread',
    });
    await userEvent.tab();
    await expect(box).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect(box).toBeChecked();
    await userEvent.keyboard(' ');
    await expect(box).not.toBeChecked();
    await expect(args.onCheckedChange).toHaveBeenCalledTimes(2);
  },
};

export const Checked: Story = {
  args: { defaultChecked: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('checkbox', { name: 'Only unread' }),
    ).toBeChecked();
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    const box = within(canvasElement).getByRole('checkbox', {
      name: 'Only unread',
    });
    await expect(box).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(box, { pointerEventsCheck: 0 });
    await expect(args.onCheckedChange).not.toHaveBeenCalled();
  },
};

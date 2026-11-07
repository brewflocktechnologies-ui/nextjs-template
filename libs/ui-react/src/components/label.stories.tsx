import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';

const meta = {
  title: 'Components/Label',
  component: Label,
  tags: ['a11y'],
} satisfies Meta<typeof Label>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="subject">Subject</Label>
      <Input id="subject" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Subject'));
    await expect(
      canvas.getByRole('textbox', { name: 'Subject' }),
    ).toHaveFocus();
  },
};

export const WithCheckbox: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="notify" />
      <Label htmlFor="notify">Notify me</Label>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Notify me'));
    await expect(
      canvas.getByRole('checkbox', { name: 'Notify me' }),
    ).toBeChecked();
  },
};

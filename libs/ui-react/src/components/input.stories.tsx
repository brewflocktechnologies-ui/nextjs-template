import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Input } from './ui/input';
import { Label } from './ui/label';

const meta = {
  title: 'Components/Input',
  component: Input,
  tags: ['a11y'],
  args: { id: 'customer-email', placeholder: 'name@example.com' },
  render: (args) => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor={args.id}>Customer email</Label>
      <Input {...args} />
    </div>
  ),
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', {
      name: 'Customer email',
    });
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await userEvent.keyboard('ava@example.com');
    await expect(input).toHaveValue('ava@example.com');
  },
};

export const Invalid: Story = {
  args: { 'aria-invalid': true, defaultValue: 'not-an-email' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('textbox', { name: 'Customer email' }),
    ).toHaveAttribute('aria-invalid', 'true');
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('textbox', { name: 'Customer email' }),
    ).toBeDisabled();
  },
};

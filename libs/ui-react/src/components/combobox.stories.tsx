import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from './ui/combobox';
import { Label } from './ui/label';
import { ASSIGNEES } from '../sample-data';

/** PoC-B item 2: a searchable combobox over 50 agents and teams, fully keyboard operable. */
const meta: Meta = { title: 'Components/Combobox', tags: ['a11y'] };
export default meta;

export const Default: StoryObj = {
  render: () => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="assignee">Assign to</Label>
      <Combobox items={ASSIGNEES}>
        <ComboboxInput id="assignee" placeholder="Search agents and teams" />
        <ComboboxContent>
          <ComboboxEmpty>No match.</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const input = canvas.getByRole('combobox', { name: 'Assign to' });

    await userEvent.click(input);
    await userEvent.type(input, 'tech');
    await waitFor(() => expect(body.getAllByRole('option')).toHaveLength(1));
    await expect(
      body.getByRole('option', { name: 'Technical team' }),
    ).toBeVisible();

    await userEvent.clear(input);
    await userEvent.type(input, 'smith');
    await waitFor(() =>
      expect(body.getAllByRole('option').length).toBeGreaterThan(1),
    );
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() =>
      expect((input as HTMLInputElement).value).toMatch(/ Smith$/),
    );
    // The list closes with a transition; wait for it to leave the document.
    await waitFor(() =>
      expect(body.queryByRole('listbox')).not.toBeInTheDocument(),
    );
  },
};

export const NoMatch: StoryObj = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('combobox', {
      name: 'Assign to',
    });
    await userEvent.type(input, 'zzz');
    await expect(
      await within(canvasElement.ownerDocument.body).findByText('No match.'),
    ).toBeVisible();
  },
};

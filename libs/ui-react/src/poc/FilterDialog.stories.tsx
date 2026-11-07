import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../components/ui/button';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '../components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { AGENTS } from './data';

const NAMES = AGENTS.map((a) => a.name);

/** PoC-B item 3: a searchable multi-select filter inside a dialog; the selection survives reopening. */
function FilterDialog() {
  const [selected, setSelected] = useState<string[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const anchor = useComboboxAnchor();
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        Filter by agent{selected.length ? ` (${selected.length})` : ''}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filter conversations</DialogTitle>
          <DialogDescription>
            Show conversations assigned to these agents.
          </DialogDescription>
        </DialogHeader>
        <Label htmlFor="agents">Agents</Label>
        <Combobox
          multiple
          items={NAMES}
          value={selected}
          onValueChange={(v) => setSelected(v as string[])}
          open={listOpen}
          onOpenChange={setListOpen}
        >
          <ComboboxChips ref={anchor}>
            <ComboboxValue>
              {(values: string[]) => (
                <>
                  {values.map((v) => (
                    <ComboboxChip key={v} aria-label={v}>
                      {v}
                    </ComboboxChip>
                  ))}
                  <ComboboxChipsInput
                    id="agents"
                    placeholder="Search agents"
                    onKeyDown={(event) => {
                      // PoC-B finding: with the list closed, Base UI's Escape clears every chip.
                      // In a dialog, Escape must close the dialog and keep the selection.
                      if (event.key === 'Escape' && !listOpen)
                        event.preventBaseUIHandler();
                    }}
                  />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxContent anchor={anchor}>
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
      </DialogContent>
    </Dialog>
  );
}

const meta: Meta = { title: 'PoC/Filter dialog (multi-select)' };
export default meta;

export const Default: StoryObj = {
  render: () => <FilterDialog />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(
      canvas.getByRole('button', { name: /Filter by agent/ }),
    );
    const dialog = await body.findByRole('dialog', {
      name: 'Filter conversations',
    });
    const input = within(dialog).getByRole('combobox', { name: 'Agents' });

    // Keyboard selection: type to filter, arrow to the option, Enter to add it as a chip.
    await userEvent.type(input, 'Ava Smith');
    await body.findByRole('option', { name: 'Ava Smith' });
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(
        within(dialog).getAllByRole('button', { name: 'Remove' }),
      ).toHaveLength(1),
    );
    await userEvent.type(input, 'Ben Patel');
    await body.findByRole('option', { name: 'Ben Patel' });
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(
        within(dialog).getAllByRole('button', { name: 'Remove' }),
      ).toHaveLength(2),
    );
    await userEvent.keyboard('{Escape}'); // closes the list
    await userEvent.keyboard('{Escape}'); // closes the dialog
    await waitFor(() =>
      expect(
        body.queryByRole('dialog', { name: 'Filter conversations' }),
      ).not.toBeInTheDocument(),
    );
    await expect(
      canvas.getByRole('button', { name: 'Filter by agent (2)' }),
    ).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole('button', { name: 'Filter by agent (2)' }),
    );
    const reopened = await body.findByRole('dialog', {
      name: 'Filter conversations',
    });
    await expect(within(reopened).getByText('Ava Smith')).toBeInTheDocument();
    await expect(within(reopened).getByText('Ben Patel')).toBeInTheDocument();

    // Remove a chip with the keyboard: focus its remove button and press Enter.
    const removeButtons = within(reopened).getAllByRole('button', {
      name: 'Remove',
    });
    removeButtons[0].focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(within(reopened).queryByText('Ava Smith')).not.toBeInTheDocument(),
    );
  },
};

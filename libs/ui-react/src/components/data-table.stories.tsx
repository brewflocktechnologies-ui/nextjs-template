import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AGENTS, type Agent } from '../sample-data';
import { DataTable, type DataTableColumn } from './data-table';

const COLUMNS: DataTableColumn<Agent>[] = [
  { key: 'name', header: 'Agent' },
  { key: 'team', header: 'Team' },
  { key: 'open', header: 'Open conversations' },
  { key: 'status', header: 'Status' },
];

const meta: Meta = { title: 'Components/DataTable', tags: ['a11y'] };
export default meta;

export const Default: StoryObj = {
  render: () => (
    <DataTable caption="Agents" columns={COLUMNS} data={AGENTS.slice(0, 12)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const firstAgent = () =>
      within(canvas.getAllByRole('row')[1]).getAllByRole('cell')[0].textContent;

    // Sort by agent name with the keyboard.
    canvas.getByRole('button', { name: /^Agent/ }).focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(canvas.getAllByRole('columnheader')[0]).toHaveAttribute(
        'aria-sort',
        'ascending',
      ),
    );
    const ascending = firstAgent();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(canvas.getAllByRole('columnheader')[0]).toHaveAttribute(
        'aria-sort',
        'descending',
      ),
    );
    await expect(firstAgent()).not.toBe(ascending);

    // Hide the Team column from the Columns popover.
    await userEvent.click(canvas.getByRole('button', { name: 'Columns' }));
    await userEvent.click(await body.findByRole('checkbox', { name: 'Team' }));
    await waitFor(() =>
      expect(
        canvas.queryByRole('columnheader', { name: /Team/ }),
      ).not.toBeInTheDocument(),
    );
    await expect(canvas.getAllByRole('columnheader')).toHaveLength(3);
  },
};

export const Empty: StoryObj = {
  render: () => <DataTable caption="Agents" columns={COLUMNS} data={[]} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('row')).toHaveLength(1);
  },
};

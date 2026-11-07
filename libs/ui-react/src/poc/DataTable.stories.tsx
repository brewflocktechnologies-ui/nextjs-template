import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '../components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { AGENTS, type Agent } from './data';

// TanStack Table 9.3: row models and sort functions are registered as features.
const features = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});
const column = createColumnHelper<typeof features, Agent>();
const columns = column.columns([
  column.accessor('name', { header: 'Agent' }),
  column.accessor('team', { header: 'Team' }),
  column.accessor('open', { header: 'Open conversations' }),
  column.accessor('status', { header: 'Status' }),
]);

/** PoC-B item 4: a data table (TanStack Table 9) with sortable columns and column visibility. */
function AgentTable() {
  const table = useTable({
    features,
    columns,
    data: AGENTS.slice(0, 12),
  });

  return (
    <div className="grid gap-3">
      <Popover>
        <PopoverTrigger
          render={<Button variant="outline" className="justify-self-start" />}
        >
          Columns
        </PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Visible columns</PopoverTitle>
          {table.getAllLeafColumns().map((col) => (
            <div key={col.id} className="flex items-center gap-2">
              <Checkbox
                id={`col-${col.id}`}
                checked={col.getIsVisible()}
                onCheckedChange={(checked) =>
                  col.toggleVisibility(checked === true)
                }
              />
              <Label htmlFor={`col-${col.id}`}>
                {String(col.columnDef.header)}
              </Label>
            </div>
          ))}
        </PopoverContent>
      </Popover>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : 'none'
                    }
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {sorted === 'asc' ? (
                        <ArrowUpIcon />
                      ) : sorted === 'desc' ? (
                        <ArrowDownIcon />
                      ) : (
                        <ArrowUpDownIcon />
                      )}
                    </Button>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const meta: Meta = { title: 'PoC/Data table' };
export default meta;

export const Default: StoryObj = {
  render: () => <AgentTable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const firstAgent = () =>
      within(canvas.getAllByRole('row')[1]).getAllByRole('cell')[0].textContent;

    // Sort by agent name with the keyboard.
    const sortButton = canvas.getByRole('button', { name: /^Agent/ });
    sortButton.focus();
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
    const teamToggle = await body.findByRole('checkbox', { name: 'Team' });
    await userEvent.click(teamToggle);
    await waitFor(() =>
      expect(
        canvas.queryByRole('columnheader', { name: /Team/ }),
      ).not.toBeInTheDocument(),
    );
    await expect(canvas.getAllByRole('columnheader')).toHaveLength(3);
  },
};

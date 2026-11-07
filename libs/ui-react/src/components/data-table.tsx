'use client';

import { useMemo, type ReactNode } from 'react';
import {
  columnVisibilityFeature,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from './ui/popover';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

// TanStack Table 9: row models and sort functions are registered as features.
const features = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

export interface DataTableColumn<T> {
  /** Property of the row shown in this column; also the column id. */
  key: keyof T & string;
  header: string;
  /** Custom cell content; defaults to the value as text. */
  cell?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Accessible name of the table, shown to screen readers only. */
  caption: string;
  /** Label of the column-visibility button. */
  columnsLabel?: string;
}

/**
 * Sortable data table with a column-visibility menu (ARCH-001 §11.3), on TanStack Table 9.
 * Headers are buttons, so sorting works by keyboard; `aria-sort` reflects the state.
 */
export function DataTable<T extends object>({
  columns,
  data,
  caption,
  columnsLabel = 'Columns',
}: DataTableProps<T>) {
  const columnDefs = useMemo(
    () =>
      columns.map(
        (c) =>
          ({
            id: c.key,
            accessorKey: c.key,
            header: c.header,
            cell: c.cell
              ? ({ row }: { row: { original: T } }) => c.cell?.(row.original)
              : ({ getValue }: { getValue: () => unknown }) =>
                  String(getValue() ?? ''),
          }) as unknown as ColumnDef<typeof features, T>,
      ),
    [columns],
  );
  const table = useTable({ features, columns: columnDefs, data });

  return (
    <div className="grid gap-3">
      <Popover>
        <PopoverTrigger
          render={<Button variant="outline" className="justify-self-start" />}
        >
          {columnsLabel}
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
        <TableCaption className="sr-only">{caption}</TableCaption>
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

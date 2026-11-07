'use client';

import { useId, useState } from 'react';
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

export interface FilterDialogProps {
  /** Options to choose from. */
  items: string[];
  /** Selected options (controlled). */
  value: string[];
  onValueChange: (value: string[]) => void;
  /** Trigger text; the count of selected options is appended. */
  triggerLabel: string;
  title: string;
  description: string;
  /** Label of the search field. */
  fieldLabel: string;
  placeholder?: string;
  emptyText?: string;
}

/**
 * Searchable multi-select inside a dialog (P1.4-T06, PoC-B item 3). The selection survives closing
 * and reopening, chips are removable by keyboard, and Escape with the list closed closes the dialog
 * instead of clearing the selection.
 */
export function FilterDialog({
  items,
  value,
  onValueChange,
  triggerLabel,
  title,
  description,
  fieldLabel,
  placeholder,
  emptyText = 'No match.',
}: FilterDialogProps) {
  const [listOpen, setListOpen] = useState(false);
  const anchor = useComboboxAnchor();
  const inputId = useId();
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        {triggerLabel}
        {value.length ? ` (${value.length})` : ''}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Label htmlFor={inputId}>{fieldLabel}</Label>
        <Combobox
          multiple
          items={items}
          value={value}
          onValueChange={(v) => onValueChange(v as string[])}
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
                    id={inputId}
                    placeholder={placeholder}
                    onKeyDown={(event) => {
                      // With the list closed, Base UI's Escape clears every chip (PoC-B finding).
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
            <ComboboxEmpty>{emptyText}</ComboboxEmpty>
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

'use client';
// Form fields for the theme editor, built from ui-react components only (P1.6-AC10).
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@byteflock/ui-react';

export const humanise = (s: string) =>
  s
    .replace(/([A-Z])/g, ' $1')
    .replace(/-/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

export function EnumField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ColourField({
  id,
  label,
  value,
  problems,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  problems: string[];
  onChange: (value: string) => void;
}) {
  const hint = `${id}-hint`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-7 shrink-0 rounded-md border"
          style={{
            backgroundColor: /^#[0-9a-f]{6}$/.test(value)
              ? value
              : 'transparent',
          }}
        />
        <Input
          id={id}
          value={value}
          spellCheck={false}
          aria-invalid={problems.length ? true : undefined}
          aria-describedby={problems.length ? hint : undefined}
          onChange={(e) => onChange(e.target.value.trim().toLowerCase())}
        />
      </div>
      {problems.length ? (
        <p id={hint} className="text-xs text-destructive">
          {problems.join(' ')}
        </p>
      ) : null}
    </div>
  );
}

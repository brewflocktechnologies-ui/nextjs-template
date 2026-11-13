'use client';
// Import from design tokens: a tenant's DTCG file → the theme being edited (importDtcg). The file is
// read in the browser and never uploaded; the result only fills the form. Saving and publishing go
// through the usual draft and publish routes, which validate again on the server.
import { useState } from 'react';
import { importDtcg, type Theme, type ValidationError } from '@byteflock/theme';
import { Input, Label } from '@byteflock/ui-react';

/** Larger token files are refused before parsing. */
export const MAX_TOKEN_FILE_BYTES = 256 * 1024;

type Outcome =
  | { kind: 'imported'; message: string; warnings: string[] }
  | { kind: 'failed'; message: string; errors: string[] };

const describeError = (e: ValidationError) =>
  `${e.path === '/' ? 'File' : e.path}: ${e.message}`;

/** Reads and imports one file. Exported for unit tests. */
export async function importTokenFile(
  file: File,
  base: Theme,
): Promise<{ outcome: Outcome; theme?: Theme }> {
  if (file.size > MAX_TOKEN_FILE_BYTES) {
    return {
      outcome: {
        kind: 'failed',
        message: `${file.name} is larger than 256 KB.`,
        errors: [],
      },
    };
  }
  let doc: unknown;
  try {
    doc = JSON.parse(await file.text());
  } catch {
    return {
      outcome: {
        kind: 'failed',
        message: `${file.name} is not valid JSON.`,
        errors: [],
      },
    };
  }
  const r = importDtcg(doc, { base });
  if (!r.ok) {
    return {
      outcome: {
        kind: 'failed',
        message: `${file.name} was not imported. Nothing in the form changed.`,
        errors: r.errors.map(describeError),
      },
    };
  }
  const colours = r.colorsImported === 1 ? 'colour' : 'colours';
  return {
    theme: r.theme,
    outcome: {
      kind: 'imported',
      message: `Imported ${r.colorsImported} ${colours} from ${file.name}. Check the preview, then save a draft or publish.`,
      warnings: r.warnings,
    },
  };
}

export function ImportTokensPanel({
  base,
  disabled,
  onImport,
}: {
  /** The theme in the editor: it supplies everything the file does not set. */
  base: Theme;
  disabled?: boolean;
  onImport: (theme: Theme) => void;
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const { outcome: next, theme } = await importTokenFile(file, base);
    if (theme) onImport(theme);
    setOutcome(next);
    // Lets the same file be picked again after it is edited.
    input.value = '';
  }

  return (
    <section
      aria-labelledby="import-heading"
      className="grid gap-2 rounded-lg border p-4"
      data-testid="import-tokens"
    >
      <h2 id="import-heading" className="text-lg font-medium">
        Import from design tokens
      </h2>
      <p id="import-hint" className="text-sm text-muted-foreground">
        A DTCG .json file that follows the theme structure, for example
        color.light.primary. Values the file does not set stay as they are.
      </p>
      <div className="grid max-w-md gap-1.5">
        <Label htmlFor="import-tokens-file">Token file</Label>
        <Input
          id="import-tokens-file"
          type="file"
          accept=".json,application/json"
          aria-describedby="import-hint"
          disabled={disabled}
          onChange={onChange}
        />
      </div>
      <div role="status" aria-live="polite" data-testid="import-status">
        {outcome ? (
          <div className="grid gap-1 text-sm">
            <p
              className={
                outcome.kind === 'failed' ? 'text-destructive' : undefined
              }
            >
              {outcome.message}
            </p>
            {outcome.kind === 'failed' && outcome.errors.length > 0 ? (
              <ul
                className="list-disc pl-5 text-destructive"
                data-testid="import-errors"
              >
                {outcome.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
            {outcome.kind === 'imported' && outcome.warnings.length > 0 ? (
              <details data-testid="import-warnings">
                <summary className="cursor-pointer text-muted-foreground">
                  {outcome.warnings.length}{' '}
                  {outcome.warnings.length === 1 ? 'note' : 'notes'}
                </summary>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {outcome.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

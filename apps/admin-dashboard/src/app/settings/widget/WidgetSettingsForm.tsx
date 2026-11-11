'use client';
// Allowed origins editor (P1.6-T12, ENDP-02a). One origin per line; validated here and again on
// the server.
import { useEffect, useMemo, useState } from 'react';
import { Button, Label, Textarea } from '@byteflock/ui-react';
import { MAX_ORIGINS, originProblems } from '../../../lib/origins';

const parse = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export function WidgetSettingsForm({
  initial,
  apiQuery = '',
}: {
  initial: string[];
  apiQuery?: string;
}) {
  const [text, setText] = useState(initial.join('\n'));
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const problems = useMemo(() => originProblems(parse(text)), [text]);
  // Marks the form interactive once hydrated (tests wait for it before typing).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/widget/origins${apiQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origins: parse(text) }),
    });
    const data = (await res.json()) as { problems?: string[] };
    setStatus(
      res.ok
        ? 'Saved. Embedded widgets pick this up on their next page load.'
        : `Not saved: ${(data.problems ?? []).join(' ')}`,
    );
    setBusy(false);
  }

  return (
    <form
      className="grid max-w-xl gap-3"
      aria-label="Allowed origins"
      data-hydrated={hydrated || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Label htmlFor="origins">
        Allowed origins (one per line, up to {MAX_ORIGINS})
      </Label>
      <Textarea
        id="origins"
        rows={6}
        value={text}
        spellCheck={false}
        aria-invalid={problems.length ? true : undefined}
        aria-describedby="origins-help"
        onChange={(e) => setText(e.target.value)}
      />
      <p id="origins-help" className="text-sm text-muted-foreground">
        Exact origins with scheme and port, for example{' '}
        <code>https://www.example.com</code>. No paths or wildcards.
      </p>
      {problems.length ? (
        <ul className="list-disc pl-5 text-sm" data-testid="origin-problems">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      <div>
        <Button type="submit" disabled={busy || problems.length > 0}>
          Save
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        data-testid="widget-status"
        className="min-h-6 text-sm"
      >
        {status}
      </p>
    </form>
  );
}

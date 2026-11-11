'use client';
// Tenant dashboard config editor (P2.1-T09, CONFIG-01..05), built from ui-react components only
// (P1.6-AC10). Checked here with the same guard as the server, which checks again on save.
import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Input, Label, Textarea } from '@byteflock/ui-react';
import {
  NOTICE_MAX,
  TITLE_MAX,
  guardTenantConfig,
  type TenantConfig,
} from '../../../lib/tenant-config';
import { EnumField } from '../theme/fields';

export function DashboardSettingsForm({
  initial,
  locales,
}: {
  initial: TenantConfig;
  locales: string[];
}) {
  const [config, setConfig] = useState<TenantConfig>(initial);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const result = useMemo(() => guardTenantConfig(config), [config]);
  const problems = result.ok ? [] : result.errors;
  // Marks the form interactive once hydrated (tests wait for it before typing).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  async function save() {
    setBusy(true);
    const res = await fetch('/api/tenant-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    const data = (await res.json()) as { problems?: string[]; error?: string };
    setStatus(
      res.ok
        ? 'Saved. Navigation and pages update on the next page load.'
        : `Not saved: ${(data.problems ?? [data.error ?? 'unknown error']).join(' ')}`,
    );
    setBusy(false);
  }

  const setModule = (key: keyof TenantConfig['modules'], value: boolean) =>
    setConfig((c) => ({ ...c, modules: { ...c.modules, [key]: value } }));
  const setHome = (key: keyof TenantConfig['home'], value: string) =>
    setConfig((c) => ({ ...c, home: { ...c.home, [key]: value } }));

  return (
    <form
      className="grid max-w-xl gap-5"
      aria-label="Dashboard settings"
      data-hydrated={hydrated || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">Modules</legend>
        <div className="flex items-center gap-2">
          <Checkbox
            id="module-theme"
            checked={config.modules.themeEditor}
            onCheckedChange={(v) => setModule('themeEditor', v === true)}
          />
          <Label htmlFor="module-theme">Theme editor</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="module-widget"
            checked={config.modules.widgetSettings}
            onCheckedChange={(v) => setModule('widgetSettings', v === true)}
          />
          <Label htmlFor="module-widget">Widget settings</Label>
        </div>
      </fieldset>

      <EnumField
        id="default-locale"
        label="Default locale"
        value={config.defaults.locale}
        options={locales}
        onChange={(locale) =>
          setConfig((c) => ({ ...c, defaults: { ...c.defaults, locale } }))
        }
      />

      <div className="grid gap-1.5">
        <Label htmlFor="home-title">
          Home title (up to {TITLE_MAX} characters)
        </Label>
        <Input
          id="home-title"
          value={config.home.title}
          aria-invalid={config.home.title.length > TITLE_MAX || undefined}
          onChange={(e) => setHome('title', e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="home-notice">
          Home notice (up to {NOTICE_MAX} characters)
        </Label>
        <Textarea
          id="home-notice"
          rows={3}
          value={config.home.notice}
          aria-invalid={config.home.notice.length > NOTICE_MAX || undefined}
          onChange={(e) => setHome('notice', e.target.value)}
        />
      </div>

      {problems.length ? (
        <ul className="list-disc pl-5 text-sm" data-testid="config-problems">
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
        data-testid="dashboard-status"
        className="min-h-6 text-sm"
      >
        {status}
      </p>
    </form>
  );
}

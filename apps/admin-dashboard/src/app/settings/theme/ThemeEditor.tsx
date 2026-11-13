'use client';
// Theme editor (P1.6-T07): tenant-editable fields, live schema and contrast checks, a preview in
// the real widget frame, Save draft, Publish and Rollback.
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  APPEARANCE_MODES,
  COLOR_ROLES,
  DENSITIES,
  ELEVATIONS,
  FONT_FAMILIES,
  LAUNCHER_ICONS,
  LAUNCHER_POSITIONS,
  LAUNCHER_SHAPES,
  RADII,
  TYPE_SCALES,
  checkContrastPolicy,
  validateTheme,
  type ColorRole,
  type PolicyViolation,
  type Theme,
} from '@byteflock/theme';
import { Button, Input, Label } from '@byteflock/ui-react';
import { qk } from '../../../lib/query/qk';
import { ColourField, EnumField, humanise } from './fields';
import { PreviewFrame } from './PreviewFrame';

type Revisions = { revisions: number[]; current: number | null };

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: res.ok, data: (await res.json()) as Record<string, unknown> };
}

const describe = (v: PolicyViolation) => {
  const [fg, bg] = v.pair.split('/');
  return `${humanise(fg)} on ${humanise(bg)}: ${v.ratio.toFixed(2)}:1, needs ${v.required}:1.`;
};

export function ThemeEditor({
  tenantId,
  initial,
  widgetKey,
  widgetOrigin,
  dashboardOrigin,
  apiQuery = '',
  readOnly = false,
}: {
  tenantId: string;
  initial: Theme;
  widgetKey: string | null;
  widgetOrigin: string;
  dashboardOrigin: string;
  /** Appended to every API URL: '' for a tenant user, '?tenantId=t_x' for a super admin (P2.1-T10). */
  apiQuery?: string;
  /** True for users who may read but not change the theme (agents); actions are disabled. */
  readOnly?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [colourSet, setColourSet] = useState<'light' | 'dark'>(
    initial.appearance.mode === 'dark' ? 'dark' : 'light',
  );
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  // Marks the form interactive once hydrated (tests wait for it before typing).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const queryClient = useQueryClient();
  const revisionsKey = qk(tenantId, 'theme', 'revisions');
  const revisions = useQuery<Revisions>({
    queryKey: revisionsKey,
    queryFn: async () =>
      (await fetch(`/api/theme/revisions${apiQuery}`)).json(),
    enabled: widgetKey !== null,
  });

  const validation = useMemo(() => validateTheme(theme), [theme]);
  const violations = useMemo(
    () => (validation.ok ? checkContrastPolicy(validation.value) : []),
    [validation],
  );
  const schemaErrors = validation.ok ? [] : validation.errors;
  const canPublish =
    !readOnly &&
    widgetKey !== null &&
    validation.ok &&
    violations.length === 0 &&
    !busy;

  const update = (change: (t: Theme) => Theme) => setTheme((t) => change(t));
  const setColour = (role: ColorRole, value: string) =>
    update((t) => ({
      ...t,
      color: {
        ...t.color,
        [colourSet]: { ...t.color[colourSet], [role]: value },
      },
    }));

  /** Problems shown next to a colour field: schema errors and the contrast pairs it leads. */
  const colourProblems = (role: ColorRole) => [
    ...schemaErrors
      .filter((e) => e.path === `/color/${colourSet}/${role}`)
      .map(() => 'Use #rrggbb in lower case.'),
    ...violations
      .filter(
        (v) => v.appearance === colourSet && v.pair.startsWith(`${role}/`),
      )
      .map(describe),
  ];

  async function saveDraft(): Promise<boolean> {
    const r = await post(`/api/theme/draft${apiQuery}`, { theme });
    setStatus(
      r.ok ? 'Draft saved.' : `Draft not saved: ${String(r.data.error)}`,
    );
    return r.ok;
  }

  async function onSave() {
    setBusy(true);
    await saveDraft();
    setBusy(false);
  }

  async function onPublish() {
    setBusy(true);
    if (await saveDraft()) {
      const r = await post(`/api/theme/publish${apiQuery}`);
      setStatus(
        r.ok
          ? `Published revision ${String(r.data.revision)}.`
          : `Not published: ${String(r.data.error)}`,
      );
      await queryClient.invalidateQueries({ queryKey: revisionsKey });
    }
    setBusy(false);
  }

  async function onRollback(revision: number) {
    setBusy(true);
    const r = await post(`/api/theme/rollback${apiQuery}`, { revision });
    setStatus(
      r.ok
        ? `The widget now uses revision ${revision}.`
        : `Rollback failed: ${String(r.data.error)}`,
    );
    await queryClient.invalidateQueries({ queryKey: revisionsKey });
    setBusy(false);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <form
        className="grid gap-6"
        aria-label="Theme"
        data-hydrated={hydrated || undefined}
        onSubmit={(e) => e.preventDefault()}
      >
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-lg font-medium">Brand and layout</legend>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="brand-name">Brand name</Label>
            <Input
              id="brand-name"
              value={theme.brand.name}
              maxLength={60}
              onChange={(e) =>
                update((t) => ({
                  ...t,
                  brand: { ...t.brand, name: e.target.value },
                }))
              }
            />
          </div>
          <EnumField
            id="appearance"
            label="Appearance"
            value={theme.appearance.mode}
            options={APPEARANCE_MODES}
            onChange={(mode) => update((t) => ({ ...t, appearance: { mode } }))}
          />
          <EnumField
            id="font"
            label="Font"
            value={theme.typography.fontFamily}
            options={FONT_FAMILIES}
            onChange={(fontFamily) =>
              update((t) => ({
                ...t,
                typography: { ...t.typography, fontFamily },
              }))
            }
          />
          <EnumField
            id="scale"
            label="Text size"
            value={theme.typography.scale}
            options={TYPE_SCALES}
            onChange={(scale) =>
              update((t) => ({ ...t, typography: { ...t.typography, scale } }))
            }
          />
          <EnumField
            id="radius"
            label="Corner radius"
            value={theme.shape.radius}
            options={RADII}
            onChange={(radius) => update((t) => ({ ...t, shape: { radius } }))}
          />
          <EnumField
            id="elevation"
            label="Elevation"
            value={theme.elevation}
            options={ELEVATIONS}
            onChange={(elevation) => update((t) => ({ ...t, elevation }))}
          />
          <EnumField
            id="density"
            label="Density"
            value={theme.density}
            options={DENSITIES}
            onChange={(density) => update((t) => ({ ...t, density }))}
          />
          <EnumField
            id="launcher-position"
            label="Launcher position"
            value={theme.launcher.position}
            options={LAUNCHER_POSITIONS}
            onChange={(position) =>
              update((t) => ({ ...t, launcher: { ...t.launcher, position } }))
            }
          />
          <EnumField
            id="launcher-shape"
            label="Launcher shape"
            value={theme.launcher.shape}
            options={LAUNCHER_SHAPES}
            onChange={(shape) =>
              update((t) => ({ ...t, launcher: { ...t.launcher, shape } }))
            }
          />
          <EnumField
            id="launcher-icon"
            label="Launcher icon"
            value={theme.launcher.icon}
            options={LAUNCHER_ICONS}
            onChange={(icon) =>
              update((t) => ({ ...t, launcher: { ...t.launcher, icon } }))
            }
          />
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="mb-2 text-lg font-medium">Colours</legend>
          <div className="max-w-xs">
            <EnumField
              id="colour-set"
              label="Colour set"
              value={colourSet}
              options={['light', 'dark'] as const}
              onChange={setColourSet}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {COLOR_ROLES.map((role) => (
              <ColourField
                key={`${colourSet}-${role}`}
                id={`colour-${role}`}
                label={humanise(role)}
                value={theme.color[colourSet][role]}
                problems={colourProblems(role)}
                onChange={(v) => setColour(role, v)}
              />
            ))}
          </div>
        </fieldset>

        <section aria-labelledby="checks-heading" className="grid gap-2">
          <h2 id="checks-heading" className="text-lg font-medium">
            Checks
          </h2>
          {schemaErrors.length === 0 && violations.length === 0 ? (
            <p data-testid="checks-ok">
              The theme is valid and meets the contrast rules.
            </p>
          ) : (
            <ul className="list-disc pl-5 text-sm" data-testid="violations">
              {schemaErrors.map((e) => (
                <li key={`s-${e.path}`}>
                  {e.path || 'Theme'}: {e.message}
                </li>
              ))}
              {violations.map((v) => (
                <li key={`${v.appearance}-${v.pair}`}>
                  {humanise(v.appearance)} colours. {describe(v)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={readOnly || busy || !validation.ok}
            onClick={onSave}
          >
            Save draft
          </Button>
          <Button type="button" disabled={!canPublish} onClick={onPublish}>
            Publish
          </Button>
        </div>
        {readOnly ? (
          <p
            role="note"
            data-testid="read-only-note"
            className="text-sm text-muted-foreground"
          >
            Read only: only a tenant admin can change these settings.
          </p>
        ) : null}
        <p
          role="status"
          aria-live="polite"
          data-testid="editor-status"
          className="min-h-6 text-sm"
        >
          {status}
        </p>
      </form>

      <aside className="grid content-start gap-6">
        <section aria-labelledby="preview-heading" className="grid gap-2">
          <h2 id="preview-heading" className="text-lg font-medium">
            Preview
          </h2>
          {widgetKey ? (
            <PreviewFrame
              theme={validation.ok ? validation.value : null}
              appearance={colourSet}
              widgetKey={widgetKey}
              widgetOrigin={widgetOrigin}
              dashboardOrigin={dashboardOrigin}
              apiQuery={apiQuery}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              This tenant has no widget.
            </p>
          )}
        </section>
        {widgetKey ? (
          <section aria-labelledby="revisions-heading" className="grid gap-2">
            <h2 id="revisions-heading" className="text-lg font-medium">
              Published revisions
            </h2>
            <ul className="grid gap-2" data-testid="revisions">
              {(revisions.data?.revisions ?? []).map((rev) => (
                <li
                  key={rev}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    Revision {rev}
                    {rev === revisions.data?.current ? ' (in use)' : ''}
                  </span>
                  {rev !== revisions.data?.current ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={readOnly || busy}
                      onClick={() => onRollback(rev)}
                    >
                      Use revision {rev}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

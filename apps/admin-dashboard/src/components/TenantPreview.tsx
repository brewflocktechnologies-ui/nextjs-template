// A scoped tenant preview (P2.1-T11, ADR-013, D-25). On the super admin's pages the chrome stays on
// the platform design; this container shows what one tenant's published design looks like without
// touching the page. Its variables come from a nonce'd <style> that targets only
// [data-tenant-preview="<tenantId>"] (never :root, html or body), so nothing outside the container
// changes. The bridge mapping (--primary, --radius, ...) is declared on the same selector in
// libs/ui-react, so the shared components inside restyle too.
import { headers } from 'next/headers';
import { Button, Input, Label, ThemeStyleTag } from '@byteflock/ui-react';
import { NONCE_HEADER } from '../server/proxy-allowlist';
import { publishedThemeView } from '../server/tenant-theme';

/**
 * The caller must already have authorized the tenant for the platform context (the platform pages
 * call getTenant first); this component only renders.
 */
export async function TenantPreview({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  const view = await publishedThemeView(tenantId);
  return (
    <section
      aria-labelledby={`preview-label-${tenantId}`}
      data-tenant-preview={tenantId}
      data-testid="tenant-preview"
      className="mb-6 grid gap-3 rounded-lg border bg-background p-4 font-sans text-foreground shadow-md"
    >
      <ThemeStyleTag
        vars={view.vars}
        darkVars={view.darkVars}
        nonce={nonce}
        selector={`[data-tenant-preview="${tenantId}"]`}
      />
      <p
        id={`preview-label-${tenantId}`}
        data-testid="preview-label"
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Preview: {tenantName}
      </p>
      <p className="text-sm text-muted-foreground">
        The tenant&apos;s published design on sample components. The rest of
        this page stays on the platform design.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button">Primary action</Button>
        <Button type="button" variant="outline">
          Secondary
        </Button>
      </div>
      <div className="grid max-w-xs gap-1.5">
        <Label htmlFor={`preview-input-${tenantId}`}>Sample field</Label>
        <Input
          id={`preview-input-${tenantId}`}
          placeholder="Type here"
          readOnly
        />
      </div>
      {view.invalid ? (
        <p role="note" className="text-sm">
          This tenant&apos;s stored theme failed validation, so the platform
          default design is shown.
        </p>
      ) : null}
    </section>
  );
}

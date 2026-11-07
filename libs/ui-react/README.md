# @byteflock/ui-react

React components for the admin dashboard: shadcn components on Base UI (ADR-006), themed only through the semantic design tokens, so every tenant theme restyles them. Stories are the spec and the test (ADR-008).

## Using it in an app

Every React app's CSS entry has these four lines, in this order:

```css
@import 'tailwindcss';
@import '@byteflock/design-tokens/css/semantic.css';
@import '@byteflock/ui-react/shadcn-bridge.css';
@source '../../../libs/ui-react/src'; /* path from the CSS file to this library */
```

Then import components from the package root only:

```tsx
import { Button, FilterDialog, ThemeStyleTag } from '@byteflock/ui-react';
```

Apply a tenant theme by rendering its resolved variables once, near the root:

```tsx
<ThemeStyleTag vars={resolvedVars} nonce={nonce} />
```

`ThemeStyleTag` takes the output of `resolveTheme()` (resolved on the server), never a raw theme document. It throws on a variable outside `RESOLVED_KEYS` or an unsafe value; the caller falls back to the default theme at the data layer. `ThemeProvider` and `useTheme()` give components the same variables, and `themeAttributes(theme)` returns the `data-appearance` and `data-density` attributes for the root element.

## The token rule

Components use only shadcn's variable names (`bg-primary`, `text-muted-foreground`, `rounded-lg`). `src/generated/shadcn-bridge.css` maps each one to a `--sem-*` variable. It is generated from `src/theme/shadcn-map.json`:

```bash
pnpm nx run @byteflock/ui-react:build         # regenerate after editing the map
pnpm nx run @byteflock/ui-react:build:check   # fails when the committed bridge is stale (in pnpm verify)
```

A test fails if a component uses a shadcn colour that is not mapped, or if the map points at a variable the design tokens do not define. Never write a raw colour in a component.

The bridge also scales Tailwind's spacing by `--sem-density-factor` and its text sizes by `--sem-type-scale`, and makes `dark:` utilities follow `data-appearance`.

## Adding a component

1. `pnpm dlx shadcn@<exact version> add <component>` in `libs/ui-react`, then `node scripts/relative-imports.mjs`. Check the diff: in PoC-B shadcn once added an unrelated `cn` package from npm.
2. Add `'use client'` at the top if it uses Base UI or React hooks; the dashboard renders Server Components.
3. Wrap it in `src/components/` only if the wrapper adds behaviour (see `data-table.tsx`).
4. Write `<name>.stories.tsx` beside it: a default story, its states, a keyboard `play()` test and `tags: ['a11y']`.
5. Export it from `src/index.ts`.
6. Run `pnpm nx run @byteflock/ui-react:test-storybook`. Any axe violation fails the run.

## Tenants in Storybook

`pnpm nx run @byteflock/ui-react:storybook` serves http://localhost:4600. The **Tenant** toolbar switches between the Acme, Globex and Initech fixtures from `@byteflock/theme` and the platform default; **Appearance** overrides light or dark. The decorator resolves the fixture with `resolveTheme`, renders `ThemeStyleTag` and sets the attributes on `<html>`, so dialogs and popovers are themed too. The `Composites/FilterDialog` stories run under each tenant.

## Tests

| Command                                          | What runs                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `pnpm nx test @byteflock/ui-react`               | Theme adapter and bridge coverage (Vitest, jsdom)                                |
| `pnpm nx run @byteflock/ui-react:test-storybook` | Every story in Chromium: render, `play()` and axe                                |
| `A11Y_NEGATIVE=1 pnpm nx run …:test-storybook`   | Only `Checks/A11y negative`, which must fail; proves axe blocks                  |
| `pnpm nx lint @byteflock/ui-react`               | Also forbids `lit`, `next/headers`, `next/cache` and the `@byteflock/theme` root |

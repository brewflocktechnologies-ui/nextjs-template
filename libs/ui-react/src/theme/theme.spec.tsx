import { renderToStaticMarkup } from 'react-dom/server';
import {
  RESOLVED_KEYS,
  type ResolvedVars,
  type Theme,
} from '@byteflock/theme/guard';
import { resolveTheme } from '@byteflock/theme/resolve';
import acme from '@byteflock/theme/fixtures/valid/acme-light.json';
import {
  ThemeProvider,
  ThemeStyleTag,
  themeAttributes,
  themeCss,
  useTheme,
} from './index';

const vars = resolveTheme(acme as Theme, { appearance: 'light' });

describe('theme adapter (P1.4-T03)', () => {
  it('renders one <style> with every resolved variable on :root and the nonce', () => {
    const html = renderToStaticMarkup(
      <ThemeStyleTag vars={vars} nonce="n0nce" />,
    );
    expect(html).toMatch(
      /^<style nonce="n0nce" data-byteflock-theme="">:root:root\{/,
    );
    for (const key of RESOLVED_KEYS) expect(html).toContain(`${key}:`);
    expect(html).toContain(
      `--sem-color-primary:${vars['--sem-color-primary']}`,
    );
  });

  it('brand scope emits only colour roles', () => {
    const css = themeCss(vars, 'brand');
    expect(css).toContain('--sem-color-primary:');
    expect(css).not.toContain('--sem-radius-md');
  });

  it('P1.4-AC03 throws on a key outside RESOLVED_KEYS', () => {
    const crafted = { ...vars, '--sem-x;}': 'red' } as unknown as ResolvedVars;
    expect(() =>
      renderToStaticMarkup(<ThemeStyleTag vars={crafted} />),
    ).toThrow(/unknown variable/);
  });

  it('throws on a value that could leave the declaration', () => {
    for (const bad of [
      'red;}body{x:y',
      'url(https://e.test)',
      '</style>',
      'a/*b',
    ])
      expect(() =>
        themeCss({ ...vars, '--sem-color-primary': bad } as ResolvedVars),
      ).toThrow(/unsafe value/);
  });

  it('useTheme returns the provider vars and throws outside a provider', () => {
    function Probe() {
      return <span>{useTheme()['--sem-color-primary']}</span>;
    }
    expect(
      renderToStaticMarkup(
        <ThemeProvider vars={vars}>
          <Probe />
        </ThemeProvider>,
      ),
    ).toBe(`<span>${vars['--sem-color-primary']}</span>`);
    expect(() => renderToStaticMarkup(<Probe />)).toThrow(/ThemeProvider/);
  });

  it('themeAttributes exposes appearance and density', () => {
    expect(themeAttributes(acme as Theme)).toEqual({
      'data-appearance': acme.appearance.mode,
      'data-density': acme.density,
    });
  });
});

describe('system appearance (P1.6, D-20)', () => {
  it('emits the dark variables under prefers-color-scheme for data-appearance="system"', () => {
    const dark = resolveTheme(acme as Theme, { appearance: 'dark' });
    const html = renderToStaticMarkup(
      <ThemeStyleTag vars={vars} darkVars={dark} nonce="n" />,
    );
    expect(html).toContain(
      '@media (prefers-color-scheme: dark){:root:root[data-appearance="system"]{',
    );
    expect(html).toContain(
      `--sem-color-primary:${dark['--sem-color-primary']}`,
    );
    expect(html.match(/<style/g)).toHaveLength(1);
  });
});

describe('scoped selector (P2.1-T11)', () => {
  const PREVIEW = '[data-tenant-preview="t_acme"]';

  it('defaults to :root:root, unchanged', () => {
    expect(themeCss(vars)).toMatch(/^:root:root\{/);
    expect(themeCss(vars, 'all', undefined, ':root:root')).toBe(themeCss(vars));
  });

  it('scopes every variable to one tenant preview container and never touches :root', () => {
    const css = themeCss(vars, 'all', undefined, PREVIEW);
    expect(css.startsWith(`${PREVIEW}{`)).toBe(true);
    expect(css).not.toContain(':root');
    expect(css).not.toContain('html');
    expect(css).not.toContain('body');
    for (const key of RESOLVED_KEYS) expect(css).toContain(`${key}:`);
  });

  it('renders the selector and the nonce on the one <style>', () => {
    const html = renderToStaticMarkup(
      <ThemeStyleTag vars={vars} nonce="n0nce" selector={PREVIEW} />,
    );
    expect(html).toMatch(
      /^<style nonce="n0nce" data-byteflock-theme="">\[data-tenant-preview="t_acme"\]\{/,
    );
  });

  it('a system-appearance tenant follows the OS inside the container', () => {
    const dark = resolveTheme(acme as Theme, { appearance: 'dark' });
    const css = themeCss(vars, 'all', dark, PREVIEW);
    expect(css).toContain(`@media (prefers-color-scheme: dark){${PREVIEW}{`);
    expect(css).not.toContain('data-appearance');
  });

  it('refuses any other selector', () => {
    for (const bad of [
      'html',
      'body',
      ':root',
      '*',
      '[data-tenant-preview]',
      '[data-tenant-preview="t_acme"] body',
      '[data-tenant-preview="t_acme"],html',
      '[data-tenant-preview="T_ACME"]',
      '[data-tenant-preview="t_a"]',
      '[data-tenant-preview="t_acme"]{}body{x:y}',
      '',
    ])
      expect(() => themeCss(vars, 'all', undefined, bad)).toThrow(
        /refusing selector/,
      );
  });
});

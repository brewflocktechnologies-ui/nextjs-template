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

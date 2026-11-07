// Build-only Vite plugin: collapses whitespace and comments inside Lit `css` templates that have no
// interpolations (P1.5-T07). Vite minifies JavaScript but leaves template-literal contents alone, so
// without this every element ships its stylesheet with source indentation.
import type { Plugin } from 'vite';

const CSS_TEMPLATE = /\bcss`([^`$]*)`/g;

export function minifyCssTemplate(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

export function minifyLitCss(): Plugin {
  return {
    name: 'byteflock:minify-lit-css',
    apply: 'build',
    transform(code, id) {
      if (!/\.ts$/.test(id) || !code.includes('css`')) return null;
      return {
        code: code.replace(
          CSS_TEMPLATE,
          (_, body: string) => `css\`${minifyCssTemplate(body)}\``,
        ),
        map: null,
      };
    },
  };
}

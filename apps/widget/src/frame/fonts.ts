// Curated fonts (P1.5-T05). Every family's faces are declared here; only the tenant's selected
// family is registered and loaded. Files are served from this origin (`font-src 'self'`) by
// scripts/vendor-fonts.mjs. The FontFace API is used because the frame CSP blocks <style>.
import type { Theme } from '@byteflock/theme/guard';

type Family = Theme['typography']['fontFamily'];

/** CSS family name (matches the design-token font stacks) and file prefix per family. */
export const FONT_FACES: Record<
  Exclude<Family, 'system'>,
  { name: string; dir: string; file: string }
> = {
  inter: { name: 'Inter', dir: 'inter', file: 'inter' },
  roboto: { name: 'Roboto', dir: 'roboto', file: 'roboto' },
  'source-sans': {
    name: 'Source Sans 3',
    dir: 'source-sans',
    file: 'source-sans-3',
  },
  'noto-sans': { name: 'Noto Sans', dir: 'noto-sans', file: 'noto-sans' },
};

const WEIGHTS = ['400', '600'] as const;

/** Font file URLs for a family; every URL is under /v1/ (P1.5-T08). */
export function fontUrls(family: Family): string[] {
  if (family === 'system') return [];
  const f = FONT_FACES[family];
  return WEIGHTS.map(
    (w) => `/v1/fonts/${f.dir}/${f.file}-latin-${w}-normal.woff2`,
  );
}

/** Registers and loads the selected family. Failures fall back to the stack silently. */
export async function loadFont(family: Family): Promise<void> {
  if (family === 'system' || !('fonts' in document)) return;
  const { name } = FONT_FACES[family];
  const faces = fontUrls(family).map(
    (url, i) => new FontFace(name, `url(${url})`, { weight: WEIGHTS[i] }),
  );
  for (const face of faces) document.fonts.add(face);
  await Promise.allSettled(faces.map((f) => f.load()));
}

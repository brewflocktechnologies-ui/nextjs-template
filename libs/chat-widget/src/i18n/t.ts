// Tiny translation helper (P1.5-T01): exact locale, then its language, then English.
import { en, type StringKey } from './strings.en';
import { enAU } from './strings.en-AU';

const TABLES: Record<string, Partial<Record<StringKey, string>>> = {
  en,
  'en-au': enAU,
};

/** Languages written right to left (P1.5-T05). */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

export function t(
  key: StringKey,
  locale = 'en',
  params: Record<string, string> = {},
): string {
  const tag = locale.toLowerCase();
  const text =
    TABLES[tag]?.[key] ?? TABLES[tag.split('-')[0]]?.[key] ?? en[key];
  return text.replace(/\{(\w+)\}/g, (m, name: string) => params[name] ?? m);
}

/** Text direction for a BCP 47 tag. */
export function dirOf(locale: string): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.has(locale.split('-')[0].toLowerCase()) ? 'rtl' : 'ltr';
}

export type { StringKey } from './strings.en';

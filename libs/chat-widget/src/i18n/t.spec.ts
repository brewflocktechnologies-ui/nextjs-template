import { dirOf, t } from './t';

describe('t() and dirOf() (P1.5-T01, T05)', () => {
  it('falls back from the exact locale to the language to English', () => {
    expect(t('consent.text', 'en-AU')).toContain('recognise');
    expect(t('consent.text', 'en-US')).not.toContain('recognise');
    expect(t('composer.send', 'en-AU')).toBe('Send');
    expect(t('composer.send', 'ar')).toBe('Send');
  });

  it('fills parameters', () => {
    expect(t('greeting', 'en', { brand: 'Acme' })).toBe(
      'Hi! Welcome to Acme. How can we help?',
    );
  });

  it('marks ar, he, fa and ur as right to left', () => {
    for (const tag of ['ar', 'he-IL', 'fa', 'ur-PK'])
      expect(dirOf(tag)).toBe('rtl');
    for (const tag of ['en', 'en-AU', 'de']) expect(dirOf(tag)).toBe('ltr');
  });
});

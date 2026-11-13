import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_THEME } from '../src/lib/default-theme';
import {
  ImportTokensPanel,
  MAX_TOKEN_FILE_BYTES,
  importTokenFile,
} from '../src/app/settings/theme/ImportTokensPanel';

// jsdom's File has no text(); browsers do. Only name, size and text() are read.
const file = (content: string, name = 'brand.tokens.json') =>
  ({
    name,
    size: content.length,
    text: async () => content,
  }) as unknown as File;

describe('import from design tokens (theme editor)', () => {
  it('imports colours onto the theme being edited', async () => {
    const r = await importTokenFile(
      file(
        JSON.stringify({
          color: {
            light: { primary: { $type: 'color', $value: '#123456' } },
          },
        }),
      ),
      DEFAULT_THEME,
    );
    expect(r.outcome.kind).toBe('imported');
    expect(r.outcome.message).toContain(
      'Imported 1 colour from brand.tokens.json',
    );
    expect(r.theme?.color.light.primary).toBe('#123456');
    expect(r.theme?.color.dark).toEqual(DEFAULT_THEME.color.dark);
  });

  it('refuses invalid JSON without a theme', async () => {
    const r = await importTokenFile(file('{ nope'), DEFAULT_THEME);
    expect(r.theme).toBeUndefined();
    expect(r.outcome).toMatchObject({
      kind: 'failed',
      message: 'brand.tokens.json is not valid JSON.',
    });
  });

  it('refuses a file that fails the contract and lists why', async () => {
    const r = await importTokenFile(
      file(JSON.stringify({ shape: { radius: { $value: '13px' } } })),
      DEFAULT_THEME,
    );
    expect(r.theme).toBeUndefined();
    expect(r.outcome.kind).toBe('failed');
    if (r.outcome.kind === 'failed')
      expect(r.outcome.errors.some((e) => e.startsWith('/shape/radius'))).toBe(
        true,
      );
  });

  it('refuses files over the size limit before reading them', async () => {
    const r = await importTokenFile(
      file(' '.repeat(MAX_TOKEN_FILE_BYTES + 1)),
      DEFAULT_THEME,
    );
    expect(r.outcome.message).toContain('larger than 256 KB');
  });

  it('renders a labelled file input', () => {
    const html = renderToStaticMarkup(
      <ImportTokensPanel base={DEFAULT_THEME} onImport={() => undefined} />,
    );
    expect(html).toContain('Import from design tokens');
    expect(html).toContain('for="import-tokens-file"');
    expect(html).toContain('type="file"');
  });
});

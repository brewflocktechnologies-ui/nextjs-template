// Theme manifest v1 (D-30, ADR-014; docs/architecture/design-tokens/design-token-contract-proposal.md §2).
// One per theme: its DTCG source files, which files make each mode, and which of its own tokens
// fills each contract path. Emitted to schema/theme-manifest.v1.json by scripts/emit-schema.mjs.
// No relative imports, so Node can run it directly.
import { Type, type Static } from '@sinclair/typebox';

const SourcePath = Type.String({
  minLength: 1,
  maxLength: 200,
  // Relative paths with forward slashes; no drive letters, backslashes or control characters.
  pattern: '^(?![a-zA-Z]:)(?!/)[^\\\\\\u0000-\\u001f]+$',
});

const TokenPath = Type.String({
  minLength: 1,
  maxLength: 200,
  // Dot-separated token path; `{mode}` may stand for the mode name (light or dark).
  pattern: '^[A-Za-z0-9_$@{}-]+(\\.[A-Za-z0-9_$@{}-]+)*$',
});

export const ThemeManifestV1 = Type.Object(
  {
    $schema: Type.Optional(Type.String({ maxLength: 200 })),
    manifestVersion: Type.Literal(1),
    themeId: Type.String({ pattern: '^[a-z][a-z0-9-]{1,40}$' }),
    displayName: Type.String({
      minLength: 1,
      maxLength: 60,
      pattern: '^[^\\u0000-\\u001f\\u007f]+$',
    }),
    version: Type.String({
      pattern: '^(0|[1-9]\\d{0,5})\\.(0|[1-9]\\d{0,5})\\.(0|[1-9]\\d{0,5})$',
    }),
    contract: Type.Literal('platform-semantic-v1'),
    source: Type.Object(
      {
        format: Type.Literal('dtcg-2025.10'),
        producer: Type.Optional(
          Type.Object(
            {
              name: Type.String({ minLength: 1, maxLength: 80 }),
              version: Type.String({ minLength: 1, maxLength: 40 }),
            },
            { additionalProperties: false },
          ),
        ),
        files: Type.Array(SourcePath, {
          minItems: 1,
          maxItems: 200,
          uniqueItems: true,
        }),
      },
      { additionalProperties: false },
    ),
    modes: Type.Object(
      {
        light: Type.Array(SourcePath, { minItems: 1, maxItems: 200 }),
        dark: Type.Array(SourcePath, { minItems: 1, maxItems: 200 }),
      },
      { additionalProperties: false },
    ),
    semanticMap: Type.Record(
      Type.String({ pattern: '^[a-z0-9-]+(\\.[a-z0-9-]+)*$', maxLength: 80 }),
      TokenPath,
    ),
    extensions: Type.Optional(
      Type.Object(
        {
          namespace: Type.String({ pattern: '^[a-z][a-z0-9-]{1,40}$' }),
          tokens: Type.Record(
            Type.String({ pattern: '^[a-z][a-z0-9-]{0,40}$' }),
            TokenPath,
          ),
        },
        { additionalProperties: false },
      ),
    ),
    fonts: Type.Optional(
      Type.Array(Type.String({ pattern: '^[a-z0-9-]{1,40}$' }), {
        maxItems: 20,
        uniqueItems: true,
      }),
    ),
  },
  {
    $id: 'https://byteflock.dev/schemas/theme-manifest.v1.json',
    title: 'Theme manifest v1',
    additionalProperties: false,
  },
);

export type ThemeManifest = Static<typeof ThemeManifestV1>;

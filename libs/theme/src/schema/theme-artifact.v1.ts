// Theme artifact v1 (ADR-014, ADR-016): the only thing the dashboard and the widget read. Variable
// names are contract variables (`--sem-*`) or theme extensions (`--ext-<themeId>-*`); values were
// serialised by the generator from typed canonical values. Emitted to schema/theme-artifact.v1.json.
// No relative imports, so Node can run it directly.
import { Type, type Static } from '@sinclair/typebox';

// Values never contain characters that could end a declaration or open a rule (THEME-03 safety).
const Value = Type.String({
  minLength: 1,
  maxLength: 300,
  pattern: '^[^;{}<>\\\\\\n\\r]+$',
});

const SemVars = Type.Record(
  Type.String({ pattern: '^--sem-[a-z0-9-]+$' }),
  Value,
);
const ExtVars = Type.Record(
  Type.String({ pattern: '^--ext-[a-z][a-z0-9-]*$' }),
  Value,
);

export const ThemeArtifactV1 = Type.Object(
  {
    artifactVersion: Type.Literal(1),
    themeId: Type.String({ pattern: '^[a-z][a-z0-9-]{1,40}$' }),
    version: Type.String({ pattern: '^\\d+\\.\\d+\\.\\d+$' }),
    contract: Type.Literal('platform-semantic-v1'),
    modes: Type.Object(
      { light: SemVars, dark: SemVars },
      { additionalProperties: false },
    ),
    extensions: Type.Object(
      { light: ExtVars, dark: ExtVars },
      { additionalProperties: false },
    ),
  },
  {
    $id: 'https://byteflock.dev/schemas/theme-artifact.v1.json',
    title: 'Theme artifact v1',
    additionalProperties: false,
  },
);

export type ThemeArtifact = Static<typeof ThemeArtifactV1>;

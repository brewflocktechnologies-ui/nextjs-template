import fs from 'node:fs';
import path from 'node:path';
import Ajv2020Module from 'ajv/dist/2020';
import { ThemeV1 } from './schema/theme.v1';
import { validateAndResolve, validateTheme } from './validate';
import { fixtures, fixturesDir, libRoot } from './test-helpers';

// Ajv ships CommonJS; take the class whichever way the interop presents it.
const Ajv2020 = ((Ajv2020Module as unknown as { default?: unknown }).default ??
  Ajv2020Module) as new (opts: object) => {
  compile: (
    schema: object,
  ) => ((doc: unknown) => boolean) & { errors?: unknown[] | null };
};
const emitted = JSON.parse(
  fs.readFileSync(path.join(libRoot, 'schema', 'theme.v1.json'), 'utf8'),
);
const ajvValidate = new Ajv2020({ strict: true, allErrors: true }).compile(
  emitted,
);

describe('theme schema v1 (THEME-01, THEME-02)', () => {
  it('emits a JSON Schema 2020-12 document with additionalProperties false on every object', () => {
    expect(emitted.$schema).toBe(
      'https://json-schema.org/draft/2020-12/schema',
    );
    const objects: object[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      if (n.type === 'object') objects.push(n);
      Object.values(n).forEach(walk);
    };
    walk(emitted);
    expect(objects.length).toBe(9);
    for (const o of objects)
      expect(o).toHaveProperty('additionalProperties', false);
  });

  it('the TypeBox source and the committed JSON describe the same schema', () => {
    const { $schema: _s, ...committed } = emitted;
    expect(JSON.parse(JSON.stringify(ThemeV1))).toEqual(committed);
  });

  for (const { name, doc } of fixtures('valid')) {
    it(`P1.3-AC02 accepts valid/${name} in TypeBox and in Ajv 2020`, () => {
      expect(validateTheme(doc)).toEqual({ ok: true, value: doc });
      expect(ajvValidate(doc)).toBe(true);
    });
  }

  for (const folder of ['invalid', 'malicious'] as const) {
    for (const { name, doc } of fixtures(folder)) {
      it(`P1.3-AC02 rejects ${folder}/${name} in TypeBox and in Ajv 2020, with a path`, () => {
        const result = validateTheme(doc);
        expect(result.ok).toBe(false);
        if (!result.ok)
          expect(result.errors.some((e) => e.path.length > 0)).toBe(true);
        expect(ajvValidate(doc)).toBe(false);
      });
    }
  }

  it('P1.3-AC03 rejects every malicious fixture before the resolver runs', () => {
    const resolver = vi.fn();
    for (const { doc } of fixtures('malicious')) {
      expect(
        validateAndResolve(doc, { appearance: 'light' }, resolver).ok,
      ).toBe(false);
    }
    expect(resolver).not.toHaveBeenCalled();
  });

  it('every fixture file is used by a test (THEME-08)', () => {
    const folders = fs.readdirSync(fixturesDir);
    // `generate` holds the theme generator's cases (P2.4); generate.spec.ts covers each of them.
    expect(folders.sort()).toEqual([
      'generate',
      'invalid',
      'malicious',
      'migrated',
      'valid',
    ]);
    const counts = Object.fromEntries(
      folders
        .filter((f) => f !== 'generate')
        .map((f) => [f, fixtures(f as 'valid').length]),
    );
    expect(counts).toEqual({ valid: 5, invalid: 8, malicious: 8, migrated: 1 });
  });
});

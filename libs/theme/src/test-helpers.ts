// Shared by the theme tests: loads fixtures by folder (THEME-08).
import fs from 'node:fs';
import path from 'node:path';

export const libRoot = path.resolve(import.meta.dirname, '..');
export const fixturesDir = path.join(libRoot, 'fixtures');

export type FixtureFolder = 'valid' | 'invalid' | 'malicious' | 'migrated';

export function fixtures(
  folder: FixtureFolder,
): { name: string; doc: unknown }[] {
  const dir = path.join(fixturesDir, folder);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({
      name: f.replace(/\.json$/, ''),
      doc: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')),
    }));
}

export function fixture(folder: FixtureFolder, name: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(fixturesDir, folder, `${name}.json`), 'utf8'),
  );
}

// File helpers for materialising the widget's static documents (D-13, amended by D-24). Postgres is
// the source of truth; these write its projection into THEME_PUBLISH_DIR. Not tenant-aware on
// purpose: src/server/store/materialise.ts decides what to write.
import fs from 'node:fs';
import path from 'node:path';

/** The workspace root: the nearest folder with pnpm-workspace.yaml above the working directory. */
export function workspaceRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const up = path.dirname(dir);
    if (up === dir) throw new Error('workspace root not found');
    dir = up;
  }
  return dir;
}

const appDir = () => path.join(workspaceRoot(), 'apps', 'admin-dashboard');
const WIDGET_PUBLIC_V1 = path.join('apps', 'widget', 'public', 'v1');

/**
 * Where published themes and configs live: THEME_PUBLISH_DIR relative to the dashboard app,
 * default the widget's public/v1. Refuses anything else, except in unit tests (temp folders).
 */
export function publishDir(): string {
  const dir = path.resolve(
    appDir(),
    process.env.THEME_PUBLISH_DIR ?? '../widget/public/v1',
  );
  const allowed = path.join(workspaceRoot(), WIDGET_PUBLIC_V1);
  if (process.env.NODE_ENV !== 'test' && dir !== allowed)
    throw new Error(
      `THEME_PUBLISH_DIR must resolve to ${WIDGET_PUBLIC_V1} (got ${dir})`,
    );
  return dir;
}

export function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * The same value with object keys sorted, recursively. Postgres `jsonb` does not keep key order, so
 * materialised documents use one canonical order and are reproducible byte for byte.
 */
export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

const text = (doc: unknown) => JSON.stringify(sortKeys(doc), null, 2) + '\n';

const temp = (file: string) =>
  `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

/** Writes through a temp file and a rename, so readers never see a partial file. */
export function writeAtomic(file: string, doc: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = temp(file);
  fs.writeFileSync(tmp, text(doc));
  fs.renameSync(tmp, file);
}

/**
 * Like writeAtomic, but never replaces an existing file (published theme documents are immutable).
 * Returns false when the file already existed.
 */
export function writeNew(file: string, doc: unknown): boolean {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = temp(file);
  fs.writeFileSync(tmp, text(doc));
  try {
    fs.linkSync(tmp, file); // fails with EEXIST instead of overwriting
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  } finally {
    fs.unlinkSync(tmp);
  }
}

// File helpers for the development publish stub (D-13) and drafts. Not tenant-aware on purpose:
// the data-access functions in src/data/** take tenantId and call these.
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

/** Drafts: .local/drafts at the workspace root (gitignored); THEME_DRAFT_DIR overrides. */
export function draftDir(): string {
  return process.env.THEME_DRAFT_DIR
    ? path.resolve(process.env.THEME_DRAFT_DIR)
    : path.join(workspaceRoot(), '.local', 'drafts');
}

export function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const temp = (file: string) =>
  `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

/** Writes through a temp file and a rename, so readers never see a partial file. */
export function writeAtomic(file: string, doc: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = temp(file);
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

/** Like writeAtomic, but refuses to replace an existing file (immutable theme documents). */
export function writeNew(file: string, doc: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = temp(file);
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
  try {
    fs.linkSync(tmp, file); // fails with EEXIST instead of overwriting
  } finally {
    fs.unlinkSync(tmp);
  }
}

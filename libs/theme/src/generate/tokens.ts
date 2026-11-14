// Parsing DTCG 2025.10 files and building one token map per mode (SEM-04): files are merged in
// order and a later file overlays (overrides) an earlier one. Pure: input is text, output is data.
import type { Finding } from './report';

export interface SourceToken {
  path: string;
  value: unknown;
  type: string | null;
  file: string;
  pointer: string;
}

export type TokenMap = Map<string, SourceToken>;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const escapePointer = (k: string) =>
  k.replaceAll('~', '~0').replaceAll('/', '~1');

const MAX_DEPTH = 32;
/** Per file; going over is an error, never a silent truncation. */
const MAX_TOKENS = 10_000;

/** Flattens one parsed DTCG document. `$root` names its group's own token. */
export function flattenDtcg(
  doc: unknown,
  file: string,
  findings: Finding[],
): TokenMap {
  const out: TokenMap = new Map();
  if (!isObject(doc)) {
    findings.push({
      gate: 'G2',
      severity: 'error',
      code: 'not-an-object',
      message: `${file}: a DTCG file must be a JSON object`,
    });
    return out;
  }
  const walk = (
    node: Record<string, unknown>,
    keys: string[],
    type: string | null,
    depth: number,
  ) => {
    if (depth > MAX_DEPTH) {
      findings.push({
        gate: 'G2',
        severity: 'error',
        code: 'too-deep',
        message: `${file}: nested deeper than ${MAX_DEPTH} levels at /${keys.join('/')}`,
      });
      return;
    }
    const groupType = typeof node['$type'] === 'string' ? node['$type'] : type;
    if ('$extends' in node)
      findings.push({
        gate: 'G2',
        severity: 'error',
        code: 'extends-unsupported',
        message: `${file}: $extends at /${keys.join('/')} is not supported yet; export without group inheritance`,
      });
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$') && key !== '$root') continue;
      if (!isObject(child)) continue;
      const childKeys = [...keys, key];
      if ('$value' in child) {
        if (out.size >= MAX_TOKENS) {
          if (
            !findings.some(
              (f) => f.code === 'too-many-tokens' && f.message.startsWith(file),
            )
          )
            findings.push({
              gate: 'G2',
              severity: 'error',
              code: 'too-many-tokens',
              message: `${file}: more than ${MAX_TOKENS} tokens`,
            });
          return;
        }
        const path = childKeys.filter((k) => k !== '$root').join('.');
        out.set(path, {
          path,
          value: child['$value'],
          type: typeof child['$type'] === 'string' ? child['$type'] : groupType,
          file,
          pointer: `/${childKeys.map(escapePointer).join('/')}`,
        });
      } else if (key !== '$root') {
        walk(child, childKeys, groupType, depth + 1);
      }
    }
  };
  walk(doc, [], null, 0);
  return out;
}

/** Merges files in order; later files override. Overrides are reported (SEM-04 rule 2). */
export function overlay(
  files: readonly string[],
  parsed: ReadonlyMap<string, TokenMap>,
  mode: string,
  findings: Finding[],
): TokenMap {
  const merged: TokenMap = new Map();
  for (const file of files) {
    for (const [path, token] of parsed.get(file) ?? []) {
      const earlier = merged.get(path);
      if (earlier)
        findings.push({
          gate: 'G4',
          severity: 'info',
          code: 'mode-override',
          message: `${mode}: ${path} from ${earlier.file} is overridden by ${file}`,
        });
      merged.set(path, token);
    }
  }
  return merged;
}

const CURLY = /^\{([^{}]+)\}$/;

export type Resolved =
  | { ok: true; value: unknown; type: string | null; chain: string[] }
  | { ok: false; message: string };

/**
 * Resolves a token's value in one mode: whole-value `{path}` references, `{path}` strings inside
 * composite values, and `$ref` JSON Pointers (`#/a/b/$value[/property]`), with cycle detection.
 */
export function resolveToken(map: TokenMap, path: string): Resolved {
  const resolveValue = (
    value: unknown,
    stack: string[],
  ):
    | { ok: true; value: unknown; via: string | null }
    | { ok: false; message: string } => {
    if (stack.length > MAX_DEPTH)
      return {
        ok: false,
        message: `reference chain longer than ${MAX_DEPTH}: ${stack.join(' → ')}`,
      };
    const target =
      typeof value === 'string' ? CURLY.exec(value.trim())?.[1] : undefined;
    if (target !== undefined) return follow(target.trim(), null, stack);
    if (
      isObject(value) &&
      typeof value['$ref'] === 'string' &&
      Object.keys(value).length === 1
    )
      return fromPointer(value['$ref'], stack);
    if (Array.isArray(value)) {
      const items: unknown[] = [];
      for (const v of value) {
        const r = resolveValue(v, stack);
        if (!r.ok) return r;
        items.push(r.value);
      }
      return { ok: true, value: items, via: null };
    }
    if (isObject(value)) {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        const r = resolveValue(v, stack);
        if (!r.ok) return r;
        obj[k] = r.value;
      }
      return { ok: true, value: obj, via: null };
    }
    return { ok: true, value, via: null };
  };

  const fromPointer = (pointer: string, stack: string[]) => {
    if (!pointer.startsWith('#/'))
      return {
        ok: false as const,
        message: `$ref "${pointer}" must start with #/`,
      };
    const parts = pointer
      .slice(2)
      .split('/')
      .map((p) => p.replaceAll('~1', '/').replaceAll('~0', '~'));
    const at = parts.indexOf('$value');
    if (at < 1)
      return {
        ok: false as const,
        message: `$ref "${pointer}" must point into a token's $value`,
      };
    const tokenPath = parts
      .slice(0, at)
      .filter((p) => p !== '$root')
      .join('.');
    return follow(tokenPath, parts.slice(at + 1), stack);
  };

  const follow = (
    target: string,
    property: string[] | null,
    stack: string[],
  ):
    | { ok: true; value: unknown; via: string }
    | { ok: false; message: string } => {
    if (stack.includes(target))
      return {
        ok: false,
        message: `circular reference: ${[...stack, target].join(' → ')}`,
      };
    const token = map.get(target);
    if (!token)
      return { ok: false, message: `{${target}} does not exist in this mode` };
    const inner = resolveValue(token.value, [...stack, target]);
    if (!inner.ok) return inner;
    let value = inner.value;
    for (const p of property ?? []) {
      if (!isObject(value) && !Array.isArray(value))
        return {
          ok: false,
          message: `{${target}} has no property ${property!.join('/')}`,
        };
      value = (value as Record<string, unknown>)[p];
      if (value === undefined)
        return {
          ok: false,
          message: `{${target}} has no property ${property!.join('/')}`,
        };
    }
    return { ok: true, value, via: target };
  };

  const token = map.get(path);
  if (!token)
    return { ok: false, message: `${path} does not exist in this mode` };
  const chain: string[] = [];
  let type = token.type;
  // Record the chain of whole-value references, and inherit a type through it when missing.
  let cursor: SourceToken | undefined = token;
  const seen = new Set<string>([path]);
  while (
    cursor &&
    typeof cursor.value === 'string' &&
    CURLY.test(cursor.value.trim())
  ) {
    const next = CURLY.exec(cursor.value.trim())![1].trim();
    if (seen.has(next)) break;
    seen.add(next);
    chain.push(next);
    cursor = map.get(next);
    if (cursor && type === null) type = cursor.type;
  }
  const r = resolveValue(token.value, [path]);
  return r.ok ? { ok: true, value: r.value, type, chain } : r;
}

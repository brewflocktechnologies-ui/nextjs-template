// The theme generator (ADR-016): manifest + DTCG source texts → artifact, preview CSS and report.
// Platform-neutral (no file system, DOM or network): the Nx scripts call it for repository themes,
// the dashboard server for uploads, so the same source gives the same artifact by either channel.
import { Value } from '@sinclair/typebox/value';
import {
  CONTRACT,
  CONTRACT_BY_PATH,
  CONTRACT_ID,
  CONTRAST_PAIRS,
  extensionVariable,
  type ContractType,
} from '../contract/contract';
import { contrastRatio } from '../policy';
import {
  ThemeArtifactV1,
  type ThemeArtifact,
} from '../schema/theme-artifact.v1';
import {
  ThemeManifestV1,
  type ThemeManifest,
} from '../schema/theme-manifest.v1';
import {
  reportMarkdown,
  sortFindings,
  type Finding,
  type GenerationReport,
} from './report';
import { flattenDtcg, overlay, resolveToken, type TokenMap } from './tokens';
import {
  ACCEPTED_TYPES,
  FONT_REGISTRY,
  UNSAFE,
  dimensionPx,
  serialise,
} from './values';

export const GENERATOR_VERSION = 'theme-generator/1.0.0';

const MODES = ['light', 'dark'] as const;
type Mode = (typeof MODES)[number];

export interface GenerateInput {
  /** Parsed `theme.manifest.json`. */
  manifest: unknown;
  /** Source texts keyed by the paths written in the manifest. */
  files: Readonly<Record<string, string>>;
  /** Every token file found beside the manifest, so undeclared files fail G1. */
  presentFiles?: readonly string[];
  /** The platform-default artifact, supplying optional tokens a theme does not map (SEM-03). */
  fallback?: ThemeArtifact;
}

export interface GenerateResult {
  ok: boolean;
  artifact: ThemeArtifact | null;
  previewCss: string | null;
  report: GenerationReport;
  reportMarkdown: string;
}

const sortKeys = <T>(o: Record<string, T>): Record<string, T> =>
  Object.fromEntries(
    Object.keys(o)
      .sort()
      .map((k) => [k, o[k]]),
  );

export function generateTheme(input: GenerateInput): GenerateResult {
  const findings: Finding[] = [];
  const done = (
    manifest: ThemeManifest | null,
    artifact: ThemeArtifact | null,
  ) => {
    const sorted = sortFindings(findings);
    const report: GenerationReport = {
      themeId: manifest?.themeId ?? null,
      version: manifest?.version ?? null,
      generator: GENERATOR_VERSION,
      errors: sorted.filter((f) => f.severity === 'error').length,
      warnings: sorted.filter((f) => f.severity === 'warning').length,
      approvalsRequired: sorted.filter((f) => f.severity === 'warning').length,
      findings: sorted,
    };
    const ok = report.errors === 0 && artifact !== null;
    return {
      ok,
      artifact: ok ? artifact : null,
      previewCss: ok && artifact ? previewCss(artifact) : null,
      report,
      reportMarkdown: reportMarkdown(report),
    };
  };

  // G1: manifest and declared files.
  if (!Value.Check(ThemeManifestV1, input.manifest)) {
    for (const e of Value.Errors(ThemeManifestV1, input.manifest))
      findings.push({
        gate: 'G1',
        severity: 'error',
        code: 'manifest-invalid',
        message: `manifest ${e.path || '/'}: ${e.message}`,
      });
    return done(null, null);
  }
  const manifest = input.manifest;
  const declared = new Set(manifest.source.files);
  for (const mode of MODES)
    for (const f of manifest.modes[mode])
      if (!declared.has(f))
        findings.push({
          gate: 'G1',
          severity: 'error',
          code: 'mode-file-undeclared',
          message: `${mode} lists ${f}, which is not in source.files`,
        });
  for (const f of manifest.source.files)
    if (input.files[f] === undefined)
      findings.push({
        gate: 'G1',
        severity: 'error',
        code: 'file-missing',
        message: `${f} is declared but missing`,
      });
  for (const f of input.presentFiles ?? [])
    if (!declared.has(f))
      findings.push({
        gate: 'G1',
        severity: 'error',
        code: 'file-undeclared',
        message: `${f} is a token file the manifest does not declare`,
      });
  for (const id of manifest.fonts ?? [])
    if (![...FONT_REGISTRY.values()].some((e) => e.id === id))
      findings.push({
        gate: 'G5',
        severity: 'error',
        code: 'font-unknown',
        message: `font id "${id}" is not in the platform font registry`,
      });
  if (findings.some((f) => f.severity === 'error')) return done(manifest, null);

  // G2: parse every declared file.
  const parsed = new Map<string, TokenMap>();
  for (const f of manifest.source.files) {
    let doc: unknown;
    try {
      doc = JSON.parse(input.files[f]);
    } catch (e) {
      findings.push({
        gate: 'G2',
        severity: 'error',
        code: 'invalid-json',
        message: `${f}: ${(e as Error).message}`,
      });
      continue;
    }
    parsed.set(f, flattenDtcg(doc, f, findings));
  }
  if (findings.some((f) => f.severity === 'error')) return done(manifest, null);

  // G5: the map covers every required path and names only contract paths.
  for (const key of Object.keys(manifest.semanticMap))
    if (!CONTRACT_BY_PATH.has(key))
      findings.push({
        gate: 'G5',
        severity: 'error',
        code: 'unknown-contract-path',
        path: key,
        message: `${key} is not a contract path`,
      });
  for (const t of CONTRACT)
    if (t.required && manifest.semanticMap[t.path] === undefined)
      findings.push({
        gate: 'G5',
        severity: 'error',
        code: 'required-unmapped',
        path: t.path,
        message: `required token ${t.path} is not mapped`,
      });

  const out: Record<Mode, Record<string, string>> = { light: {}, dark: {} };
  const ext: Record<Mode, Record<string, string>> = { light: {}, dark: {} };
  const hexes: Record<Mode, Record<string, string>> = { light: {}, dark: {} };

  for (const mode of MODES) {
    const map = overlay(manifest.modes[mode], parsed, mode, findings);
    const emit = (
      type: ContractType,
      tokenPath: string,
      label: string,
      opts: { alpha?: boolean; range?: readonly [number, number] },
    ): string | null => {
      const r = resolveToken(map, tokenPath);
      if (!r.ok) {
        findings.push({
          gate: 'G3',
          severity: 'error',
          code: 'reference',
          path: label,
          mode,
          message: `${tokenPath}: ${r.message}`,
        });
        return null;
      }
      if (r.type === null || !ACCEPTED_TYPES[type].includes(r.type)) {
        findings.push({
          gate: 'G5',
          severity: 'error',
          code: 'type-mismatch',
          path: label,
          mode,
          message: `${tokenPath} has $type ${r.type ?? '(none)'}; ${label} needs ${type}`,
        });
        return null;
      }
      const s = serialise(type, r.value, { alpha: opts.alpha });
      if (!s.ok) {
        findings.push({
          gate: 'G5',
          severity: 'error',
          code: 'invalid-value',
          path: label,
          mode,
          message: `${tokenPath}: ${s.message}`,
          original: r.value,
        });
        return null;
      }
      for (const n of s.notes)
        findings.push({
          gate: 'G7',
          severity: n.severity,
          code: n.code,
          path: label,
          mode,
          message: n.message,
          original: n.original,
          result: n.result,
        });
      if (opts.range) {
        const n =
          type === 'dimension' ? dimensionPx(r.value)?.px : (r.value as number);
        if (n === undefined || n < opts.range[0] || n > opts.range[1]) {
          findings.push({
            gate: 'G5',
            severity: 'error',
            code: 'out-of-range',
            path: label,
            mode,
            message: `${s.css} is outside ${opts.range[0]}–${opts.range[1]}${type === 'dimension' ? ' px' : ''}`,
            original: r.value,
          });
          return null;
        }
      }
      if (UNSAFE.test(s.css)) {
        findings.push({
          gate: 'G7',
          severity: 'error',
          code: 'unsafe-output',
          path: label,
          mode,
          message: 'serialised value failed the output safety check',
        });
        return null;
      }
      return s.css;
    };

    for (const t of CONTRACT) {
      const mapped = manifest.semanticMap[t.path];
      if (mapped === undefined) {
        const fb = input.fallback?.modes[mode][t.variable];
        if (fb !== undefined) out[mode][t.variable] = fb;
        continue;
      }
      const css = emit(t.type, mapped.replaceAll('{mode}', mode), t.path, {
        alpha: t.alpha,
        range: t.range,
      });
      if (css === null) continue;
      out[mode][t.variable] = css;
      if (t.type === 'color') hexes[mode][t.path] = css.slice(0, 7);
    }

    // G6: extensions, in the theme's own namespace.
    const extensions = manifest.extensions;
    if (extensions) {
      if (extensions.namespace !== manifest.themeId) {
        if (mode === 'light')
          findings.push({
            gate: 'G6',
            severity: 'error',
            code: 'extension-namespace',
            message: `extension namespace "${extensions.namespace}" must equal the theme id "${manifest.themeId}"`,
          });
      } else {
        for (const [name, tokenPath] of Object.entries(extensions.tokens)) {
          const resolved = resolveToken(
            map,
            tokenPath.replaceAll('{mode}', mode),
          );
          const type = resolved.ok ? resolved.type : null;
          if (resolved.ok && (type === null || !(type in ACCEPTED_TYPES))) {
            findings.push({
              gate: 'G6',
              severity: 'info',
              code: 'extension-type-unsupported',
              path: name,
              mode,
              message: `${tokenPath} has $type ${type ?? '(none)'}, which extensions cannot emit; not emitted`,
            });
            continue;
          }
          const css = emit(
            (type ?? 'color') as ContractType,
            tokenPath.replaceAll('{mode}', mode),
            name,
            { alpha: true },
          );
          if (css !== null)
            ext[mode][extensionVariable(manifest.themeId, name)] = css;
        }
      }
    }

    // G5: contrast (THEME-06, D-20) on the emitted colours.
    for (const p of CONTRAST_PAIRS) {
      const fg = hexes[mode][p.foreground];
      const bg = hexes[mode][p.background];
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio < p.required)
        findings.push({
          gate: 'G5',
          severity: 'error',
          code: 'contrast',
          path: p.foreground,
          mode,
          message: `${p.foreground} on ${p.background} is ${ratio.toFixed(2)}:1; needs ${p.required}:1`,
        });
    }
  }

  // G4: mode-independent tokens agree.
  for (const t of CONTRACT)
    if (
      !t.perMode &&
      manifest.semanticMap[t.path] !== undefined &&
      out.light[t.variable] !== undefined &&
      out.dark[t.variable] !== undefined &&
      out.light[t.variable] !== out.dark[t.variable]
    )
      findings.push({
        gate: 'G4',
        severity: 'error',
        code: 'mode-dependent',
        path: t.path,
        message: `${t.path} must be the same in both modes (light ${out.light[t.variable]}, dark ${out.dark[t.variable]})`,
      });

  // G7: every required variable is present in both modes.
  for (const mode of MODES)
    for (const t of CONTRACT)
      if (
        t.required &&
        out[mode][t.variable] === undefined &&
        !findings.some((f) => f.path === t.path && f.severity === 'error')
      )
        findings.push({
          gate: 'G7',
          severity: 'error',
          code: 'variable-missing',
          path: t.path,
          mode,
          message: `${t.variable} was not generated`,
        });

  if (findings.some((f) => f.severity === 'error')) return done(manifest, null);

  const artifact: ThemeArtifact = {
    artifactVersion: 1,
    themeId: manifest.themeId,
    version: manifest.version,
    contract: CONTRACT_ID,
    modes: { light: sortKeys(out.light), dark: sortKeys(out.dark) },
    extensions: { light: sortKeys(ext.light), dark: sortKeys(ext.dark) },
  };
  if (!Value.Check(ThemeArtifactV1, artifact)) {
    for (const e of Value.Errors(ThemeArtifactV1, artifact))
      findings.push({
        gate: 'G7',
        severity: 'error',
        code: 'artifact-invalid',
        message: `artifact ${e.path}: ${e.message}`,
      });
    return done(manifest, null);
  }
  return done(manifest, artifact);
}

/** CSS for Storybook and review only; runtimes read the artifact (ADR-017: no @theme here). */
export function previewCss(a: ThemeArtifact): string {
  const block = (selector: string, vars: Record<string, string>) =>
    `${selector} {\n${Object.entries(vars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n')}\n}\n`;
  const sel = `:root[data-theme="${a.themeId}"]`;
  return [
    `/* Generated by ${GENERATOR_VERSION} from theme ${a.themeId} ${a.version}. Do not edit. */\n`,
    block(sel, { ...a.modes.light, ...a.extensions.light }),
    block(`${sel}[data-appearance="dark"]`, {
      ...a.modes.dark,
      ...a.extensions.dark,
    }),
  ].join('\n');
}

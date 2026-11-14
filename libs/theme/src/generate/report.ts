// Findings and the human-readable report (G1–G7). Every lossy conversion is a finding with its
// original and converted values; nothing is converted silently (SEM-01 rule 4).

export type Gate = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7';

export interface Finding {
  gate: Gate;
  /** error: blocks the artifact. warning: needs approval (lossy). info: recorded only. */
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  /** Contract path or extension name, when the finding is about one token. */
  path?: string;
  mode?: 'light' | 'dark';
  original?: unknown;
  result?: string;
}

export interface GenerationReport {
  themeId: string | null;
  version: string | null;
  generator: string;
  errors: number;
  warnings: number;
  /** Lossy conversions a reviewer must approve before the version can be approved (G10). */
  approvalsRequired: number;
  findings: Finding[];
}

const order = { error: 0, warning: 1, info: 2 } as const;

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      order[a.severity] - order[b.severity] ||
      a.gate.localeCompare(b.gate) ||
      (a.path ?? '').localeCompare(b.path ?? '') ||
      (a.mode ?? '').localeCompare(b.mode ?? '') ||
      a.code.localeCompare(b.code) ||
      a.message.localeCompare(b.message),
  );
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ');

export function reportMarkdown(report: GenerationReport): string {
  const lines = [
    `# Theme report: ${report.themeId ?? '(unknown)'} ${report.version ?? ''}`.trim(),
    '',
    `Generator ${report.generator}. Errors: ${report.errors}. Lossy conversions needing approval: ${report.approvalsRequired}.`,
    '',
  ];
  for (const severity of ['error', 'warning', 'info'] as const) {
    const items = report.findings.filter((f) => f.severity === severity);
    if (items.length === 0) continue;
    lines.push(
      `## ${severity === 'error' ? 'Errors' : severity === 'warning' ? 'Needs approval' : 'Notes'}`,
      '',
      '| Gate | Token | Mode | Finding | Original | Result |',
      '| ---- | ----- | ---- | ------- | -------- | ------ |',
      ...items.map(
        (f) =>
          `| ${f.gate} | ${f.path ?? ''} | ${f.mode ?? ''} | ${oneLine(f.message).replaceAll('|', '\\|')} | ${
            f.original === undefined
              ? ''
              : oneLine(JSON.stringify(f.original)).replaceAll('|', '\\|')
          } | ${f.result ?? ''} |`,
      ),
      '',
    );
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

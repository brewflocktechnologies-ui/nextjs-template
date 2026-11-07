// allowedOrigins rules (ENDP-02a, D-21), shared by the settings form and the server.
export const ORIGIN = /^https?:\/\/[a-z0-9.-]+(:[0-9]{1,5})?$/;
export const MAX_ORIGINS = 20;

/** Problems with a list of origins; empty when it is valid. */
export function originProblems(origins: string[]): string[] {
  const problems: string[] = [];
  if (origins.length < 1) problems.push('List at least one origin.');
  if (origins.length > MAX_ORIGINS)
    problems.push(`List at most ${MAX_ORIGINS} origins.`);
  for (const o of origins)
    if (!ORIGIN.test(o))
      problems.push(
        `"${o}" is not an exact origin: use scheme, lower-case host and optional port, with no path or wildcard.`,
      );
  if (new Set(origins).size !== origins.length)
    problems.push('Each origin may appear only once.');
  return problems;
}

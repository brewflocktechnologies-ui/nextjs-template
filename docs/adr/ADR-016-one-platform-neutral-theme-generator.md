# ADR-016: One platform-neutral theme generator

|          |                                                                       |
| -------- | --------------------------------------------------------------------- |
| Status   | Accepted                                                              |
| Date     | 2026-11-14                                                            |
| Deciders | Madhusudan C P (product owner, architecture owner, security reviewer) |
| Source   | ARCH-001 §7; SPECS/DECISIONS.md D-30; ADR-003                         |

## Context and problem statement

Theme sources arrive by two channels from the start: curated design systems in the repository and tenant uploads in the dashboard (D-30). Both must turn the same source into the same artifact. Design systems are exported from Figma with the Design Token Kit plugin as DTCG 2025.10: a base `tokens.json` plus overlay files per mode, with `{path}` and `$ref` JSON Pointer references. The question is which generator produces artifacts and where it runs.

## Decision drivers

- Byte-identical artifacts for the same source by either channel.
- Output names follow the platform contract, not the export tool's token paths.
- Deterministic, testable, no new fast-moving dependency without need.
- DTCG 2025.10 coverage, including `$ref` and mode overlays.

## Considered options

1. Design Token Kit CLI (`@design-token-kit/cli` 3.2.0) generating CSS directly.
2. Design Token Kit Core API with a contract adapter.
3. Style Dictionary 5.7.1 with a contract adapter, run only as a build script.
4. One platform-neutral TypeScript generator in `libs/theme`, called by an Nx script and by the dashboard server.

## Decision outcome

**Chosen option:** option 4, because only one shared module can guarantee identical artifacts for both channels, and the steps the contract needs (overlay, `$ref` resolution, contract mapping, typed serialisation, lossy-conversion report) are needed whichever library parses the files.

- `libs/theme/src/generate/` (no file system, no DOM, its own package entry so the frame never loads it): load manifest, overlay mode files, resolve `{path}` and `$ref` with cycle detection, canonicalise values, map through `semanticMap`, check the contract and contrast policy, serialise, report.
- Thin Nx scripts in `libs/design-tokens/scripts/themes/` read and write files for repository themes; the dashboard server calls the same module for uploads.
- Style Dictionary 5.7.1 keeps building the platform default (ADR-003) and is the reference for the equivalence test: the platform default expressed as a theme must regenerate today's values exactly.
- Design Token Kit is an export tool only: its files are inputs. Its CLI is not used because its CSS names come from token paths (for example `--semantic-color-text-primary`) and its Tailwind output is a separate `@theme` block that would duplicate ADR-017's mapping.
- Colour-space conversion to sRGB (out-of-gamut colours are converted, reported and approved, D-30) uses a colour library or a small tested implementation, chosen in P2.4 with its dependency sentence.

### Consequences

- Good: one implementation, one test suite, identical results for both channels.
- Bad: the module re-implements reference resolution that Style Dictionary also has; covered by the equivalence and fixture tests.
- Neutral / follow-ups: the DTCG Resolver module (2025.10, stable) could later replace the manifest's mode lists.

## Verification

<!-- verification -->

P2.4, 2026-11-14 (`SPECS/evidence/P2.4.md`): generator in `libs/theme/src/generate/`, entry `@byteflock/theme/generate`, absent from the widget frame bundle; colour conversion with colorjs.io 0.7.1 (CSS Color 4 gamut mapping); platform default equivalent to `semantic.css` (58 variables, both modes); 23 fixtures. Targets live on `@byteflock/theme` (dependency direction). Channel equivalence (repository and upload) follows in P2.7.

<!-- /verification -->

## Links

- Related: ADR-003, ADR-014, ADR-015, ADR-017
- Sources checked 2026-11-14: design-token-kit.github.io docs; registry.npmjs.org; styledictionary.com/info/dtcg; style-dictionary issue #1590
- Evidence: `SPECS/evidence/P2.4.md`

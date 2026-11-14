# Contract: design-token extraction v1 (EXTRACT)

Source: P2.2. This is **layer A** of the design-token import. It reads a tenant's design-token export, whatever its structure, and produces a **token inventory**: every token, with its original form, its source and its relationships, plus reports. It is lossless, deterministic and traceable. It knows nothing about `theme.v1`.

**Layer B** (`contracts/token-projection-v1.md`, P2.3) reads the inventory and fills a `theme.v1` theme. Layer B is lossy by design; layer A is not.

```
files ──► Layer A: extraction (this contract) ──► token inventory + reports
                                                        │
                                                        ▼
                         Layer B: projection (token-projection-v1) ──► theme.v1 in the editor
```

**Principles.** Layer A must never silently discard, overwrite, invent, rename or reinterpret a token. Everything it cannot use is reported. File, folder and group names are hints, never proof: content decides, and when content does not decide, the user does.

**Validation scope.** Exports are expected to be checked for design quality by the tool that produced them (for example a Figma token plugin that audits token layers, aliases, cycles, raw values outside primitives and contrast in the design). Layer A does not repeat that audit. It checks only what protects the product and keeps the inventory trustworthy: limits, parsing, encoding, reference resolution (so cycles cannot hang it), theme separation and its own integrity (EXTRACT-14). It still cannot assume such a tool ran, because any admin can upload any file, so these checks always run. Layer B checks the tokens it actually uses (PROJ-07).

## EXTRACT-01 Inputs

Layer A takes one **import set**: a list of entries `{ sourcePath, text, sha256, byteLength }`, where `sourcePath` is the file's relative path inside what the user picked.

| What the user picks                | How it becomes an import set                                  |
| ---------------------------------- | ------------------------------------------------------------- |
| One token file                     | One entry                                                     |
| Several files (multiple selection) | One entry per file                                            |
| A folder (folder picker)           | One entry per file found recursively, at any depth            |
| A `.zip` archive                   | One entry per file inside it, recursively through its folders |

Rules:

1. **Token files** are files ending in `.json`, `.tokens` or `.tokens.json` (the extensions DTCG suggests), and `.css` files, which are read only for their custom-property values (EXTRACT-05A). The extension decides which parser runs. Files with other extensions found in a folder or archive become entries too, and are classified `unsupported` without being parsed.
   **Other generated code is not accepted.** Exporters also write SCSS, Less, Tailwind JavaScript configuration (`tailwind.config.*`), SwiftUI and Android XML. These are `unsupported` with the reason "generated code is not imported; use the DTCG token files or CSS custom properties". A CSS file is a data source only: its text never reaches a page as CSS (THEME-01, threat T-03).
2. Reading files, walking folders, unpacking archives and hashing happen in the dashboard. The extraction library receives only the import set, so it has no file-system, DOM or archive dependency and can later run on a server unchanged.
3. Every entry is identified by its hash and path, never by its file name alone. Two entries with the same name in different folders are different sources.
4. Byte-identical entries (same `sha256`) are extracted once, from the entry whose `sourcePath` sorts first, and reported as duplicate files with all their paths. Their tokens are counted once (EXTRACT-09).
5. The original text of every entry is kept unchanged for the bundle (EXTRACT-12).
6. The result never depends on the order of entries in the set. Entries are processed in a canonical order: by `sourcePath`, then `sha256`.

## EXTRACT-02 Limits

Checked before parsing and after unpacking. Exceeding a limit stops extraction with a specific message; nothing is partially produced.

| Limit                                   | Value  |
| --------------------------------------- | ------ |
| Size of one file                        | 256 KB |
| Total size of the import set (unpacked) | 2 MB   |
| ZIP archive size (packed)               | 1 MB   |
| Number of files                         | 200    |
| Folder depth                            | 10     |
| Tokens across the set                   | 10,000 |
| Alias chain length                      | 32     |

The values may be tuned in implementation; a change is recorded in the P2.2 evidence. P2.2-T01 checks them against the real samples first: Figma exports carry `$extensions` on every token and can be much larger than hand-written files.

Archive limits are enforced while unpacking, by counting the bytes actually produced, not only from the sizes an archive declares in its headers.

## EXTRACT-03 File classification

Every entry gets exactly one class, from its content alone:

| Class           | Recognised by                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `dtcg`          | Contains at least one token: an object with `$value`                                                                          |
| `legacy-tokens` | Contains token leaves that are objects with `value` (usually with `type`) and no `$value`: Tokens Studio, Style Dictionary v3 |
| `tool-metadata` | Holds only a known tool's index of sets, themes or modes, for example a Tokens Studio `$themes.json` or `$metadata.json`      |
| `css-tokens`    | A `.css` file with at least one custom property (`--name: value`) in a place EXTRACT-05A reads                                |
| `unsupported`   | Valid JSON or CSS with no tokens, tokens in an unknown shape, or a file without a token-file extension (EXTRACT-01 rule 1)    |
| `invalid`       | A token file that is not valid JSON (or CSS, for `.css`) or not UTF-8                                                         |

A file's class never depends on its name: renaming a file does not change its class (only its extension decides whether it is parsed at all, and by which parser). A file that mixes tokens with other data is `dtcg` (or `legacy-tokens`, or `css-tokens`), and the non-token part is reported. A token file may also **embed** tool metadata, for example a single-file Tokens Studio export with top-level `$themes` and `$metadata` keys next to its token sets: it keeps its token class, and the embedded metadata is used as theme evidence (EXTRACT-11). Every `unsupported` and `invalid` entry is listed in the report with the reason.

## EXTRACT-04 DTCG recognition

1. **Tokens and groups.** An object with `$value` is a token. Any other object is a group. Not every object is a token.
2. **Properties kept on every token:** `$value`, `$type`, `$description`, `$deprecated` (flag and message) and `$extensions` (all of it, including unknown vendor keys).
3. **Group properties kept:** `$type`, `$description`, `$deprecated`, `$extensions`.
4. **Type inheritance.** A token without `$type` takes the nearest ancestor group's `$type`. A token's own `$type` always wins.
5. **Specification version.** The implementation targets DTCG 2025.10. Before implementation (P2.2-T01), the implementer checks the published 2025.10 text and records, in the evidence, how each of these is defined and handled: `$root`, `$extends`, `$ref` and any other reference or group feature. Until that check is recorded:
   - `$root` and `$extends` are preserved, and supported if the text defines them;
   - `$ref` is preserved; it is resolved as a reference only if the 2025.10 text defines it as one, otherwise it is kept as metadata and reported.
6. Layer A does not audit every token for compliance with the targeted version (see Validation scope). It reads each token as far as it can; when it cannot build a canonical value it leaves it empty and flags the token (EXTRACT-07). A token is never dropped for being non-compliant. Layer B checks the value shape of each token it projects (PROJ-07).

## EXTRACT-05 Legacy normalisation

`legacy-tokens` entries are converted to DTCG for analysis: `value` → `$value`, `type` → `$type`, `description` → `$description`, and the format's alias syntax → `{path}`. The original form is kept on each token (EXTRACT-09). Types are mapped only by an explicit table; an unmapped type becomes `other` with a flag.

**Priority: lower than DTCG.** The expected source is a DTCG export (for example from a Figma token plugin). Legacy normalisation may be deferred to a later phase if time is short (P2.2 §12). While deferred, `legacy-tokens` entries are still classified and listed, with the reason "legacy format not yet supported; export as DTCG", and their tokens are not extracted.

## EXTRACT-05A CSS custom properties and Tailwind v4

For tenants without a design-token tool, layer A can read token **values** from CSS: plain custom properties and Tailwind CSS v4 `@theme` blocks. The CSS is parsed as data. It is never applied, re-emitted or passed on as CSS, so it adds no tenant CSS to the product (THEME-01).

**Priority: lower than DTCG, deferrable** (P2.2 §12). While deferred, `.css` entries are classified `unsupported` with the reason "CSS import not yet supported; export as DTCG", and nothing in them is parsed.

1. **Parser.** A real CSS parser, not regular expressions (a new dependency, with its sentence in the P2.2 evidence). The nesting-depth and size limits of EXTRACT-02 apply.
2. **What is read.** Custom-property declarations (`--name: value`) inside:
   - `:root`, `html` and `:host`;
   - Tailwind v4 `@theme` blocks, with or without their options (`inline`, `static`);
   - the mode selectors in rule 7.

   `@layer` and `@media (prefers-color-scheme: …)` are looked through. Everything else is ignored and listed by kind, with counts: ordinary declarations, other selectors, `@import` (never fetched), `@font-face`, `@apply`, `@utility`, `@plugin`, `@source`, other at-rules and `url()` values (never fetched).

3. **Paths.** The original path is the property name as written. The normalised path is the name without `--`, as one segment, except that a Tailwind v4 theme namespace becomes the first segment: `--color-primary-foreground` → `color` / `primary-foreground`. The namespace table (`color`, `font`, `text`, `font-weight`, `radius`, `spacing`, `shadow`, `breakpoint`, `ease`, `animate` and the rest of Tailwind v4's documented namespaces) is checked against the Tailwind v4 documentation in P2.2-T01 and kept in `libs/token-inventory`. The namespace prefix is used inside `@theme`, and for plain CSS only when the property starts with one.
4. **Types.** A Tailwind namespace sets the type and marks it as derived from the namespace (`color` → `color`, `radius` and `spacing` → `dimension`, `font` → `fontFamily`, `font-weight` → `fontWeight`, `ease` → `cubicBezier`; others → `other`). Without a namespace, the type is inferred from the value only when unambiguous (EXTRACT-06 rule 2) and marked inferred.
5. **Values.** The original value text is kept exactly (EXTRACT-07). Canonical values are produced for colours (hex, `rgb()`, `hsl()`, `oklch()`, `oklab()`, `color()`, named colours) and dimensions (`px`, `rem`, `em`, unitless zero, without converting units). Computed values (`calc()`, `color-mix()`, `light-dark()`, `env()`, relative colour syntax) and CSS-wide keywords (`inherit`, `initial`, `unset`, `revert`) get no canonical value and are flagged "computed value". Tailwind v4's default palette uses `oklch()`, which often falls outside sRGB; layer B handles that (PROJ-08).
6. **References.** A value that is exactly `var(--x)` is a reference to `x`, recorded like a DTCG `{path}` reference (EXTRACT-10). A fallback (`var(--x, #fff)`) is kept with the reference but never used in its place: an unresolved reference is an error, with the fallback shown. A `var()` inside a larger value is a computed value (rule 5).
7. **Modes.** Selectors and media queries are theme evidence (EXTRACT-11):

   | Source                                                                 | Becomes                                                            |
   | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
   | `:root`, `html`, `:host`, `@theme`                                     | The base declarations                                              |
   | `.dark`, `:root.dark`, `[data-theme="<name>"]`, `[data-mode="<name>"]` | A mode, identified by the selector as written                      |
   | `@media (prefers-color-scheme: dark)` (or `light`)                     | A mode, identified by the media query; level-1 appearance evidence |
   | A compound such as `[data-brand="acme"].dark`                          | One mode on each of two axes, each axis named by its attribute     |
   | Any other selector holding custom properties                           | Not read; listed as not imported                                   |

   This follows the CSS cascade, which is how the format defines modes: a property declared in the base and redeclared under a mode selector has one value per mode, with the base declarations as their own mode, identified by the base selector. A property declared only in the base is `shared`. Layer B decides which mode is light or dark (PROJ-04).

8. **No `$description`, `$deprecated` or `$extensions`.** CSS comments are not read as descriptions. The fields stay empty.

## EXTRACT-06 Token types

Recognised types: `color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `number`, `strokeStyle`, `border`, `transition`, `shadow`, `gradient`, `typography`, plus tool types seen in real exports (for example `fontSize`, `lineHeight`, `letterSpacing`). Anything else is kept as `other` for review.

Rules:

1. An explicit `$type` (own or inherited) is never overridden.
2. A type is inferred only when the value is unambiguous (a `#rrggbb` string with no `$type` anywhere above it is a colour); an inferred type is marked as inferred.
3. Ambiguous values get no type and are flagged for review.
4. Values are never converted between types.
5. Composite types (`typography`, `shadow`, `border`, `gradient`, `transition`) keep their structure, including references inside them.

## EXTRACT-07 Values

Each token keeps two forms:

- **Original value:** exactly as written, including precision, units, alpha, colour space and reference strings.
- **Canonical value:** a separate, typed form for analysis (for colours: colour space, components, alpha and a hex form where one exists without approximation; for dimensions: number and unit).

Rules: numbers are not rounded; units are not converted; alpha is not removed; colours are not approximated; structured values are not flattened to strings. If a canonical form cannot be produced exactly, it is left empty and flagged. The original value is never changed.

## EXTRACT-08 Paths and namespaces

1. Each token keeps its **original path**: the sequence of keys from its file's root, with original case and spelling.
2. A **normalised path** is generated separately (dot-joined, used for lookups and aliases); it never replaces the original.
3. Tokens are not renamed and groups are not flattened.
4. **Namespace classification.** Each token is tagged, with the evidence for the tag:

   | Tag         | Evidence                                                                                                             |
   | ----------- | -------------------------------------------------------------------------------------------------------------------- |
   | `primitive` | Holds a raw value (not a reference) and is referenced by other tokens, or sits in a group that only holds raw values |
   | `semantic`  | Refers to another token, or sits in a group whose tokens mostly refer to others                                      |
   | `component` | Sits under a component group or file (for example `button`, `input`), detected by structure, folder or tool metadata |
   | `unknown`   | None of the above with confidence                                                                                    |

   Tags are analysis, not renaming: they never move a token. Component tokens are never merged into global tokens. Consumers use `primitive`, `semantic` and `unknown` as ranking signals, not as filters, because many exports hold semantic roles as raw values (a `background` group of hex colours looks like primitives by this evidence). Only `component` is used as an exclusion (PROJ-05).

5. **Collisions.** Two different tokens that normalise to the same path in the same theme context are handled as a conflict (EXTRACT-13), with both sources recorded.

## EXTRACT-09 The token record

Every token in the inventory has:

| Field            | Content                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `originalPath`   | Keys as written                                                                                                                                                                                |
| `normalisedPath` | Dot-joined path                                                                                                                                                                                |
| `themePath`      | The normalised path with the theme's own segment removed (for `color.dark.primary` in theme `dark`, `color.primary`); equal to `normalisedPath` for shared tokens and for themes found by file |
| `type`           | `$type`, and whether it was explicit, inherited or inferred                                                                                                                                    |
| `originalValue`  | As written                                                                                                                                                                                     |
| `canonicalValue` | Typed form, or empty with a flag                                                                                                                                                               |
| `resolvedValue`  | The value after following references in the token's theme context, if resolvable                                                                                                               |
| `reference`      | The original reference string and the full chain of paths followed                                                                                                                             |
| `description`    | `$description`                                                                                                                                                                                 |
| `deprecated`     | Flag and message                                                                                                                                                                               |
| `extensions`     | `$extensions`, unchanged                                                                                                                                                                       |
| `source`         | `sourcePath`, `sha256`, the JSON pointer inside the file                                                                                                                                       |
| `theme`          | Theme context (EXTRACT-11): one mode per axis the token varies on, each with its original identifier; or `shared`                                                                              |
| `namespace`      | Tag and evidence (EXTRACT-08)                                                                                                                                                                  |
| `status`         | `ok`, `warning` or `error`, with the reasons                                                                                                                                                   |
| `duplicates`     | Other sources defining the same path with the same value                                                                                                                                       |
| `override`       | Whether a configured precedence rule replaced this token, and by which source (EXTRACT-13)                                                                                                     |

Every token found in every extracted `dtcg`, `legacy-tokens` and `css-tokens` entry appears in the inventory exactly once per source definition. Entries skipped as byte-identical duplicates (EXTRACT-01 rule 4) are not counted again. The report's counts must add up: tokens found = tokens in the inventory.

`themePath` is how the same token is matched across themes (EXTRACT-11) and how layer B finds roles inside a chosen theme (PROJ-05). Collisions and conflicts are judged on `themePath` within one theme context.

## EXTRACT-10 References

1. `{path}` references are recognised in `$value` and inside composite values.
2. The original reference string is kept; the referenced path and the full chain are recorded.
3. References resolve across files and across groups.
4. **Theme context.** A token resolves references first within its own theme context (the same mode on every axis it varies on, EXTRACT-11), then against tokens that do not vary on those axes, then against `shared` tokens. It never resolves against a different mode of the same axis. A reference that would only resolve in another mode is an error.
5. Unresolved references, invalid paths and cycles are errors on the token, recorded with the chain. An unresolved reference is never replaced with a default. Cycle detection and the alias-length limit always run, so no file can make resolution loop.
6. Layer A does not report unused primitives, orphans or other reference hygiene: that is the source tool's audit. Whether an error matters is decided by layer B, by whether it uses the token (PROJ-07).

## EXTRACT-11 Themes

Themes (modes) are independent configurations. Any number of themes is allowed.

1. **Finding themes.** Evidence, strongest first:
   - level 1: explicit metadata from a known tool (`$extensions` mode or collection entries, a `tool-metadata` file listing sets per theme); one reader per tool;
   - level 2: structure (the same `themePath`s repeated under sibling groups, or across files whose paths largely overlap). P2.2-T07 sets the overlap threshold from the real samples and records it in the evidence; until then it is "at least 80% of the smaller side's paths";
   - level 3: names of groups, files or folders (`dark`, `light`, `high-contrast`), as hints only.
2. **Theme identifier.** Each mode keeps its original identifier (the mode name from metadata, the group key or the file path). Layer A never renames a mode, and never decides which mode is "light" or "dark", or which axis is the brand: that is layer B's job (PROJ-04).
3. **Shared tokens.** Tokens outside every theme are `shared`. A token is shared only where the source defines it once for all themes.
4. **No inheritance.** A token missing in one mode is not filled from another. Layer A records it and does not report it; layer B reports a missing token only when it needs it (PROJ-05 rule 5).
5. **Ambiguity.** When files share many paths with different values and the evidence does not show whether they are themes or conflicting files, layer A asks the user: "themes" (with names) or "conflict" (EXTRACT-13).
6. **Axes.** Themes may vary along more than one independent **axis**, for example a `Brand` axis (`Acme`, `Beta`) and an appearance axis (`Light`, `Dark`). Each source collection with two or more modes is one axis. A token's **theme context** is one mode on each axis it varies on (EXTRACT-09); a token that varies only on the appearance axis has the same value for every brand. Axes are found with the same evidence levels as themes: tool metadata (collections) first, then structure (a set of files or groups whose paths overlap with another set, crossed with it, for example `acme/light.json`, `acme/dark.json`, `beta/light.json`, `beta/dark.json`), then names. A layout of one base file plus one file per mode, as some Figma exporters write, is detected by structure: the base file's tokens are `shared` (or vary on another axis), and the mode files overlap. When the evidence does not show whether two sets of files are two axes or one axis with more modes, layer A asks the user.
7. Themes are detected per collection when the source has several collections, each with its own modes. A collection with a single mode (typical for a primitives collection, often named `Mode 1` or `Value`) is `shared`, not a theme.
8. Embedded tool metadata (EXTRACT-03) counts as level-1 evidence, like a separate metadata file. P2.2-T01 records the metadata shape and file layout of each tool in scope, including the Figma token plugin the product owner uses, and adds a reader for each.
9. Layer A does not produce a theme-difference or missing-tokens report: consistency between modes is the source tool's audit.

## EXTRACT-12 Outputs

Layer A produces, in memory, in a canonical order (by normalised path, then theme, then source):

1. **The token inventory** (EXTRACT-09 records).
2. **Reports:**

   | Report              | Content                                                                                      |
   | ------------------- | -------------------------------------------------------------------------------------------- |
   | `extraction-report` | Per file: class, hash, tokens found, kept, flagged; axes and modes found; totals that add up |
   | `token-inventory`   | All records, each with its status and reasons (including reference errors)                   |
   | `conflicts`         | EXTRACT-13                                                                                   |
   | `validation-report` | The checks in EXTRACT-14 with their results, as JSON and as Markdown                         |

   There are no design-quality reports (theme differences, missing tokens, unused primitives, deprecated-token lists): the source tool audits those, and the inventory still holds every fact they would show.

3. **A downloadable bundle**, generated in the browser on request, never uploaded:

   ```
   import-<date>/
   ├── manifest.json            entries, hashes, classes, theme identifiers, versions
   ├── source/                  the original files, byte for byte, at their original paths
   ├── tokens/                  the inventory, split by detected namespace and theme
   ├── reports/                 the reports above, as JSON
   └── validation/              validation-report.json and validation-report.md
   ```

   The `tokens/` split is a presentation of the inventory. File names inside it are generated by layer A and do not claim more than the detection evidence supports.

4. **Reproducibility.** The same import set gives byte-identical inventory, reports and bundle (apart from the date in the folder name). This is a tested property. To make it hold, nothing inside the outputs carries a time stamp (the manifest records the import date only as the folder name), JSON is written with sorted keys and fixed indentation, and the bundle ZIP uses a fixed modification time and a fixed entry order for every file.

Storing the inventory or the bundle on the server is out of scope for this contract.

## EXTRACT-13 Duplicates, conflicts and precedence

| Condition                                       | Action                                                                                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same path, same value, same theme context       | Deduplicate; keep all sources in `duplicates`                                                                                                                                       |
| Same path, different values, different themes   | Keep both; not a conflict                                                                                                                                                           |
| Same path, different component namespaces       | Keep both; not a conflict                                                                                                                                                           |
| Same path, different values, same theme context | Conflict; never overwritten silently                                                                                                                                                |
| Conflict with a confirmed precedence rule       | Apply it, mark the replaced token `override`, keep both in the inventory                                                                                                            |
| Conflict without a precedence rule              | Recorded on both tokens; the user resolves it (choose a source, or mark the files as themes) when it affects a token layer B uses (PROJ-07), or at any time from the conflicts view |
| Deprecated token                                | Keep and flag                                                                                                                                                                       |
| Same file name, different content               | Different sources, identified by hash and path                                                                                                                                      |

Precedence rules come from the user's answers during import. Remembering them for a later import is out of scope for v1.

## EXTRACT-14 Validation and severity

Layer A runs only safety and integrity checks (see Validation scope). Each has a result per token and per file, with a severity:

| Check                | Error when                                        | Warning when                                                                           |
| -------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| File discovery       | A limit is exceeded                               | A file is `unsupported` (including generated code) or `invalid`                        |
| Parsing and encoding | —                                                 | A file is not valid JSON (or CSS, for `.css`) or not UTF-8 (reported, others continue) |
| References           | A reference is unresolved, invalid or circular    | —                                                                                      |
| Conflicts            | A conflict is unresolved                          | —                                                                                      |
| Theme separation     | A reference resolves against the wrong mode       | —                                                                                      |
| Value integrity      | An original value differs from the source (a bug) | A canonical value could not be produced exactly                                        |
| Traceability         | A record lacks its source (a bug)                 | —                                                                                      |
| Completeness         | Tokens found ≠ tokens in the inventory (a bug)    | —                                                                                      |

**Not checked by layer A**, because the source tool audits them: full DTCG compliance of every token, ambiguous or unknown types beyond the flag on the record, namespace and naming consistency, tokens missing in some modes, unused primitives, raw values outside primitive layers, and contrast inside the design. Contrast against the product's own policy is checked on the resulting theme (THEME-06), not here.

Errors are attached to the tokens they affect. Layer A itself blocks nothing beyond the limits: it records. **Layer B decides what blocks**, by severity and by whether the affected tokens are ones it uses (PROJ-07).

## EXTRACT-15 Privacy and safety

- Files are read in the browser and never uploaded by extraction. The bundle is generated locally.
- Token names, descriptions and extension data are shown as text, never as HTML.
- Extraction never executes anything from the files and never fetches URLs found in them, including CSS `@import` and `url()`.
- CSS text from a file is never inserted into a page, a style element or a stylesheet. Only the values extracted from it, converted and validated by layer B, can reach the theme.

## EXTRACT-16 Fixtures

`libs/token-inventory/fixtures/` holds one folder per case, with the input files and the expected inventory summary and reports. At minimum: a single file; primitives and semantic in two files; files by category (colours, spacing, typography); themes as separate files; themes as groups in one file; three or more themes; unnamed modes; a file named misleadingly; mixed supported and unsupported files; generated code (SCSS, Tailwind JavaScript configuration, SwiftUI, Android XML) next to token files, rejected with its reason; a real Figma plugin export (anonymised) with a base file and Light, Dark and Brand modes; two axes (brand × appearance) from metadata, and the same from folder structure; a nested ZIP; duplicates; a conflict; a reference resolving differently per theme; a cross-theme reference error; component tokens referencing semantic tokens; typography composites; each limit. If legacy normalisation is in scope (EXTRACT-05): a Tokens Studio export with `$themes.json`; otherwise the same export, listed as not yet supported. If CSS reading is in scope (EXTRACT-05A): plain CSS with `:root` and `.dark`; `@media (prefers-color-scheme: dark)`; a Tailwind v4 `@theme` file with `oklch()` colours; `var()` references, including one with a fallback that does not resolve; computed values flagged; `@import` and `url()` not fetched; brand × appearance from compound selectors; otherwise one CSS file, listed as not yet supported.

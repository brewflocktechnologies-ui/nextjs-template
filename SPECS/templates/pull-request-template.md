<!-- Source for .github/pull_request_template.md (installed in P1.0-T06). -->

## Spec and tasks

Spec: `SPECS/phases/<file>.md` — Tasks: <IDs> — Criteria addressed: <IDs>

## Commands run and results

<!-- Exact commands and trimmed output. A CI link is required; "tests pass" alone is not accepted. -->

- CI: <link>
- Local:
  ```
  pnpm nx affected -t lint test typecheck build
  ```

## Deviations from spec

<!-- "None" or a list with reasons. Also recorded in SPECS/evidence/<spec>.md. -->

## New dependencies

<!-- One line per package: name@version — need — alternative considered. "None" otherwise. -->

## Contract changes

<!-- If libs/theme/schema/** or apps/widget/src/bridge/protocol.ts changed: add the trailer below and a note under docs/contract-changes/. -->

CONTRACT-CHANGE: <none | short description>

## Tests removed

TESTS-REMOVED: <none | justification>

## Budget exception

BUDGET-EXCEPTION: <none | justification and approver>

## Manual validation performed

<!-- Runbook chapter and steps, tenants used, date. "Not applicable" for pure refactors. -->

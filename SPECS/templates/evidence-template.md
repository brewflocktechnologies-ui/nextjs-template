# Evidence — <Spec ID> <Title>

|                    |                                                                    |
| ------------------ | ------------------------------------------------------------------ |
| Spec               | `SPECS/phases/<file>.md`                                           |
| Branch / PR        | <ref, link>                                                        |
| Implementing agent | <model / session id>                                               |
| Dates              | started <YYYY-MM-DD>, implemented <…>, verified <…>, validated <…> |

## Tasks

| Task     | State (done / deferred → phase / dropped) | Note |
| -------- | ----------------------------------------- | ---- |
| <ID>-T01 |                                           |      |

## Acceptance criteria

| Criterion | Level | Result      | Proof (test name, CI link, command output excerpt) |
| --------- | ----- | ----------- | -------------------------------------------------- |
| <ID>-AC01 |       | pass / fail |                                                    |

## Verification — implementing agent

<Section 8 of the spec, each step with the exact command and the observed result (trimmed output). Date and environment (OS, Node, pnpm).>

## Independent verification

<Same steps, run by a different agent or a fresh session from a clean clone. Signed with session id and date. Any discrepancy with the block above is listed here and resolved before Verified.>

## Manual validation

| Runbook step | Tenant(s) | Result | Observation | Date | Validator |
| ------------ | --------- | ------ | ----------- | ---- | --------- |

## Measurements (if any)

<Table; also copied to `docs/architecture/baselines.md`.>

## New dependencies

| Package | Version | Need (one sentence) | Alternative considered |
| ------- | ------- | ------------------- | ---------------------- |

## Deviations and findings

<Anything done differently from the spec, with reason; anything discovered that belongs in another phase (with the phase named); spec corrections made.>

## Status transitions

| Transition  | By  | Date |
| ----------- | --- | ---- |
| Approved    |     |      |
| Implemented |     |      |
| Verified    |     |      |
| Validated   |     |      |
| Accepted    |     |      |

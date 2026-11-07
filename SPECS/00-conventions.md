# Spec conventions

## Identifiers

| Kind                 | Pattern                            | Example                                        |
| -------------------- | ---------------------------------- | ---------------------------------------------- |
| Phase spec           | `P<major>.<n>` or `PoC-<letter>`   | `P1.3`, `PoC-A`                                |
| Task                 | `<spec>-T<nn>`                     | `P1.3-T04`                                     |
| Acceptance criterion | `<spec>-AC<nn>`                    | `P1.3-AC07`                                    |
| Decision             | `D-<nn>` (in `DECISIONS.md`)       | `D-02`                                         |
| Contract clause      | `<contract>-<nn>`                  | `BRIDGE-12`, `THEME-05`, `BOUND-03`, `ENDP-04` |
| Threat               | `T-<nn>` (ARCH-001 §13 numbering)  | `T-04`                                         |
| Tenant fixture       | `t_<name>` / `wk_<name>_<purpose>` | `t_globex`, `wk_globex_demo`                   |

Test names reference the criterion they prove: `it('P1.3-AC07 rejects url( in colour values', …)`. A grep for `AC` IDs in the test tree must find every automated criterion of an accepted phase.

## Verification levels

Each acceptance criterion carries exactly one level tag.

| Tag         | Meaning                                                                                                                | Who           | Where recorded                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------- |
| `[auto]`    | Enforced by CI on every PR (test, lint, build assertion, script)                                                       | CI            | CI run link in evidence                                             |
| `[agent]`   | Reproducible command sequence with an expected result, run by the implementing agent and again by an independent agent | Agents        | Evidence file, both blocks                                          |
| `[manual]`  | Human observes behaviour on the local stack, following the runbook                                                     | Product owner | Evidence file, "Manual validation" block, with date and tenant used |
| `[measure]` | A number is recorded (size, time); it becomes a budget later                                                           | Agent         | `docs/architecture/baselines.md` and evidence                       |

A phase is **Verified** when every `[auto]` and `[agent]` criterion passes in both verification blocks, and **Validated** when every `[manual]` criterion is signed.

## Spec anatomy

Every phase spec has these sections in this order. Empty sections say "None".

1. **Header table**: status, depends on, unblocks, ARCH-001 sections, ADRs, effort estimate from ARCH-001 §16.
2. **Goal**: two or three sentences.
3. **Preconditions**: checkable facts (commands with expected output) that must hold before T01.
4. **Scope**: in / out, explicitly naming tempting adjacent work that is out.
5. **Decisions applied**: which `D-nn` apply, and any decision this spec fixes itself.
6. **Tasks** `T-nn`: what, where (paths), done-when. Ordered; independence stated where it exists.
7. **Acceptance criteria** `AC-nn` with level tags.
8. **Quality gates introduced**: exact CI changes; which gates become merge-blocking at this phase (ARCH-001 §14.2).
9. **Verification procedure (agent)**: numbered commands and expected results. Must be runnable from a clean clone on Linux and Windows.
10. **Manual validation (human)**: browser-level steps using the local stack and named tenants.
11. **Evidence to record**: the fields `evidence/<spec>.md` must contain.
12. **Exit and approval**: ADR status changes, STATUS.md transition, what unblocks.
13. **Risks and notes**.

## Definition of done (all phases)

- All tasks done or explicitly deferred in the evidence file with a reason and a target phase.
- `pnpm nx affected -t lint test typecheck build` green locally and in CI for the PR.
- `pnpm nx format:check` green.
- Evidence file complete, including dependency sentences and any deviations.
- No TODO/FIXME introduced without an issue reference.
- The phase spec itself updated if implementation revealed an error in it (noted in evidence as a spec correction, not a deviation).

## Writing style for agents

Specs state requirements with **must / must not / should**. "Should" items may be deferred with a note; "must" items may not. File paths are relative to the repository root. Commands are given in the pnpm form (`pnpm nx …`) from P1.1 onwards and in npm form (`npx nx …`) in P1.0 only, because the package manager changes in P1.1 (D-02).

## Status vocabulary (STATUS.md)

`Not started` → `Approved` → `In progress` → `Implemented` → `Verified` → `Validated` → `Accepted`. A phase can also be `Blocked` (with the blocker named) or `Deferred`.

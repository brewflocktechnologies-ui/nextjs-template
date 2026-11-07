# P<major>.<n> — <Title>

|            |                                                                   |
| ---------- | ----------------------------------------------------------------- |
| Status     | see `STATUS.md`                                                   |
| Depends on | <phases that must be `Accepted`; decisions that must be answered> |
| Unblocks   | <phases>                                                          |
| ARCH-001   | <sections>                                                        |
| Contracts  | <files under `contracts/`>                                        |
| ADRs       | <ADR-nnn → status change>                                         |
| Effort     | <from ARCH-001 §16 or estimate>                                   |

## 1. Goal

<Two or three sentences: what exists at exit that did not exist at entry, and why it matters.>

## 2. Preconditions

<Commands with expected output; STATUS.md states.>

## 3. Scope

**In:** <…>
**Out:** <tempting adjacent work, named, with the phase that owns it>

## 4. Decisions applied

<`D-nn` list; decisions fixed by this spec, stated as rules.>

## 5. Tasks

| ID       | Task | Where | Done when |
| -------- | ---- | ----- | --------- |
| P<x>-T01 |      |       |           |

Order: <…>

## 6. Acceptance criteria

| ID        | Criterion | Level                                           |
| --------- | --------- | ----------------------------------------------- |
| P<x>-AC01 |           | `[auto]` / `[agent]` / `[manual]` / `[measure]` |

## 7. Quality gates introduced

<CI changes; what becomes merge-blocking and when.>

## 8. Verification procedure (agent)

1. <command> → <expected>

## 9. Manual validation (human)

`validation/manual-validation-runbook.md` → <chapter>.

## 10. Evidence to record

<fields>

## 11. Exit and approval

<STATUS.md transition; ADR status changes; what becomes eligible.>

## 12. Risks and notes

<…>

# P0 — Baseline approval and open decisions

|            |                                                                                       |
| ---------- | ------------------------------------------------------------------------------------- |
| Status     | see `STATUS.md`                                                                       |
| Depends on | —                                                                                     |
| Unblocks   | P1.0                                                                                  |
| ARCH-001   | §1, §2, §18, §19, §20.1                                                               |
| ADRs       | 001, 002, 003, 008, 009, 010, 011 → to be _Accepted_; 004, 005, 006, 007 → _Proposed_ |
| Effort     | one review session with the product owner                                             |

## 1. Goal

Turn ARCH-001 v0.3 plus `SPECS/DECISIONS.md` into an approved working baseline, so that P1.0 can write the ADR files with their agreed statuses and P1.1 can convert the repository. P0 produces decisions and signatures, not code.

## 2. Preconditions

- `docs/architecture/ARCHITECTURE-001-saas-frontend-foundation.md` is at v0.3 (header says so).
- `SPECS/` exists with `DECISIONS.md`, `STATUS.md`, contracts and phase specs (this folder).

## 3. Scope

**In:** reading, deciding, recording. **Out:** any file outside `SPECS/STATUS.md` and `SPECS/evidence/P0.md`; any change to ARCH-001 itself (a later v0.4 may incorporate P0's answers, by the architecture owner).

## 4. Decisions applied

All of `DECISIONS.md`. P0 is where the product owner may overturn any **Default** decision at the stated cost.

## 5. Tasks

| ID     | Task                                                                                                                                                                              | Done when                                                                                                                                                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-T01 | Product owner reads ARCH-001 §1–§2 (summary and challenges) and `SPECS/DECISIONS.md` in full                                                                                      | —                                                                                                                                                                                                                                  |
| P0-T02 | Decide **D-02** (migrate to pnpm)                                                                                                                                                 | Answer in `STATUS.md` → "Product-owner answers"                                                                                                                                                                                    |
| P0-T03 | Decide **D-06** (brand name → package scope, element prefix, Trusted Types policy name). If undecided, `acme` stays and the rename cost moves to "before P1.1 T02"                | Answer recorded; if a name is given, a line "Rename `acme` → `<name>` is P1.1-T00" is added to P1.1                                                                                                                                |
| P0-T04 | Decide **Q-013**, **Q-014**, **Q-015** or accept defaults                                                                                                                         | Answers recorded                                                                                                                                                                                                                   |
| P0-T05 | Confirm the local tenant set (`validation/tenant-fixtures.md`) or edit names/brands                                                                                               | Table confirmed or edited in place                                                                                                                                                                                                 |
| P0-T06 | Confirm the local ports (D-10) do not collide with other software on the product owner's machine                                                                                  | Confirmed                                                                                                                                                                                                                          |
| P0-T07 | Accept ADR-001, 002, 003, 008, 009, 010, 011 with the decision text of ARCH-001 §18 (as amended by DECISIONS.md D-02, D-05, D-07, D-08); set ADR-004, 005, 006, 007 to _Proposed_ | ADR status tracker in `STATUS.md` filled; P1.0 will write the files                                                                                                                                                                |
| P0-T08 | Sign the approval record                                                                                                                                                          | `SPECS/evidence/P0.md` created from `templates/evidence-template.md` with the §20.1 checklist ticked and the role/name/date table filled (product owner at minimum; architecture owner and security reviewer if those roles exist) |
| P0-T09 | Set `P1.0` to `Approved` in `STATUS.md`                                                                                                                                           | Line present                                                                                                                                                                                                                       |

## 6. Acceptance criteria

| ID      | Criterion                                                                               | Level                                                              |
| ------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| P0-AC01 | Every row of "Product-owner answers" in `STATUS.md` has an answer or the word "default" | `[manual]`                                                         |
| P0-AC02 | ADR status tracker has a status for all eleven ADRs                                     | `[manual]`                                                         |
| P0-AC03 | `evidence/P0.md` exists with the signed table                                           | `[manual]`                                                         |
| P0-AC04 | No file outside `SPECS/` changed in the P0 commit                                       | `[agent]` (`git diff --stat` of the P0 commit shows only `SPECS/`) |

## 7. Quality gates introduced

None.

## 8. Verification procedure (agent)

1. `git show --stat HEAD` on the P0 commit → only paths under `SPECS/`.
2. Read `SPECS/STATUS.md` → P0 `Accepted`, P1.0 `Approved`, all answer rows filled.

## 9. Manual validation (human)

This phase _is_ the manual step. Use the checklist in §5.

## 10. Evidence to record

`evidence/P0.md`: the §20.1 checklist, the answers table (copy of STATUS.md rows), signatures, and a "Decisions overturned" list (possibly empty).

## 11. Exit and approval

P0 → `Accepted`. P1.0 → `Approved`. ADR statuses as decided, ready for P1.0 to write.

## 12. Risks and notes

- The most consequential default is D-02 (pnpm). Reversing it after P1.1 costs a day; reversing it now costs nothing.
- D-06 (brand) is cosmetic but touches every package name; deciding it before P1.1 avoids eight project moves later.
- Q-013 only bites at P1.6; it can be left open at P0 and answered before P1.6 is approved, at no cost.

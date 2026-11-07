# Contract changes

One note per change to a contract file (`libs/theme/schema/**`, `apps/widget/src/bridge/protocol.ts`), named `YYYY-MM-DD-<topic>.md`. Each note says what changed, why, which consumers are affected and how stored data migrates. CI checks that a PR changing a contract adds a note and a `CONTRACT-CHANGE:` line (`tools/scripts/policy/check-contract-change.mjs`).

Phase 1 contracts were created, not changed, in P1.3 (theme v1) and PoC-A (bridge v1, including the PoC-A addition of `launcherTheme.shape`), so no notes exist yet.

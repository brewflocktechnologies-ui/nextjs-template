# Measured baselines and budgets

Method (ADR-009, ARCH-001 §14.3): PoC-A records each measurement; P1.5 sets budget = baseline + 15 %, ratcheted down on each reduction. Raising a budget needs `BUDGET-EXCEPTION:` in the PR.

## Widget

| Measurement          | Raw | gzip | brotli | Budget (gzip) | Date | Commit | Machine and profile |
| -------------------- | --- | ---- | ------ | ------------- | ---- | ------ | ------------------- |
| `loader.js`          |     |      |        |               |      |        |                     |
| `launcher.[hash].js` |     |      |        |               |      |        |                     |
| Frame initial JS     |     |      |        |               |      |        |                     |
| Frame initial CSS    |     |      |        |               |      |        |                     |

| Timing (median of 5, CPU 4×, Fast 3G) | Value | Date | Commit |
| ------------------------------------- | ----- | ---- | ------ |
| Launcher first paint                  |       |      |        |
| Frame `ready`, created at idle        |       |      |        |
| Frame `ready`, created on open        |       |      |        |

## React (PoC-B, P1.4)

| Measurement                      | gzip | Date | Commit |
| -------------------------------- | ---- | ---- | ------ |
| Dialog + Combobox minimal bundle |      |      |        |

## Dashboard

LCP and INP budgets are set at P1.7, once a representative route exists.

# Developer guide

## First run

1. Install Node 24. The repository's `.node-version` says `24`; `nvm`, `fnm` or Volta pick it up.
2. Clone the repository. The repository is LF-only; `.gitattributes` enforces this on checkout even when Windows sets `core.autocrlf=true`.
3. Make sure `pnpm` resolves to the version in `package.json` `packageManager` (11.28.10). Either run `corepack enable` once, or use a globally installed pnpm 9.7 or later, which switches versions automatically. Check with `pnpm --version` inside the repository.
4. Install dependencies with `pnpm install --frozen-lockfile`. Never use npm or yarn here.
5. Install the Playwright browser once with `pnpm exec playwright install --with-deps chromium`.
6. Start the local stack with `pnpm stack`, then run `pnpm stack:check` in a second terminal. The dashboard is at `http://localhost:3000`, the widget origin at `http://localhost:4400` and the playground at `http://localhost:4300`.
7. Check everything CI checks with `pnpm verify` (add `--quick` to skip end-to-end tests).

More on the local stack: `SPECS/validation/local-stack.md`.

## Windows notes

- Use PowerShell or Git Bash. Every repository script is Node, so neither needs extra tools.
- Use one checkout per environment, either native Windows or WSL2, not both on the same folder.
- If ports 3000, 4300, 4400, 4600 or 4700 are taken, free them rather than changing them. The widget's preview mode is pinned to the dashboard origin.
- `next dev` regenerates `apps/admin-dashboard/next-env.d.ts` and `apps/admin-dashboard/AGENTS.md`. Commit them as they are.
- Stop `pnpm stack` with Ctrl+C in its terminal. If a dev server survives, for example after closing the terminal window, find it with `netstat -ano | findstr :4400` and end it in Task Manager.

## Where things are

- Rules for agents and developers: `AGENTS.md`.
- Phase specs and the status board: `SPECS/`.
- Decisions: `docs/adr/`.

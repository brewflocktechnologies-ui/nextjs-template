# Developer guide

## First run

1. Install Node 24. The repository's `.node-version` says `24`; `nvm`, `fnm` or Volta pick it up.
2. Clone the repository. The repository is LF-only; `.gitattributes` enforces this on checkout even when Windows sets `core.autocrlf=true`.
3. Install dependencies with `npm ci`. From P1.1 this becomes `corepack enable` and `pnpm install --frozen-lockfile`.
4. Install the Playwright browser once with `npx playwright install --with-deps chromium`.
5. Start the dashboard with `npx nx run @nextjs-template/web:dev` and open `http://localhost:3000`.
6. Check everything CI checks with `npm run verify` (add `-- --quick` to skip end-to-end tests).

From P1.1 the full local stack runs with `pnpm stack`; see `SPECS/validation/local-stack.md`.

## Windows notes

- Use PowerShell or Git Bash. Every repository script is Node, so neither needs extra tools.
- Use one checkout per environment, either native Windows or WSL2, not both on the same folder.
- If ports 3000, 4300, 4400, 4600 or 4700 are taken, free them rather than changing them. The widget's preview mode is pinned to the dashboard origin.
- `next dev` regenerates `apps/web/next-env.d.ts` and `apps/web/AGENTS.md`. Commit them as they are.

## Where things are

- Rules for agents and developers: `AGENTS.md`.
- Phase specs and the status board: `SPECS/`.
- Decisions: `docs/adr/`.

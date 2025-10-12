# Repository Guidelines

## Project Structure & Module Organization
- Client code lives in `src/`, organized by feature folders with colocated components, hooks, and styles.
- Edge code is in `worker.ts`; Postgres experiments sit in `main-postgres/`; SQL fixtures reside in `data/`.
- Automation scripts are under `scripts/`; plans stay in `docs/`; test suites live in `tests/` (`unit`, `integration`, `e2e`, `fixtures`).
- Output in `dist/` is generated—never edit it directly.

## Build, Test, and Development Commands
- `pnpm install` keeps dependencies aligned with the lockfile.
- `pnpm dev` starts the Vite app; run `pnpm dev:worker` in another shell to exercise the Cloudflare Worker locally.
- `pnpm build` or `pnpm build:with-typecheck` produce production bundles; the latter runs the CI TypeScript project first.
- `pnpm lint`, `pnpm format:check`, and `pnpm typecheck` should all pass before pushing.
- `pnpm test` / `pnpm test:watch` execute Vitest suites; `npx playwright test` drives E2E coverage in `tests/e2e`.

## Coding Style & Naming Conventions
- Use TypeScript + React with Prettier defaults (2 spaces, single quotes, no semicolons) and the shared `eslint.config.mjs` rules.
- Components and contexts use PascalCase, hooks use `useCamelCase`, and exported constants use `UPPER_SNAKE_CASE`.
- Keep imports sorted; run `pnpm format` if the sort-imports plugin or Tailwind class ordering complains.
- Favor functional components with defined prop interfaces; colocate `.test.ts(x)` and style files with their owners.

## Testing Guidelines
- Unit specs belong beside source files as `*.test.ts(x)` and should cover success, failure, and edge conditions.
- Integration and browser flows run from `tests/integration` and `tests/e2e`; mark unstable cases with comments.
- Share fixtures from `tests/fixtures` and SQL assets in `data/` to keep sync regressions reproducible.
- Document commands you ran in the PR test plan; CI must be green before requesting review.

## Commit & Pull Request Guidelines
- Start work with `./scripts/start-issue.sh <issue>` to create a worktree and finish with `./scripts/finish-issue.sh` once merged.
- Write imperative commit subjects (e.g., `Reduce verbose logging in entity sync`) and keep each commit scoped to one change.
- Rebase away temporary `[TEMP]` checkpoints before opening a PR.
- PRs need a summary, linked issues, validation commands, and screenshots for UI updates.

## Environment & Security Notes
- Store secrets in `.env.local` (gitignored) and configure worker credentials through `wrangler.toml`; never commit live keys.
- Update `config/chrome-debug.json` only for local debugging and revert sensitive endpoints before pushing.
- Clear `cookies.txt` and `mantle-cookies.txt` of real tokens prior to commits.

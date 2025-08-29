# Project CRUSH.md

## Build/Lint/Test Commands

- **Build All**: `pnpm build`
- **Build Web**: `pnpm --filter vibestack-web build`
- **Build Server**: `pnpm --filter server build`
- **Lint**: `pnpm lint` (Fix: `pnpm lint:fix`)
- **Type Check**: `pnpm type-check`
- **Test All**: (No single root command found, typically run per package or via CI)
- **Test Server**: `pnpm --filter server test`
- **Run single Vitest test (Server)**: `pnpm --filter server vitest run -- path/to/your.test.ts`
- **Format**: `pnpm format`

## Code Style Guidelines

- **Imports**: Prettier handles formatting. No strict ESLint import order, follow existing patterns.
- **Formatting**: Enforced by Prettier (`pnpm format`).
- **Types**: TypeScript is primary. Avoid `any` and non-null assertions where possible. Unused vars (prefixed with `_` allowed).
- **Naming**: Follow existing `camelCase` for functions/variables, `PascalCase` for components/classes.
- **Error Handling**: `no-console` is 'warn' for JS, 'error' for `apps/web`, 'off' for `apps/server` and scripts.
- **General**: Prefer `const`/`let` over `var`. `no-debugger` is an error in web apps.
- **Ignored Files**: ESLint ignores generated files (e.g., `src/routeTree.gen.ts`, `src/components/ui`, `dataforge/src/generated`).

## AI Agent Rules

- **Cursor Rules**: No `.cursor/rules/` or `.cursorrules` found.
- **Copilot Rules**: No `.github/copilot-instructions.md` found.

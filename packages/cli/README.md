# @repo/cli

This package contains various command-line interface (CLI) scripts for the monorepo, such as setup utilities and administrative tasks.

## Prerequisites

Ensure you have `pnpm` installed and have run `pnpm install` from the monorepo root to install all dependencies.

## Environment Variables

Some commands may require environment variables. Copy `packages/cli/.env.example` to `packages/cli/.env` and populate it with the necessary values for your local environment.

```
cp packages/cli/.env.example packages/cli/.env
```

## Available Commands

You can run commands using the root-level `cli` script.

### `seed-users`

Seeds the database with an initial set of users, including a super admin and batch users.

**Usage:**
```bash
pnpm cli seed-users
```

*(More commands will be documented here as they are added.)*
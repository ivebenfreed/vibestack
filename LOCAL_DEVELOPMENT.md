# Local Development Guide

This guide explains how to use the local development environment with PostgreSQL and Neon HTTP proxy.

## Setup

1. **Start Docker containers**:
   ```bash
   pnpm db:start
   ```

2. **Run migrations on local database**:
   ```bash
   pnpm forge:migrate:local
   ```

3. **Start development servers**:
   ```bash
   pnpm dev:local
   ```

## Available Commands

All development commands have `:local` variants that use the local PostgreSQL database via Neon HTTP proxy:

### Basic Development
- `pnpm dev` - Remote Neon database
- `pnpm dev:local` - Local PostgreSQL via Neon proxy

### PR-specific Development
- `pnpm dev:pr` - Remote with dynamic ports
- `pnpm dev:pr:local` - Local with dynamic ports

### Debug Modes
- `pnpm dev:debug` - Remote with debug logging
- `pnpm dev:debug:local` - Local with debug logging
- `pnpm dev:info` - Remote with info logging
- `pnpm dev:info:local` - Local with info logging

### Web-only Development
- `pnpm dev:web` - Remote, web only
- `pnpm dev:web:local` - Local, web only
- `pnpm dev:web:debug` - Remote, web only with debug
- `pnpm dev:web:debug:local` - Local, web only with debug

### PWA Testing
- `pnpm dev:pwa-test` - Remote PWA test
- `pnpm dev:pwa-test:local` - Local PWA test

### Database Commands
- `pnpm db:start` - Start Docker containers
- `pnpm db:stop` - Stop Docker containers
- `pnpm db:reset` - Reset database (removes all data)
- `pnpm db:logs` - View Docker logs

### Migration Commands
- `pnpm forge:migrate:run` - Run migrations (remote)
- `pnpm forge:migrate:local` - Run migrations (local)
- `pnpm forge:migrate:generate` - Generate migration (remote)
- `pnpm forge:migrate:local:generate` - Generate migration (local)
- `pnpm forge:migrate:show` - Show migrations (remote)
- `pnpm forge:migrate:local:show` - Show migrations (local)

## Environment Configuration

### Remote Development
- Uses `.dev.vars`
- Connects to Neon cloud database
- Uses `wrangler.toml` or `wrangler.generated.toml`

### Local Development
- Uses `.dev.vars.local`
- Connects to `http://db.localtest.me:4444/sql`
- Uses `wrangler.local.toml` or `wrangler.generated.local.toml`

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Client    │────▶│    Server    │────▶│ Neon Proxy │
│  (Port 5173)│     │  (Port 8787) │     │ (Port 4444)│
└─────────────┘     └──────────────┘     └────────────┘
                                                 │
                                                 ▼
                                         ┌────────────┐
                                         │ PostgreSQL │
                                         │ (Port 5432)│
                                         └────────────┘
```

## Switching Between Local and Remote

Simply use the appropriate command variant:
- Commands without `:local` use remote Neon
- Commands with `:local` use local PostgreSQL

No code changes or manual environment variable switching required!
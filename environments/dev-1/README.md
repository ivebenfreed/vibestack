# VibeStack Development Environment 1

**Portable, Self-Contained Development Environment**

This folder contains everything needed for a complete VibeStack development environment that can be copied and used on any system with Docker.

## Quick Start

```bash
# Single command to set up everything and start Claude Code
./init-and-start.sh
```

That's it! This will:
- Start containers (PostgreSQL + Chrome + development environment)
- Initialize git repository  
- Create CLAUDE.md configuration
- Install Claude Code with session planning
- Launch Claude Code ready for VibeStack development

## What's Included

### Files in This Directory
- **`init-and-start.sh`** - Master script that sets up everything from scratch
- **`docker-compose.devenv-1.yml`** - Complete container orchestration
- **`Dockerfile.dev`** - Container image definition
- **`start.sh`** - Start containers only
- **`stop.sh`** - Stop containers
- **`enter.sh`** - Enter container (manual access)
- **`setup-claude.sh`** - Basic Claude Code setup (legacy)

### What Gets Created
- **Git repository** - Properly initialized in container
- **CLAUDE.md** - VibeStack-specific Claude Code configuration
- **Session planning** - Automatic session tracking and context injection
- **Development servers** - Web (5173) and API (8787) in container
- **Test database** - PostgreSQL with VibeStack schema and data

## Port Mappings

| Service | Host Port | Container Port | Description |
|---------|-----------|----------------|-------------|
| Web App | 5175      | 5173          | Vite development server |
| API     | 8789      | 8787          | Hono API server |
| Chrome  | 3000      | 3000          | Browserless Chrome API |
| Debug   | 9222      | 9222          | Chrome remote debugging |

## Environment Details

### Container Specifications
- **Base**: Ubuntu 22.04 LTS  
- **User**: `developer` (UID 1000, non-root)
- **Working Directory**: `/workspace`
- **Claude Code**: Pre-installed at `/home/developer/.local/bin/claude`
- **Session Planning**: Fully configured with VibeStack templates

### Development Stack
- **Frontend**: React + Vite + TypeScript + Legend State
- **Backend**: Cloudflare Workers + Hono + Better Auth  
- **Database**: PostgreSQL 17 + Kysely ORM
- **Package Manager**: pnpm (monorepo workspaces)
- **Testing**: Playwright MCP integration

### Test Credentials
- **Owner**: ceo@widecorp.com / WideCorp2024!CEO
- **Admin**: cto@widecorp.com / WideCorp2024!CTO
- **Manager**: pm1@widecorp.com / WideCorp2024!PM1
- **Member**: dev1@widecorp.com / WideCorp2024!DEV1

## Manual Operations

### Individual Script Usage
```bash
# Start containers only
./start.sh

# Stop everything
./stop.sh

# Manual container access
./enter.sh

# Setup Claude Code only (if needed)
./setup-claude.sh
```

### Inside Container Commands
```bash
# Development servers
pnpm dev              # Start both web and API
pnpm dev:web          # Web only
pnpm dev:server       # API only

# Quality checks
pnpm type-check       # TypeScript validation
pnpm build            # Production build

# Session planning (automatic)
claude                # Starts with session context
```

## Portability

This entire folder is **completely portable**:

1. **Copy this folder** to any system with Docker
2. **Run `./init-and-start.sh`** - everything else is automatic
3. **No external dependencies** - all configurations are self-contained

### System Requirements
- Docker and Docker Compose
- Internet connection (for initial Claude Code installation)
- ~4GB RAM for containers
- ~2GB disk space for images and data

## Session Planning Features

Claude Code runs with enhanced session planning:
- **Auto-session creation**: Date-based sessions with reuse logic
- **Context injection**: Every prompt includes VibeStack environment info
- **Progress tracking**: Goal-based planning with completion tracking
- **VibeStack templates**: Pre-configured for project workflow

### Session Directory Structure
```
/workspace/sessions/
├── 2025-08-30/
│   ├── session-1/
│   │   ├── plan.md           # Goals and progress
│   │   └── session-summary.md # Auto-generated summary
│   └── session-2/
└── .claude/
    ├── settings.json         # Hook configuration
    └── session-start.sh      # Session management
```

## Troubleshooting

### Common Issues
1. **Permission errors**: Run `./stop.sh` then `./init-and-start.sh` to reset
2. **Port conflicts**: Check that ports 5175, 8789, 3000, 9222 are available
3. **Container won't start**: `docker system prune` to clean up resources
4. **Claude Code missing**: Script will auto-install on first run

### Reset Everything
```bash
./stop.sh
docker system prune -f
./init-and-start.sh
```

---

**Created**: Self-contained VibeStack development environment  
**Version**: Portable with integrated Claude Code session planning  
**Usage**: `./init-and-start.sh` for complete setup and launch
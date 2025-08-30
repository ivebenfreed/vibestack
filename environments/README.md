# Development Environments

This directory contains scripts to manage multiple isolated development environments for the VibeStack project.

## Available Environments

### Main Environment (Project Root)
- **Location**: Project root directory
- **Ports**: Web (5173), API (8787)
- **Type**: Host-based development
- **Usage**: Primary staging environment
- **Commands**: `pnpm dev`, `pnpm dev:web`, `pnpm dev:server`

### Dev Environment 1
- **Location**: `environments/dev-1/`
- **Ports**: Web (5175→5173), API (8789→8787)
- **Type**: Containerized development
- **Usage**: Isolated development for parallel work

### Dev Environments 2 & 3
- **Location**: `environments/dev-2/`, `environments/dev-3/`
- **Status**: Templates ready for setup
- **Usage**: Additional isolated environments as needed

## Quick Start

### Main Environment (Project Root)
```bash
# Already in the main staging environment
pnpm dev              # Start both web and API
pnpm dev:web         # Start only web app
pnpm dev:server      # Start only API server
```

### Containerized Environments
```bash
# Start containerized environment 1
cd environments/dev-1
./start.sh

# Enter container with Claude Code
./enter.sh

# Setup enhanced Claude Code with session planning (recommended)
./setup-claude-enhanced.sh

# Or setup basic Claude Code only
./setup-claude.sh
```

## Syncing Environments

### Main Environment
```bash
# Sync main environment (from project root)
git pull origin staging
pnpm install
./scripts/sync-remote-to-local.sh  # If available
```

### Containerized Environments
```bash
# Sync all containerized environments
cd environments
./sync-all.sh

# Sync specific environment
cd environments/dev-1
./sync.sh

# Fresh complete reset and sync
cd environments/dev-1
./fresh-sync.sh
```

## Port Mappings

| Environment | Web (Host) | Web (Container) | API (Host) | API (Container) |
|-------------|------------|-----------------|------------|-----------------|
| Main (Root) | 5173       | -               | 8787       | -               |
| Dev-1       | 5175       | 5173            | 8789       | 8787            |
| Dev-2       | 5176       | 5173            | 8790       | 8787            |
| Dev-3       | 5177       | 5173            | 8791       | 8787            |

## Workflow Examples

### Daily Development
```bash
# Morning sync - main environment
git pull origin staging && pnpm install

# Sync containerized environments
cd environments && ./sync-all.sh

# Work in main environment
pnpm dev

# Switch to isolated work
cd environments/dev-1 && ./start.sh && ./enter.sh
```

### Working on Multiple Issues
```bash
# Issue 1: Main staging environment
pnpm dev

# Issue 2: Separate container (in another terminal)
cd environments/dev-1
./sync.sh && ./start.sh && ./enter.sh
```

### Clean Slate Development
```bash
# Start completely fresh isolated environment
cd environments/dev-1
./fresh-sync.sh
./start.sh
./enter.sh
```

## Sync Scripts Explained

### `sync-all.sh` (All Containerized Environments)
- Pulls latest code to main project
- Updates main project dependencies
- Syncs all configured containerized environments

### `dev-*/sync.sh` (Standard Container Sync)
- Pulls latest code changes to main project
- Updates container with latest code
- Syncs database from remote/local to container
- Maintains existing container state

### `dev-*/fresh-sync.sh` (Complete Container Reset)
- **⚠️ Destructive**: Removes container and data
- Pulls latest code changes to main project
- Creates fresh container with clean database
- Loads latest database dump
- Use when you want a completely clean state

## Claude Code in Containers

### Automatic Setup
The containerized environments run as a non-root `developer` user (UID 1000) to ensure Claude Code works properly without permission issues.

### Container User Details
- **User**: `developer` (UID 1000, matches host user)
- **Home**: `/home/developer`
- **Working Directory**: `/workspace`
- **Claude Code Location**: `~/.local/bin/claude`
- **No root permissions needed**: Runs safely without `--dangerously-skip-permissions`

### Available Scripts
```bash
cd environments/dev-1

# Enter container with Claude Code ready
./enter.sh

# Setup enhanced Claude Code with session planning (recommended)  
./setup-claude-enhanced.sh

# Or setup basic Claude Code only
./setup-claude.sh

# Start development servers
./start.sh

# Sync latest code and database
./sync.sh

# Fresh reset (destructive)
./fresh-sync.sh

# Stop environment
./stop.sh
```

### Inside the Container
```bash
developer@container:/workspace$ whoami
developer

developer@container:/workspace$ id  
uid=1000(developer) gid=1000(developer) groups=1000(developer)

developer@container:/workspace$ claude --version
1.0.98 (Claude Code)

developer@container:/workspace$ claude
# Starts Claude Code without any permission errors!
```

## Enhanced Claude Code with Session Planning

### Features
The enhanced setup integrates session planning and tracking features from the `claudesessiontracking` project:

- **Automatic Session Management**: Creates and reuses sessions based on date and time
- **Planning Context Injection**: Every prompt includes session context and current goals
- **VibeStack-Specific Templates**: Pre-configured for VibeStack development workflow
- **Session Summaries**: Automatic summaries generated on exit
- **Container-Aware Configuration**: Integrated with port mappings and environment setup

### Enhanced Setup Commands
```bash
# Setup all running environments at once
cd environments
./setup-all-enhanced.sh

# Setup specific environment
cd environments/dev-1  
./setup-claude-enhanced.sh dev-1

# Verify setup
./enter.sh
claude  # Will now include session planning features
```

### Session Planning Features
Once enhanced setup is complete, Claude Code will:

1. **Auto-create sessions** in `/workspace/sessions/YYYY-MM-DD/session-N/`
2. **Inject context** showing current goals and progress on every prompt
3. **Provide templates** with VibeStack-specific development guidance
4. **Track progress** with plan.md files that can be marked as completed
5. **Generate summaries** when sessions end

### Session File Structure
```
/workspace/sessions/
├── 2025-08-30/
│   ├── session-1/
│   │   ├── plan.md           # Session goals and progress
│   │   ├── work-log.md       # Detailed activity log  
│   │   └── session-summary.md # Auto-generated summary
│   └── session-2/
│       └── ...
└── .claude/
    ├── settings.json         # Hook configuration
    ├── session-start.sh      # Session creation script
    ├── planning-context.sh   # Context injection script
    └── sessions.log          # Session activity log
```

### VibeStack Integration
The enhanced setup is pre-configured for VibeStack development:

- **Port mappings**: Automatically configured for container port forwarding
- **Test credentials**: Includes Wide Corp test user information
- **Development commands**: Pre-filled with `pnpm dev`, `pnpm type-check`, etc.
- **Database context**: Aware of PostgreSQL container and sync requirements

## Benefits

- **Main Environment**: Direct staging branch development
- **Complete Isolation**: Each containerized environment is fully isolated
- **Standard Ports**: Each container uses standard ports internally (5173, 8787)
- **Easy Management**: Simple scripts for containerized environments
- **Parallel Development**: Work on multiple issues simultaneously
- **No Conflicts**: No port conflicts between environments
- **Database Sync**: Automatic syncing of latest database dumps
- **Version Control**: Containerized environments stay up-to-date with main staging
- **Claude Code Ready**: Non-root setup allows Claude Code to run safely
- **Session Planning**: Enhanced setup includes automatic session tracking and planning
- **Context-Aware Development**: Every prompt includes VibeStack-specific context and progress
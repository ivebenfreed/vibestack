# Docker Configuration Organization

This directory contains the main Docker configuration files for the VibeStack project.

## Structure

```
docker-configs/
├── docker-compose.yml     # Production-like configuration
├── docker-compose.dev.yml # Development configuration
└── README.md             # This file
```

## Worktree Docker Configs

Worktree-specific Docker configurations are generated dynamically and stored in a **`.docker/` folder inside each worktree directory**, not here. This ensures:

- Each worktree has its own isolated configuration
- Cleanup is automatic when the worktree is removed
- No accumulation of stale configs in the main repo
- Clean separation from source code

### Generated Worktree Files

When you run `./scripts/setup-pr-env.sh` in a worktree (e.g., `worktrees/issue-60/`), it creates:
- `.docker/docker-compose.pr-60.yml` - Docker config with custom ports/names for that issue

The `.docker/` folder is gitignored, so these generated configs are never committed.

### Why This Organization?

1. **Main configs stay central**: The base configurations are version-controlled and shared
2. **Worktree configs stay local**: Generated configs live in their worktree, deleted with the worktree
3. **Easy cleanup**: No need to track and clean up PR-specific files separately
4. **Clear separation**: Main branch uses `docker-configs/main/`, worktrees generate their own

## Port Allocation

- **Main/Staging**: Uses default ports (5432, 4444, etc.)
- **Worktrees**: Uses calculated offsets based on issue number
  - Database: 5580 + (issue_number % 100)
  - Neon Proxy: Port follows similar offset pattern

## Usage

### Main Branch
```bash
docker compose -f docker-configs/docker-compose.yml up -d
```

### Worktree (auto-generated)
```bash
# In worktree directory
./scripts/setup-pr-env.sh  # Generates .docker/docker-compose.pr-N.yml
docker compose -f .docker/docker-compose.pr-N.yml up -d
```
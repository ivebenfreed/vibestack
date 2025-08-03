# Claude Configuration Sync for Worktrees

This document explains how Claude and MCP configurations are automatically synced to git worktrees.

## Overview

When working with git worktrees, Claude configurations need to be copied from the main repository to ensure consistent settings across all development environments.

## Automatic Syncing

### During `pnpm install`

The `postinstall` hook automatically syncs Claude configurations when you run `pnpm install` in a worktree:

```bash
cd worktrees/issue-1
pnpm install  # This will automatically sync Claude configs
```

### During Worktree Setup

When fixing worktree dependencies, Claude configs are synced automatically:

```bash
./scripts/fix-worktree-deps.sh ./worktrees/issue-1
```

## Manual Syncing

### Sync to a Specific Worktree

```bash
./scripts/sync-claude-config.sh ./worktrees/issue-1
```

### Sync to All Worktrees

```bash
./scripts/sync-claude-config.sh
```

## What Gets Synced

The following configurations are synced from the main repository to worktrees:

1. `.claude/` directory - Project-specific Claude settings including:
   - `settings.json` - Project-specific Claude settings
   - `settings.local.json` - Local overrides
   - `rules.md` - Custom rules for the project
   - `hooks/` - Pre/post command hooks
   - Other project-specific Claude configurations

Note: MCP server configurations (`~/.config/claude/claude_code_config.json`) are global and don't need to be synced - Claude automatically uses them from your home directory.

## Implementation Details

- **sync-claude-config.sh**: Core script that copies configurations
- **postinstall-worktree.js**: Runs after `pnpm install` to sync configs
- **fix-worktree-deps.sh**: Includes Claude sync as part of worktree setup

## Troubleshooting

If Claude configurations are not syncing properly:

1. Ensure you're in a git worktree (not the main repo)
2. Check that the sync scripts have execute permissions
3. Manually run the sync script with the worktree path

## Environment Variables

- `SYNC_ALL_WORKTREES=true`: When set in the main repo, syncs to all worktrees during postinstall
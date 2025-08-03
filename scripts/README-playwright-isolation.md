# Playwright MCP Isolated Browser Profiles for Worktrees

This document explains how Playwright MCP is configured to use isolated browser profiles for each git worktree.

## Overview

When using Playwright MCP in different worktrees, browser profiles are automatically isolated to prevent:
- Session conflicts between different branches
- Cookie/storage pollution across projects
- Authentication state interference

## How It Works

### 1. Wrapper Script
The `playwright-mcp-wrapper.js` script:
- Detects if Claude is running in a worktree
- Creates a unique browser profile directory for each worktree
- Passes the profile directory to Playwright MCP

### 2. Profile Locations
Browser profiles are stored in:
- **Main repo**: `~/.cache/ms-playwright/mcp-profiles/main/`
- **Worktrees**: `~/.cache/ms-playwright/mcp-profiles/worktree-{name}/`

For example:
- `worktree-issue-1` → `~/.cache/ms-playwright/mcp-profiles/worktree-issue-1/`
- `worktree-issue-123` → `~/.cache/ms-playwright/mcp-profiles/worktree-issue-123/`

### 3. Configuration
The Claude MCP configuration (`~/.config/claude/claude_code_config.json`) uses the wrapper:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": ["/home/benfreed/vibestack/scripts/playwright-mcp-wrapper.js"],
      "env": {}
    }
  }
}
```

## Benefits

1. **Isolated Sessions**: Each worktree has its own browser profile with separate:
   - Cookies and local storage
   - Authentication state
   - Browser history
   - Extensions and settings

2. **Persistent Profiles**: Browser state persists within each worktree across Claude sessions

3. **No Cross-Contamination**: Testing in one branch won't affect another

## Usage

Simply use Playwright MCP as normal in Claude. The wrapper automatically handles profile isolation:

```
# In main repo
mcp__playwright__browser_navigate url="http://localhost:5173"
# Uses ~/.cache/ms-playwright/mcp-profiles/main/

# In worktrees/issue-1
mcp__playwright__browser_navigate url="http://localhost:5183"  
# Uses ~/.cache/ms-playwright/mcp-profiles/worktree-issue-1/
```

## Port Configuration

Remember that each worktree uses different ports:
- Main: 5173 (web), 8787 (API)
- Issue 1: 5183 (web), 8797 (API)
- Issue 2: 5193 (web), 8807 (API)
- etc.

The wrapper doesn't handle port configuration - use the correct URLs for your worktree.

## Troubleshooting

### Clearing a Profile
To reset a worktree's browser profile:
```bash
rm -rf ~/.cache/ms-playwright/mcp-profiles/worktree-{name}/
```

### Viewing Profile Location
The wrapper logs the profile location to stderr when starting:
```
[Playwright MCP] Using profile: worktree-issue-1 at /home/user/.cache/ms-playwright/mcp-profiles/worktree-issue-1
```

### Reverting to Default Configuration
To restore the original Playwright MCP configuration:
```bash
cp ~/.config/claude/claude_code_config.json.backup ~/.config/claude/claude_code_config.json
```

## Implementation Details

- **Detection**: Uses `git worktree list` to determine if in a worktree
- **Profile Naming**: Based on worktree directory name
- **Fallback**: Uses 'main' profile if not in a git repository
- **Compatibility**: Works with all Playwright MCP features
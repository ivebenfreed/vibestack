# Worktree Isolation System Modernization

## Overview

This plan modernizes VibeStack's worktree isolation system from the current brittle port-based arithmetic approach to a robust Docker container-based solution. The new system enables concurrent multi-worktree development with complete environment isolation.

## Current State Analysis

### Problems with Port-Based System

The existing system uses arithmetic to calculate unique ports per worktree:
- **Port conflicts**: Formula `5173 + ISSUE_NUMBER` creates overlaps and conflicts
- **Complex management**: 15+ scripts contain hardcoded port calculations
- **Environment fragmentation**: Each worktree requires manual `.env.local` configuration
- **Testing brittleness**: Playwright tests hardcode `localhost:5173` URLs
- **Resource tracking**: tmux sessions need unique names and port coordination

### Brittleness Examples

```bash
# Current system issues:
scripts/configure-worktree-env.sh:52-55  # Port arithmetic
apps/server/src/api/index.ts             # Modified files
tests/playwright/*/*.spec.js             # Hardcoded localhost:5173
```

## Proposed Solution: Container-Based Isolation

### Architecture

Replace port arithmetic with Docker container isolation where each worktree gets:
- **One container** running all services (web, api, database)
- **Standard internal ports** (5173, 8787, 5432) in every container
- **Sequential external mapping** (6000, 6001, 6002...) managed by Docker
- **Complete environment isolation** with independent databases and volumes

### Benefits

✅ **No port conflicts** - Docker handles networking isolation automatically  
✅ **Consistent configuration** - Same internal ports across all worktrees  
✅ **Resource efficiency** - 1 container per worktree vs multiple processes  
✅ **Simple URLs** - `localhost:6000`, `localhost:6001`, `localhost:6002`  
✅ **Easy testing** - Dynamic port detection in test suites  
✅ **Concurrent development** - Work on multiple issues simultaneously  

## Implementation Plan

See detailed implementation files:
- [Implementation Phases](./implementation-phases.md)
- [Container Architecture](./container-architecture.md) 
- [Testing Integration](./testing-integration.md)
- [Migration Strategy](./migration-strategy.md)

## Timeline

**Total Duration**: 3 weeks  
**Risk Level**: Low (parallel deployment allows rollback)  
**Resource Impact**: Reduced (fewer containers than current processes)
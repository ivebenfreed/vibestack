# XState Universal State Management

This directory contains the XState-based universal state management system for the application. It replaces fragmented state management with a single, coordinated state machine that manages all application concerns.

## Quick Start

```typescript
import { useAppState } from './hooks/useAppState';

function MyComponent() {
  const { 
    isAppReady,
    isAuthenticated, 
    isDatabaseReady,
    isSyncLive,
    isLiveChangesActive,
    send 
  } = useAppState();
  
  if (!isAppReady) {
    return <Loading />;
  }
  
  return <div>App is ready!</div>;
}
```

## Architecture Overview

The system uses a parallel state machine to coordinate multiple concerns:

```
AppStateMachine (parallel)
├── connection     # Network connectivity
├── auth          # Authentication state  
├── database      # PGlite + TypeORM state
├── sync          # Sync process orchestration
├── liveChanges   # Live changes activation
└── appReadiness  # Overall app state
```

## Key Benefits

- **Single Source of Truth**: All state in one coordinated machine
- **Race Condition Prevention**: LiveChanges only activate when sync is live
- **Visual Debugging**: Complete state flow visible in Stately Studio
- **Type Safety**: Full TypeScript support for all state operations
- **Predictable Behavior**: State machine prevents impossible states

## Migration Status

See [XSTATE_MIGRATION_PLAN.md](./XSTATE_MIGRATION_PLAN.md) for complete migration plan and progress.

- [ ] Phase 1: Foundation (XState setup, basic machines)
- [ ] Phase 2: Database & Sync Coordination 
- [ ] Phase 3: Migration & Integration
- [ ] Phase 4: Testing & Optimization

## Files Organization

- `app-machine.ts`: Main parallel state machine (all states in one file)
- `guards.ts`: All guard functions
- `actions.ts`: All side effect actions
- `types.ts`: Context and event type definitions
- `hooks.ts`: All React integration hooks
- `selectors.ts`: State selectors and helpers
- `actors.ts`: Actor bridges for existing systems
- `testing.ts`: Testing utilities and fixtures

## Development

1. Install dependencies: `npm install xstate @xstate/react`
2. Start Stately Studio for visual development
3. Follow the migration plan phases
4. Use provided testing utilities for state machine testing

## Resources

- [XState Documentation](https://stately.ai/docs/xstate)
- [Stately Studio](https://stately.ai/studio) - Visual state machine editor
- [Migration Plan](./XSTATE_MIGRATION_PLAN.md) - Detailed implementation plan 
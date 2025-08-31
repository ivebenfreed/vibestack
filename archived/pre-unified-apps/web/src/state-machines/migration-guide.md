# Migration Guide: From Monolithic App Machine to Orchestrator

This guide shows how to migrate from the large `app-machine.ts` to the new modular orchestrator pattern.

## 🏗️ **Architecture Changes**

### **Before: Monolithic Pattern**
```
app-machine.ts (1500+ lines)
├── Auth logic
├── Database logic  
├── Sync logic
├── Live changes logic
├── Connection logic
└── Route loading logic
```

### **After: Orchestrator Pattern**
```
orchestrator.ts (coordinator)
├── machines/
│   ├── connection-machine.ts
│   ├── sync-machine.ts
│   └── live-changes-machine.ts
├── orchestrator-hooks.tsx
└── migration-guide.md
```

## 📝 **Step-by-Step Migration**

### **1. Update Your App Root**

**Before (app-machine.ts):**
```tsx
import { createActor } from 'xstate';
import { appMachine } from './state-machines/app-machine';

const appActor = createActor(appMachine);
```

**After (orchestrator.ts):**
```tsx
import { createActor } from 'xstate';
import { orchestrator } from './state-machines/orchestrator';
import { OrchestratorProvider } from './state-machines/orchestrator-hooks';

const orchestratorActor = createActor(orchestrator);

function App() {
  return (
    <OrchestratorProvider actor={orchestratorActor}>
      {/* Your app content */}
    </OrchestratorProvider>
  );
}
```

### **2. Update Component Hook Usage**

**Before:**
```tsx
import { useAppMachine } from './state-machines/hooks';

function MyComponent() {
  const { user, isAuthenticated, signIn, signOut } = useAppMachine();
  // ...
}
```

**After:**
```tsx
import { useAuth, useSystemReadiness } from './state-machines/orchestrator-hooks';

function MyComponent() {
  const { user, isAuthenticated, signIn, signOut } = useAuth();
  const { isSystemReady } = useSystemReadiness();
  // ...
}
```

### **3. Hook Migration Map**

| Old Hook Usage | New Hook Usage |
|---|---|
| `useAppMachine()` | `useOrchestrator()` (main) |
| `useAppMachine().user` | `useAuth().user` |
| `useAppMachine().isOnline` | `useConnection().isOnline` |
| `useAppMachine().isDatabaseReady` | `useDatabase().isReady` |
| `useAppMachine().canLoadRoutes` | `useSystemReadiness().canLoadRoutes` |

## 🔄 **Benefits of This Migration**

### **1. Better Testability**
```tsx
// Before: Hard to test individual concerns
test('auth flow', () => {
  // Had to mock entire app machine
});

// After: Easy to test individual machines
test('auth flow', () => {
  const authMachine = createActor(authMachine);
  // Test only auth logic
});
```

### **2. Clearer Separation of Concerns**
- **Connection Machine**: Only handles network connectivity
- **Sync Machine**: Only handles data synchronization  
- **Live Changes Machine**: Only handles real-time updates
- **Orchestrator**: Only coordinates between machines

### **3. Better Performance**
- Components only re-render when their specific concern changes
- More granular subscriptions with individual hooks

### **4. Easier Debugging**
- Individual machine logs in dev tools
- Clear state boundaries between concerns
- Better error isolation

## 🛠️ **Advanced Usage Examples**

### **Granular State Subscriptions**
```tsx
function NetworkStatus() {
  // Only re-renders on connection changes
  const { isOnline, status } = useConnection();
  
  return (
    <div className={isOnline ? 'text-green-600' : 'text-red-600'}>
      Connection: {status}
    </div>
  );
}

function AuthStatus() {
  // Only re-renders on auth changes
  const { user, displayName, initials } = useAuth();
  
  return user ? (
    <div className="flex items-center">
      <div className="avatar">{initials}</div>
      <span>{displayName}</span>
    </div>
  ) : null;
}
```

### **System Readiness Checks**
```tsx
function App() {
  const { isSystemReady, isLoading, readinessChecks } = useSystemReadiness();
  
  if (isLoading) {
    return (
      <LoadingScreen 
        checks={readinessChecks}
        message="Initializing system..."
      />
    );
  }
  
  if (!isSystemReady) {
    return <ErrorScreen message="System not ready" />;
  }
  
  return <Router />;
}
```

### **Direct Machine Communication**
```tsx
function SyncStatus() {
  const orchestrator = useOrchestratorActor();
  
  // Send events directly to orchestrator
  const handleForceSync = () => {
    orchestrator.send({ type: 'START_SYSTEM' });
  };
  
  return <button onClick={handleForceSync}>Force Sync</button>;
}
```

## 📊 **Migration Checklist**

- [ ] Replace `app-machine.ts` imports with `orchestrator.ts`
- [ ] Update root app component to use `OrchestratorProvider`  
- [ ] Replace `useAppMachine()` with specific hooks:
  - [ ] `useAuth()` for authentication
  - [ ] `useConnection()` for network status
  - [ ] `useDatabase()` for database status
  - [ ] `useSystemReadiness()` for loading states
- [ ] Update component prop drilling to use context
- [ ] Test that all machine transitions work correctly
- [ ] Verify no performance regressions

## 🎯 **Next Steps for Full Modularization**

After this migration, consider moving these to state machines too:

1. **Router Machine**: Handle route transitions and guards
2. **Notification Machine**: Manage toasts and alerts  
3. **Feature Machines**: Individual features like tasks, projects, etc.
4. **Cache Machine**: Handle data cache invalidation
5. **Form Machines**: Complex form state management

This creates a fully modular, testable, and maintainable architecture! 
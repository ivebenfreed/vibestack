# VibeGantt Store Architecture

This document describes the store-based data loading architecture for VibeGantt, which mirrors the approach used in VibeGridDex.

## Overview

The store architecture provides:
- Pre-loaded and fully resolved data
- Live subscriptions for real-time updates
- Efficient change detection
- Persistent view state
- Memory-aware pagination

## Key Components

### 1. Atomic Store (`gantt-data-store-atomic.ts`)

The core store using XState's `fromStore` pattern with event-based mutations:

```typescript
const store = fromStore({
  context: {
    tasks: {},              // Fully resolved task entities
    dependencies: {},       // Task dependencies
    relationships: {        // Lookup tables
      users: {},
      projects: {},
      statusDefinitions: {},
      tags: {}
    },
    taskTree: [],          // Hierarchical structure
    criticalPath: Set(),   // Critical path tasks
    // ... view state
  },
  on: {
    setInitialData: { /* ... */ },
    updateTask: { /* ... */ },
    updateRelationshipTable: { /* ... */ },
    // ... other events
  }
})
```

### 2. Data Loading (`loadInitialGanttData`)

Loads all data including relationships and junction tables:

```typescript
async function loadInitialGanttData(projectId?: string) {
  // Load tasks with optional project filter
  const tasks = await loadTasks(projectId);
  
  // Extract relationship IDs
  const userIds = extractUserIds(tasks);
  const projectIds = extractProjectIds(tasks);
  
  // Load junction data (many-to-many)
  const taskTags = await loadTaskTags(taskIds);
  
  // Load all relationships in parallel
  const [users, projects, statuses, tags] = await Promise.all([...]);
  
  // Resolve all relationships
  const resolvedTasks = resolveAllTasks(tasks, relationships);
  
  return { tasks: resolvedTasks, relationships };
}
```

### 3. Live Subscriptions (`setupGranularGanttSubscriptions`)

Sets up Dexie liveQuery subscriptions for real-time updates:

```typescript
function setupGranularGanttSubscriptions(storeActor, projectId) {
  // Subscribe to task changes
  const taskSub = liveQuery(() => loadTasksWithJunctions()).subscribe({
    next: (tasks) => detectAndSendChanges(tasks)
  });
  
  // Subscribe to relationship tables
  relationshipTables.forEach(table => {
    const sub = liveQuery(() => db[table].toArray()).subscribe({
      next: (data) => storeActor.send({ 
        type: 'updateRelationshipTable', 
        table, 
        data 
      })
    });
  });
}
```

### 4. React Hook (`useGanttData`)

Provides a clean interface for components:

```typescript
export function useGanttData(projectId?: string) {
  const storeActor = useRef(createActor(createGanttStoreLogic(projectId)));
  
  // Load initial data
  useEffect(() => {
    loadInitialGanttData(projectId).then(data => {
      storeActor.current.send({ type: 'setInitialData', ...data });
      setupGranularGanttSubscriptions(storeActor.current, projectId);
    });
  }, [projectId]);
  
  // Provide state and actions
  return {
    // State
    tasks, taskTree, dependencies, loading, error,
    
    // Actions
    toggleTaskExpanded, setSelectedTasks, setZoom,
    
    // Helpers
    getVisibleTasks, getTaskById, isTaskCritical
  };
}
```

## Data Flow

1. **Initial Load**:
   - Component mounts → `useGanttData` hook
   - Load all data from IndexedDB
   - Resolve relationships (users, projects, etc.)
   - Send to store via `setInitialData`
   - Set up live subscriptions

2. **Updates**:
   - Database change → Dexie liveQuery
   - Detect actual changes (deep comparison)
   - Send granular updates to store
   - Store updates state atomically
   - React re-renders with new data

3. **Relationship Updates**:
   - Relationship table changes
   - Store receives update event
   - Re-resolves affected entities
   - Updates task tree if needed

## Key Features

### Relationship Resolution

Tasks are enriched with resolved relationship data:

```typescript
{
  id: "task-1",
  title: "Build Feature",
  assigneeId: "user-1",
  assigneeName: "John Doe",        // Resolved
  assigneeEmail: "john@example.com", // Resolved
  assigneeAvatar: "...",           // Resolved
  projectId: "proj-1", 
  projectName: "Main Project",     // Resolved
  projectColor: "#3B82F6",         // Resolved
  tags: ["tag-1", "tag-2"],
  resolvedTags: [                  // Resolved
    { id: "tag-1", name: "Frontend", color: "#10B981" },
    { id: "tag-2", name: "Priority", color: "#EF4444" }
  ]
}
```

### Hierarchical Task Tree

Tasks are organized into a tree structure:

```typescript
[
  {
    id: "task-1",
    title: "Epic",
    children: [
      {
        id: "task-2",
        title: "Story",
        children: [
          { id: "task-3", title: "Subtask" }
        ]
      }
    ]
  }
]
```

### Critical Path Calculation

Uses CPM algorithm to identify critical tasks:

```typescript
function calculateCriticalPath(tasks, dependencies) {
  // Forward pass: calculate early start/finish
  // Backward pass: calculate late start/finish
  // Critical tasks have zero slack
  return criticalTaskIds;
}
```

### View State Persistence

View preferences are saved to localStorage:

```typescript
{
  expandedTasks: ["task-1", "task-2"],
  visibleDateRange: { start: "...", end: "..." },
  zoom: "day",
  showWeekends: true,
  showDependencies: true
}
```

## Performance Considerations

1. **Memory Limits**:
   - Max 5000 tasks in memory
   - Pagination for larger datasets
   - Efficient change detection

2. **Subscription Management**:
   - Debounced relationship updates
   - Granular change detection
   - Cleanup on unmount

3. **Rendering Optimization**:
   - Only visible tasks sent to renderer
   - Pre-computed layouts
   - Minimal re-renders

## Integration with VibeGantt

The store integrates seamlessly with the existing gantt machine:

1. Store provides pre-resolved data
2. Component converts to gantt format
3. Machine handles interactions
4. Changes go back to database
5. Store picks up changes automatically

This creates a clean separation of concerns:
- **Store**: Data loading and state management
- **Machine**: Interaction and rendering logic
- **Component**: UI coordination
# Universal Reactive Data Pattern (XState Edition)

## Core Concept

The Universal Reactive Data Pattern (XState Edition) is a three-layer data architecture that eliminates loading states, provides instant navigation, and maintains real-time updates with **surgical precision**. It combines TanStack Router loaders, XState stores with normalized data, and live queries to create seamless user experiences with minimal re-renders.

## Key Principles

### 1. Surgical Updates
- Individual entities update independently through XState selectors
- Only components reading specific entities re-render
- Collections derive from normalized stores automatically
- No bulk re-rendering when single items change

### 2. Instant Loading
- Data is pre-fetched during navigation into XState stores
- Users see content immediately when pages load
- No loading spinners for initial data display

### 3. Real-time Updates
- Live queries update individual entities directly via XState actions
- Changes propagate instantly with surgical precision
- No manual refresh or cache invalidation needed

### 4. Co-located XState Stores
- XState stores are co-located with domain services
- Direct integration with business logic
- Type-safe normalized data operations

### 5. Derived Reactivity
- Collections automatically derive from normalized stores
- Smart memoization prevents unnecessary recalculations
- Reactive dependency tracking via XState selectors

## Three-Layer XState Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Router Loaders │───▶│ XState Stores    │───▶│   Live Queries  │
│  (Bulk Loading) │    │ (Normalized)     │    │ (Surgical Updt) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
   Load all entities     Store each entity in      Update specific entities
   into normalized       normalized structure      when database changes
   XState stores         with surgical precision   with surgical precision
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │    XState Selectors     │
                    │  (Auto-Calculated)      │
                    │  getAllProjects() ────▶ │
                    │  getAllTasks()          │
                    └─────────────────────────┘
```

## Layer 1: XState Normalized Storage

### XState Store with Normalized Data
Each domain gets an XState store with normalized entity storage:

```typescript
import { createStore } from '@xstate/store'

// Normalized store structure
interface TaskStore {
  entities: Record<string, Task>
  entityIds: string[]
}

// Create XState store with normalized data
export const taskStore = createStore(
  {
    entities: {} as Record<string, Task>,
    entityIds: [] as string[],
  },
  {
    // Bulk loading action for router loaders
    loadTasks: (context, event: { tasks: Task[] }) => {
      const entities: Record<string, Task> = {}
      const entityIds: string[] = []
      
      event.tasks.forEach(task => {
        entities[task.id] = task
        entityIds.push(task.id)
      })
      
      return { entities, entityIds }
    },
    
    // Surgical update: only specific entity changes
    updateTask: (context, event: { task: Task }) => ({
      entities: {
        ...context.entities,
        [event.task.id]: event.task
      },
      entityIds: context.entityIds.includes(event.task.id) 
        ? context.entityIds 
        : [...context.entityIds, event.task.id]
    }),
    
    // Surgical create: add single entity
    createTask: (context, event: { task: Task }) => ({
      entities: {
        ...context.entities,
        [event.task.id]: event.task
      },
      entityIds: [...context.entityIds, event.task.id]
    }),
    
    // Surgical delete: remove single entity
    deleteTask: (context, event: { taskId: string }) => {
      const { [event.taskId]: deleted, ...entities } = context.entities
      return {
        entities,
        entityIds: context.entityIds.filter(id => id !== event.taskId)
      }
    }
  }
)

// Surgical selectors - only re-render when specific data changes
export const taskSelectors = {
  // Get specific task - surgical precision
  getTask: (id: string) => (state: TaskStore) => state.entities[id] || null,
  
  // Get all tasks - efficient collection
  getAllTasks: (state: TaskStore) => 
    state.entityIds.map(id => state.entities[id]).filter(Boolean),
  
  // Get filtered tasks - efficient filtering
  getTasksByProject: (projectId: string) => (state: TaskStore) =>
    state.entityIds
      .map(id => state.entities[id])
      .filter(task => task && task.projectId === projectId)
}
```

### Co-located Domain Integration
XState stores are co-located with domain services:

```typescript
export class TaskService extends BaseService<Task> {
  // Co-located XState store
  static store = taskStore;
  static selectors = taskSelectors;
  
  async updateTask(id: string, changes: Partial<Task>): Promise<Task> {
    const updatedTask = await this.repository.update(id, changes)
    
    // Surgical update: only this task changes
    TaskService.store.send({
      type: 'updateTask',
      task: updatedTask
    })
    
    return updatedTask
  }
}

// Export store and selectors
export { taskStore, taskSelectors }
```

## Layer 2: Router Loaders (Bulk Population)

Router loaders efficiently populate XState stores:

```typescript
export const Route = createFileRoute('/_authenticated/tasks/')({
  loader: async () => {
    const currentTasks = taskStore.getSnapshot().context.entityIds
    
    if (currentTasks.length > 0) {
      return null // Store already populated
    }
    
    const dataSource = await getNewPGliteDataSource()
    const tasks = await dataSource.getRepository(Task).find()
    
    // Bulk load into XState store
    taskStore.send({
      type: 'loadTasks',
      tasks
    })
    
    return null
  },
  component: Tasks,
})
```

## Layer 3: Live Queries (Surgical Updates)

Live queries update individual entities via XState actions:

```typescript
class LiveChangesManager {
  async startTaskLiveChanges(createQueryBuilder: Function) {
    const queryBuilder = createQueryBuilder(Task, 'task')
      .orderBy('task.createdAt', 'DESC')
    
    const [sql, params] = queryBuilder.getQueryAndParameters()
    const { getDatabase } = await import('../db/db')
    const db = await getDatabase()
    
    const result = await db.live.changes(
      sql,
      params,
      'task_id',
      (changes: TaskChange[]) => {
        this.processTaskChanges(changes) // Surgical updates
      }
    )
  }
  
  private processTaskChanges(changes: TaskChange[]) {
    changes.forEach(change => {
      const task = this.transformDatabaseResult(change)
      
      switch (change.__op__) {
        case 'INSERT':
          taskStore.send({ type: 'createTask', task })
          break
        case 'UPDATE':
          taskStore.send({ type: 'updateTask', task })
          break
        case 'DELETE':
          taskStore.send({ type: 'deleteTask', taskId: task.id })
          break
      }
    })
  }
}
```

## Component Patterns

### Individual Entity Components (Surgical Re-renders)
Components that read individual entities only re-render when that specific entity changes:

```typescript
import { useSelector } from '@xstate/store/react'

// TaskCard.tsx - Only re-renders when THIS task changes
export const TaskCard = React.memo(({ taskId }: { taskId: string }) => {
  // Surgical: Only re-renders when this specific task changes
  const task = useSelector(taskStore, taskSelectors.getTask(taskId))
  
  if (!task) return null
  
  return (
    <Card>
      <h3>{task.title}</h3>
      <p>{task.description}</p>
    </Card>
  )
})

// TaskList.tsx - Renders individual cards
export const TaskList = () => {
  // Gets all tasks efficiently
  const tasks = useSelector(taskStore, taskSelectors.getAllTasks)
  
  return (
    <div>
      {tasks.map(task => (
        <TaskCard key={task.id} taskId={task.id} />
      ))}
    </div>
  )
}
```

### Collection Components (Derived Reactivity)
Components that need collections read from XState selectors:

```typescript
// Dashboard.tsx - Reads derived collections
export default function Dashboard() {
  // Selectors automatically recalculate when stores change
  const allTasks = useSelector(taskStore, taskSelectors.getAllTasks)
  const allProjects = useSelector(projectStore, projectSelectors.getAllProjects)
  
  const dashboardData = useMemo(() => ({
    taskCount: allTasks.length,
    projectCount: allProjects.length,
    recentTasks: allTasks.slice(0, 5)
  }), [allTasks, allProjects])
  
  return <DashboardDisplay data={dashboardData} />
}
```

### Filtered Collections (Efficient Filtering)
Collections can be filtered efficiently without bulk re-renders:

```typescript
// Project Tasks Hook - Filters from XState store
function useTasksByProject(projectId: string) {
  const projectTasks = useSelector(
    taskStore, 
    taskSelectors.getTasksByProject(projectId)
  )
  
  return {
    data: projectTasks,
    isLoading: false, // XState stores are always synchronous
    error: null
  }
}
```

## Performance Benefits

### Surgical Updates
**Before (Bulk Re-render)**:
```typescript
// When one task changes, entire list re-renders
const TaskList = () => {
  const { data: tasks } = useQuery(['tasks'], fetchTasks)
  return tasks.map(task => <TaskCard task={task} />) // All cards re-render
}
```

**After (Surgical Updates)**:
```typescript
// When one task changes, only that card re-renders
const TaskList = () => {
  const tasks = useSelector(taskStore, taskSelectors.getAllTasks)
  return tasks.map(task => <TaskCard taskId={task.id} />) // Only changed card re-renders
}

const TaskCard = ({ taskId }) => {
  const task = useSelector(taskStore, taskSelectors.getTask(taskId)) // Individual selector
  return <Card>{task.title}</Card>
}
```

### Memory Efficiency
- Normalized stores prevent duplicate entity storage
- XState selectors use built-in memoization with `shallowEqual`
- No cache invalidation needed

### Network Efficiency
- Router loaders pre-fetch all data in parallel
- Live queries only send changed entities
- No redundant API calls

## Common Patterns

### CRUD Operations with Surgical Updates

```typescript
// Create - Adds new entity to normalized store
export const useCreateTask = () => {
  const { services } = usePGliteContext()
  
  return useMutation({
    mutationFn: async (taskData: CreateTaskData) => {
      const newTask = await services.tasks.createTask(taskData)
      
      // Surgical: Only new entity is added
      taskStore.send({
        type: 'createTask',
        task: newTask
      })
      
      return newTask
    }
  })
}

// Update - Updates specific entity in store
export const useUpdateTask = () => {
  const { services } = usePGliteContext()
  
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string, changes: Partial<Task> }) => {
      const updatedTask = await services.tasks.updateTask(id, changes)
      
      // Surgical: Only this task updates
      taskStore.send({
        type: 'updateTask',
        task: updatedTask
      })
      
      return updatedTask
    }
  })
}

// Delete - Removes specific entity from store
export const useDeleteTask = () => {
  const { services } = usePGliteContext()
  
  return useMutation({
    mutationFn: async (id: string) => {
      await services.tasks.deleteTask(id)
      
      // Surgical: Only this task is removed
      taskStore.send({
        type: 'deleteTask',
        taskId: id
      })
      
      return id
    }
  })
}
```

### Relationship Handling

```typescript
// Project with Tasks - Efficient relationship loading
export const ProjectDetail = ({ projectId }: { projectId: string }) => {
  // Individual project selector
  const project = useSelector(projectStore, projectSelectors.getProject(projectId))
  
  // Filtered tasks (derived efficiently)
  const projectTasks = useTasksByProject(projectId)
  
  return (
    <div>
      <h1>{project?.name}</h1>
      <TaskList tasks={projectTasks.data} />
    </div>
  )
}
```

### Real-time Collaboration

```typescript
// Multiple users editing - surgical updates propagate instantly
export const CollaborativeTaskBoard = () => {
  const tasks = useSelector(taskStore, taskSelectors.getAllTasks)
  
  // When user A updates task X:
  // 1. Live query receives change for task X only
  // 2. Only task X updates in normalized store
  // 3. Only TaskCard for task X re-renders (via selector)
  // 4. User B sees instant update for task X only
  // 5. Other task cards remain unchanged
  
  return (
    <div className="grid grid-cols-3 gap-4">
      {tasks.map(task => (
        <TaskCard key={task.id} taskId={task.id} />
      ))}
    </div>
  )
}
```

## Migration from React Query

### Old Pattern (Bulk Updates)
```typescript
// ❌ Old: Bulk cache updates
const useUpdateTask = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateTaskApi,
    onSuccess: (updatedTask) => {
      // Bulk: Invalidates entire tasks cache
      queryClient.invalidateQueries(['tasks'])
      // All components re-render
    }
  })
}
```

### New Pattern (Surgical Updates)
```typescript
// ✅ New: Surgical XState updates
const useUpdateTask = () => {
  return useMutation({
    mutationFn: async ({ id, changes }) => {
      const updatedTask = await services.tasks.updateTask(id, changes)
      
      // Surgical: Only this task updates
      taskStore.send({
        type: 'updateTask',
        task: updatedTask
      })
      
      return updatedTask
    }
  })
}
```

## Best Practices

### ✅ Individual Selectors for Entities
```typescript
// Each entity gets its own selector
const task = useSelector(taskStore, taskSelectors.getTask(taskId))
const project = useSelector(projectStore, projectSelectors.getProject(projectId))
```

### ✅ Normalized Store Structure
```typescript
// Stores use normalized structure for efficiency
interface TaskStore {
  entities: Record<string, Task>
  entityIds: string[]
}
```

### ✅ Co-located XState Stores
```typescript
// XState stores live with domain services
export class TaskService extends BaseService<Task> {
  static store = taskStore
  static selectors = taskSelectors
}
```

### ✅ Surgical Component Updates
```typescript
// Components read individual selectors
const TaskCard = ({ taskId }) => {
  const task = useSelector(taskStore, taskSelectors.getTask(taskId))
  // Only re-renders when this specific task changes
}
```

### ✅ Bulk Loading in Loaders
```typescript
// Router loaders populate stores efficiently
taskStore.send({ type: 'loadTasks', tasks })
```

## Anti-Patterns

### ❌ Bulk State Updates
```typescript
// Don't do this - causes bulk re-renders
const [tasks, setTasks] = useState([])
const updateTask = (updatedTask) => {
  setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t))
  // All TaskCard components re-render
}
```

### ❌ Cache Invalidation
```typescript
// Don't do this - forces refetch of all data
queryClient.invalidateQueries(['tasks'])
```

### ❌ Manual State Management
```typescript
// Don't do this - manual tracking is error-prone
const [tasks, setTasks] = useState([])
const [loading, setLoading] = useState(true)
```

### ❌ Prop Drilling Entity Data
```typescript
// Don't do this - pass IDs instead
<TaskCard task={task} /> // ❌ Bulk updates

// Do this - surgical updates
<TaskCard taskId={task.id} /> // ✅ Surgical updates
```

## Performance Monitoring

### Measuring Surgical Updates
Use React DevTools Profiler to verify only specific components re-render:

```typescript
// Expected: Only changed entity components re-render
// When updating Task A:
// ✅ TaskCard[A] re-renders
// ✅ Other TaskCard components do NOT re-render
// ✅ Parent TaskList does NOT re-render (unless tasks added/removed)
```

### XState Store Debugging
```typescript
// Debug store state
const snapshot = taskStore.getSnapshot()
console.log('Store state:', snapshot.context)

// Debug specific entity
const task = taskSelectors.getTask('task-id')(snapshot.context)
console.log('Task entity:', task)

// Debug collections
const allTasks = taskSelectors.getAllTasks(snapshot.context)
console.log('All tasks count:', allTasks.length)
```

## Conclusion

The Universal Reactive Data Pattern (XState Edition) provides:

1. **Surgical Updates**: Only changed entities trigger re-renders via selectors
2. **Instant Loading**: Router loaders pre-populate XState stores
3. **Real-time Sync**: Live queries update individual entities through actions
4. **Type Safety**: Full TypeScript integration with domain services
5. **Performance**: Minimal re-renders and efficient normalized storage
6. **Scalability**: Handles large datasets with surgical selector precision

This pattern eliminates the performance bottlenecks of bulk cache invalidation while maintaining the simplicity and real-time capabilities of the original Universal Reactive Data Pattern, now powered by XState's robust state management and surgical selector system. 
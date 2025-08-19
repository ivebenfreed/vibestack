# Component Update Guide: Dexie → Pure LiveStore

## 🎯 **SYSTEMATIC COMPONENT REPLACEMENT**

This guide shows exactly how to replace every Dexie usage with pure LiveStore equivalents.

---

## 📋 **STEP 1: UPDATE IMPORT STATEMENTS**

### **Find and Replace All Imports**

```typescript
// OLD: Remove these imports entirely
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie-init'
import { db } from '../db/dexie-schema'

// NEW: Replace with LiveStore imports
import { 
  useLiveStoreQuery, 
  useLiveStoreMutations,
  useProjects,
  useTasks,
  useUsers 
} from '../lib/livestore-hooks'
```

---

## 📋 **STEP 2: REPLACE QUERY HOOKS**

### **Basic Entity Queries**

```typescript
// OLD: Dexie query patterns
const projects = useLiveQuery(() => 
  db.projects.where('organization_id').equals(orgId).toArray()
, [orgId])

const tasks = useLiveQuery(() => 
  db.tasks.where('project_id').equals(projectId).toArray()
, [projectId])

// NEW: LiveStore hook patterns  
const { data: projects, loading } = useProjects(orgId)

const { data: tasks, loading } = useTasks(orgId, projectId)
```

### **Single Record Queries**

```typescript
// OLD: Get single record
const project = useLiveQuery(() => 
  db.projects.get(projectId)
, [projectId])

// NEW: LiveStore single record
const { data: project, loading } = useProject(orgId, projectId)
```

### **Custom Queries**

```typescript
// OLD: Complex Dexie queries
const completedTasks = useLiveQuery(() => 
  db.tasks
    .where('organization_id').equals(orgId)
    .and(task => task.completed === true)
    .toArray()
, [orgId])

// NEW: Custom LiveStore SQL queries
const { data: completedTasks, loading } = useLiveStoreQuery(
  orgId,
  'tasks',
  'SELECT * FROM org_? _tasks WHERE organization_id = ? AND completed = ? ORDER BY updated_at DESC',
  [orgId, orgId, true]
)
```

---

## 📋 **STEP 3: REPLACE MUTATION OPERATIONS**

### **Create Operations**

```typescript
// OLD: Dexie create
const addProject = async (projectData) => {
  const id = await db.projects.add({
    ...projectData,
    organization_id: orgId,
    created_at: new Date().toISOString()
  })
  return id
}

// NEW: LiveStore mutations
const { mutations } = useLiveStoreMutations(orgId)

const addProject = async (projectData) => {
  if (!mutations) throw new Error('Mutations not ready')
  
  return await mutations.projects.create({
    ...projectData,
    organization_id: orgId
    // created_at/updated_at handled automatically by LiveStore
  })
}
```

### **Update Operations**

```typescript
// OLD: Dexie update
const updateProject = async (projectId, changes) => {
  await db.projects.update(projectId, {
    ...changes,
    updated_at: new Date().toISOString()
  })
}

// NEW: LiveStore mutations
const updateProject = async (projectId, changes) => {
  if (!mutations) throw new Error('Mutations not ready')
  
  return await mutations.projects.update(projectId, changes)
  // updated_at handled automatically by LiveStore
}
```

### **Delete Operations**

```typescript
// OLD: Dexie delete
const deleteProject = async (projectId) => {
  await db.projects.delete(projectId)
}

// NEW: LiveStore mutations
const deleteProject = async (projectId) => {
  if (!mutations) throw new Error('Mutations not ready')
  
  return await mutations.projects.delete(projectId)
}
```

---

## 📋 **STEP 4: BULK OPERATIONS**

### **Bulk Creates**

```typescript
// OLD: Dexie transaction
const createMultipleProjects = async (projectsData) => {
  await db.transaction('rw', db.projects, async () => {
    for (const projectData of projectsData) {
      await db.projects.add({
        ...projectData,
        organization_id: orgId
      })
    }
  })
}

// NEW: LiveStore bulk operations
const { bulkCreate } = useBulkOperations(orgId)

const createMultipleProjects = async (projectsData) => {
  const dataWithOrg = projectsData.map(data => ({
    ...data,
    organization_id: orgId
  }))
  
  return await bulkCreate('projects', dataWithOrg)
}
```

---

## 📋 **STEP 5: SEARCH AND FILTERING**

### **Search Operations**

```typescript
// OLD: Dexie search
const searchProjects = useLiveQuery(() => {
  if (!searchTerm) return []
  
  return db.projects
    .where('organization_id').equals(orgId)
    .and(project => 
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .toArray()
}, [orgId, searchTerm])

// NEW: LiveStore search hook
const { results: searchResults, loading } = useSearch(
  orgId, 
  searchTerm, 
  ['projects'] // Entity types to search
)
```

### **Count Operations**

```typescript
// OLD: Dexie count
const projectCount = useLiveQuery(() => 
  db.projects.where('organization_id').equals(orgId).count()
, [orgId])

// NEW: LiveStore count hook
const { count: projectCount, loading } = useEntityCount(
  orgId, 
  'projects'
)
```

---

## 📋 **STEP 6: COMPLETE COMPONENT EXAMPLES**

### **Example 1: Project List Component**

```typescript
// OLD: Dexie-based component
function ProjectListOld() {
  const projects = useLiveQuery(() => 
    db.projects.where('organization_id').equals(orgId).toArray()
  , [orgId])

  const addProject = async (data) => {
    await db.projects.add({
      ...data,
      organization_id: orgId,
      created_at: new Date().toISOString()
    })
  }

  if (!projects) return <div>Loading...</div>

  return (
    <div>
      {projects.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}

// NEW: LiveStore-based component
function ProjectList() {
  const { data: projects, loading, error } = useProjects(orgId)
  const { mutations } = useLiveStoreMutations(orgId)

  const addProject = async (data) => {
    if (!mutations) throw new Error('Mutations not ready')
    await mutations.projects.create({
      ...data,
      organization_id: orgId
    })
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      {projects.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
```

### **Example 2: Task Management Component**

```typescript
// OLD: Complex Dexie component  
function TaskManagerOld() {
  const tasks = useLiveQuery(() => 
    db.tasks
      .where('organization_id').equals(orgId)
      .and(task => task.project_id === projectId)
      .sortBy('created_at')
  , [orgId, projectId])

  const completedCount = useLiveQuery(() => 
    db.tasks
      .where('organization_id').equals(orgId)
      .and(task => task.completed === true)
      .count()
  , [orgId])

  const toggleTask = async (taskId, completed) => {
    await db.tasks.update(taskId, { 
      completed,
      updated_at: new Date().toISOString()
    })
  }

  // Component logic...
}

// NEW: LiveStore component
function TaskManager() {
  const { data: tasks, loading } = useTasks(orgId, projectId)
  const { count: completedCount } = useEntityCount(
    orgId, 
    'tasks', 
    'completed = ? AND organization_id = ?',
    [true, orgId]
  )
  const { mutations } = useLiveStoreMutations(orgId)

  const toggleTask = async (taskId, completed) => {
    if (!mutations) return
    await mutations.tasks.update(taskId, { completed })
  }

  if (loading) return <div>Loading tasks...</div>

  // Component logic...
}
```

---

## 📋 **STEP 7: UPDATE SYNC MACHINE INTEGRATION**

### **Replace ServiceCoordinator**

```typescript
// OLD: In sync-machine-v3.ts
import { ServiceCoordinator } from '../../sync/utils/ServiceCoordinator'

// NEW: Replace with pure LiveStore coordinator
import { PureLiveStoreServiceCoordinator } from '../../sync/utils/PureLiveStoreServiceCoordinator'
```

### **Update App Init Machine**

```typescript
// OLD: In app-init-machine.ts
import { syncMachineV3 } from './sync-machine-v3'

// NEW: Replace with pure LiveStore sync machine
import { pureLiveStoreSyncMachine } from './pure-livestore-sync-machine'

// Update the machine reference
const syncMachineActor = interpret(pureLiveStoreSyncMachine)
```

---

## 📋 **STEP 8: VALIDATION CHECKLIST**

After updating each component, verify:

### **✅ Functionality Checklist**
- [ ] Component renders without errors
- [ ] Data loads correctly from LiveStore
- [ ] Create operations work and update UI
- [ ] Update operations work and update UI  
- [ ] Delete operations work and update UI
- [ ] Real-time updates work (changes from other clients appear)
- [ ] Loading states display correctly
- [ ] Error states handle gracefully

### **✅ Performance Checklist**
- [ ] No unnecessary re-renders
- [ ] Queries are efficient (not loading too much data)
- [ ] Mutations complete quickly
- [ ] UI stays responsive during operations

### **✅ Sync Checklist**
- [ ] Changes sync to server correctly
- [ ] Changes from server appear in real-time
- [ ] Offline changes queue and sync when online
- [ ] No duplicate sync events

---

## 📋 **STEP 9: REMOVE DEXIE REFERENCES**

Only after ALL components are working with LiveStore:

### **Move Old Files to Reference**

```bash
# Create reference directory
mkdir -p apps/web/src/reference/dexie

# Move old Dexie files
mv apps/web/src/db/dexie-* apps/web/src/reference/dexie/
mv apps/web/src/sync/DexieOutgoingChangeService.ts apps/web/src/reference/dexie/
mv apps/web/src/sync/DexieIntegrityService.ts apps/web/src/reference/dexie/
mv apps/web/src/state-machines/machines/sync-machine-v3.ts apps/web/src/reference/dexie/
```

### **Update Package.json**

```json
{
  "dependencies": {
    // Remove these lines:
    // "dexie": "^3.x.x",
    // "dexie-react-hooks": "^1.x.x"
  }
}
```

### **Final Validation**

```bash
# Check for any remaining Dexie imports
grep -r "dexie" apps/web/src --exclude-dir=reference

# Should return NO results (except in reference folder)
```

---

## 🎯 **SUCCESS CRITERIA**

### **✅ Pure LiveStore System**
- Zero Dexie imports in active codebase
- All components use LiveStore hooks
- All sync goes through LiveStore services
- All data operations via LiveStore mutations

### **✅ Full Functionality**
- All existing features work identically
- Real-time sync working bidirectionally  
- Offline support maintained
- Performance equal or better than Dexie

### **✅ Clean Codebase**
- Old Dexie code preserved in reference folder
- No dead code or unused imports
- Consistent LiveStore patterns throughout
- Easy to understand and maintain

**Result**: Pure LiveStore system with zero Dexie dependencies and full feature parity.
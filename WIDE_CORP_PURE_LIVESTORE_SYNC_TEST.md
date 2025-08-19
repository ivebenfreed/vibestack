# Wide Corp Pure LiveStore Sync Testing Plan

## 🎯 **OBJECTIVE**

Test the complete pure LiveStore sync system using Wide Corp testing users to validate:
- ✅ Initial sync with real server data
- ✅ Bidirectional sync between multiple users
- ✅ Data consistency across clients
- ✅ LiveStore native performance vs Dexie

---

## 🔐 **WIDE CORP TEST CREDENTIALS**

**Organization ID:** `01920000-1000-7000-8000-000000000001`

### **Primary Test Users**

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| **Owner** | ceo@widecorp.com | WideCorp2024!CEO | Alice CEO - Full access |
| **Admin** | cto@widecorp.com | WideCorp2024!CTO | Bob CTO - Tech admin |
| **Manager** | pm1@widecorp.com | WideCorp2024!PM1 | Carol PM - Project management |
| **Member** | dev1@widecorp.com | WideCorp2024!DEV1 | Eve Developer - Developer access |

### **Test Environment**
- **Server**: http://localhost:8787
- **Client**: http://localhost:5173
- **Database**: Wide Corp has 12 business entity tables ready for testing

---

## 📋 **PHASE 1: SINGLE USER SYNC VALIDATION**

### **Test 1.1: CEO Initial Sync (Alice)**

**Setup:**
1. Start dev servers: `./scripts/dev-start.sh`
2. Open browser: http://localhost:5173
3. Clear all localStorage/IndexedDB data
4. Login as Alice CEO

**Credentials:**
- Email: `ceo@widecorp.com`
- Password: `WideCorp2024!CEO`

**Test Steps:**
```javascript
// 1. Open browser console and monitor sync
console.log('🧪 Starting Wide Corp CEO sync test...')

// 2. Verify pure LiveStore system loaded
const pureLiveStoreSyncActor = window.pureLiveStoreSyncMachineActor
console.log('Pure LiveStore Sync Actor:', pureLiveStoreSyncActor?.getSnapshot().value)

// 3. Check LiveStore initialization
window.addEventListener('livestore:ready', (event) => {
  console.log('✅ LiveStore Ready:', event.detail)
})

// 4. Monitor sync phases
pureLiveStoreSyncActor?.subscribe((snapshot) => {
  console.log('🔄 Sync Phase:', snapshot.value, snapshot.context)
})

// 5. Test pure LiveStore system
await window.testPureLiveStoreSystem()
```

**Expected Results:**
- ✅ App loads without errors
- ✅ LiveStore initializes for Wide Corp organization
- ✅ Sync progresses: `idle → initializing_services → connecting → initial_sync → catchup_sync → live_sync`
- ✅ All Wide Corp data syncs from server
- ✅ Pure LiveStore test passes 100%

**Validation:**
```javascript
// Check data loaded correctly
const orgId = '01920000-1000-7000-8000-000000000001'

// Test hooks work
import { useProjects, useTasks, useUsers } from '@/lib/livestore-hooks'

// Verify data in LiveStore
const liveStoreClient = await getLiveStoreClient(orgId)
const projects = await liveStoreClient.store.query('SELECT * FROM org_01920000_1000_7000_8000_000000000001_projects')
console.log('📊 Wide Corp Projects loaded:', projects.length)

const tasks = await liveStoreClient.store.query('SELECT * FROM org_01920000_1000_7000_8000_000000000001_tasks')
console.log('📊 Wide Corp Tasks loaded:', tasks.length)
```

---

## 📋 **PHASE 2: BIDIRECTIONAL SYNC TESTING**

### **Test 2.1: Multi-User Sync Setup**

**Setup Multiple Browser Sessions:**

**Session 1 - CEO (Alice):**
- Browser 1: http://localhost:5173
- Login: ceo@widecorp.com / WideCorp2024!CEO
- Role: Create and modify data

**Session 2 - CTO (Bob):**
- Browser 2 (Private/Incognito): http://localhost:5173
- Login: cto@widecorp.com / WideCorp2024!CTO
- Role: Receive and verify changes

### **Test 2.2: Outgoing Changes (CEO → Server → CTO)**

**CEO Session (Create Data):**
```javascript
// 1. Get mutations for CEO
const { mutations } = useLiveStoreMutations('01920000-1000-7000-8000-000000000001')

// 2. Create a new project
const newProject = await mutations.projects.create({
  name: 'Pure LiveStore Test Project',
  description: 'Testing pure LiveStore sync capabilities',
  status: 'active',
  organization_id: '01920000-1000-7000-8000-000000000001'
})
console.log('✅ CEO created project:', newProject)

// 3. Create tasks for the project
const task1 = await mutations.tasks.create({
  title: 'Test LiveStore Mutations',
  description: 'Verify auto-generated mutations work',
  project_id: newProject.id,
  organization_id: '01920000-1000-7000-8000-000000000001',
  completed: false
})

const task2 = await mutations.tasks.create({
  title: 'Test Real-time Sync',
  description: 'Verify changes sync between users',
  project_id: newProject.id,
  organization_id: '01920000-1000-7000-8000-000000000001',
  completed: false
})

console.log('✅ CEO created tasks:', [task1.id, task2.id])
```

**CTO Session (Verify Reception):**
```javascript
// 1. Monitor for incoming changes
const { data: projects } = useProjects('01920000-1000-7000-8000-000000000001')
const { data: tasks } = useTasks('01920000-1000-7000-8000-000000000001')

// 2. Look for the new project and tasks
const testProject = projects.find(p => p.name === 'Pure LiveStore Test Project')
console.log('📥 CTO received project:', testProject ? 'YES' : 'NO')

const testTasks = tasks.filter(t => t.project_id === testProject?.id)
console.log('📥 CTO received tasks:', testTasks.length)

// 3. Verify data integrity
console.log('🔍 Data integrity check:', {
  project: testProject,
  tasks: testTasks,
  taskTitles: testTasks.map(t => t.title)
})
```

### **Test 2.3: Incoming Changes (CTO → Server → CEO)**

**CTO Session (Modify Data):**
```javascript
// 1. Get mutations for CTO
const { mutations } = useLiveStoreMutations('01920000-1000-7000-8000-000000000001')

// 2. Complete a task
const taskToComplete = testTasks[0]
await mutations.tasks.update(taskToComplete.id, {
  completed: true,
  updated_by: 'cto@widecorp.com'
})
console.log('✅ CTO completed task:', taskToComplete.title)

// 3. Update project status
await mutations.projects.update(testProject.id, {
  status: 'in_progress',
  updated_by: 'cto@widecorp.com'
})
console.log('✅ CTO updated project status')
```

**CEO Session (Verify Updates):**
```javascript
// 1. Check for real-time updates
const updatedProject = projects.find(p => p.id === testProject.id)
const updatedTasks = tasks.filter(t => t.project_id === testProject.id)

// 2. Verify changes received
console.log('📥 CEO received updates:', {
  projectStatus: updatedProject?.status,
  completedTasks: updatedTasks.filter(t => t.completed).length,
  updatedBy: updatedProject?.updated_by
})

// 3. Verify real-time reactivity
console.log('🔄 Real-time sync working:', 
  updatedProject?.status === 'in_progress' && 
  updatedTasks.some(t => t.completed)
)
```

---

## 📋 **PHASE 3: PERFORMANCE & CONSISTENCY VALIDATION**

### **Test 3.1: Performance Comparison**

**Test Query Performance:**
```javascript
// 1. Time LiveStore queries
console.time('LiveStore Query Performance')

const liveStoreProjects = await liveStoreClient.store.query(`
  SELECT * FROM org_01920000_1000_7000_8000_000000000001_projects 
  WHERE status = 'active' 
  ORDER BY created_at DESC 
  LIMIT 100
`)

console.timeEnd('LiveStore Query Performance')
console.log('📊 LiveStore query returned:', liveStoreProjects.length, 'projects')

// 2. Time complex joins
console.time('LiveStore Join Performance')

const projectsWithTasks = await liveStoreClient.store.query(`
  SELECT 
    p.name as project_name,
    COUNT(t.id) as task_count,
    SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed_tasks
  FROM org_01920000_1000_7000_8000_000000000001_projects p
  LEFT JOIN org_01920000_1000_7000_8000_000000000001_tasks t ON p.id = t.project_id
  GROUP BY p.id, p.name
  ORDER BY task_count DESC
`)

console.timeEnd('LiveStore Join Performance')
console.log('📊 LiveStore join returned:', projectsWithTasks.length, 'project summaries')
```

### **Test 3.2: Data Consistency Validation**

**Cross-Client Data Verification:**
```javascript
// Run this in both CEO and CTO sessions

// 1. Count all entities
const orgId = '01920000-1000-7000-8000-000000000001'
const liveStore = await getLiveStoreClient(orgId)

const counts = {
  projects: await liveStore.store.query(`SELECT COUNT(*) as count FROM org_${orgId.replace(/-/g, '_')}_projects`),
  tasks: await liveStore.store.query(`SELECT COUNT(*) as count FROM org_${orgId.replace(/-/g, '_')}_tasks`),
  users: await liveStore.store.query(`SELECT COUNT(*) as count FROM org_${orgId.replace(/-/g, '_')}_users`)
}

console.log('📊 Entity counts:', {
  projects: counts.projects[0]?.count,
  tasks: counts.tasks[0]?.count,
  users: counts.users[0]?.count
})

// 2. Verify data integrity
const integrityCheck = await liveStore.store.query(`
  SELECT 
    'orphaned_tasks' as issue_type,
    COUNT(*) as count
  FROM org_${orgId.replace(/-/g, '_')}_tasks t
  LEFT JOIN org_${orgId.replace(/-/g, '_')}_projects p ON t.project_id = p.id
  WHERE t.project_id IS NOT NULL AND p.id IS NULL
`)

console.log('🔍 Data integrity:', integrityCheck)
```

---

## 📋 **PHASE 4: STRESS TESTING**

### **Test 4.1: Bulk Operations**

**CEO Session (Bulk Create):**
```javascript
// 1. Test bulk project creation
const { bulkCreate } = useBulkOperations('01920000-1000-7000-8000-000000000001')

console.time('Bulk Project Creation')

const bulkProjects = []
for (let i = 1; i <= 10; i++) {
  bulkProjects.push({
    name: `Bulk Test Project ${i}`,
    description: `Performance testing project ${i}`,
    status: 'planning',
    organization_id: '01920000-1000-7000-8000-000000000001'
  })
}

const createdProjects = await bulkCreate('projects', bulkProjects)
console.timeEnd('Bulk Project Creation')
console.log('✅ Bulk created projects:', createdProjects.length)

// 2. Test bulk task creation
console.time('Bulk Task Creation')

const bulkTasks = []
createdProjects.forEach((project, projectIndex) => {
  for (let i = 1; i <= 5; i++) {
    bulkTasks.push({
      title: `Task ${i} for Project ${projectIndex + 1}`,
      description: `Performance testing task`,
      project_id: project.id,
      completed: false,
      organization_id: '01920000-1000-7000-8000-000000000001'
    })
  }
})

const createdTasks = await bulkCreate('tasks', bulkTasks)
console.timeEnd('Bulk Task Creation')
console.log('✅ Bulk created tasks:', createdTasks.length)
```

**CTO Session (Verify Bulk Reception):**
```javascript
// Monitor bulk changes reception
let receivedBulkProjects = 0
let receivedBulkTasks = 0

const { data: allProjects } = useProjects('01920000-1000-7000-8000-000000000001')
const { data: allTasks } = useTasks('01920000-1000-7000-8000-000000000001')

const bulkTestProjects = allProjects.filter(p => p.name.startsWith('Bulk Test Project'))
const bulkTestTasks = allTasks.filter(t => t.title.includes('Performance testing'))

console.log('📥 CTO received bulk changes:', {
  projects: bulkTestProjects.length,
  tasks: bulkTestTasks.length,
  expectedProjects: 10,
  expectedTasks: 50
})
```

---

## 📋 **PHASE 5: OFFLINE/ONLINE TESTING**

### **Test 5.1: Offline Changes**

**CEO Session (Simulate Offline):**
```javascript
// 1. Disconnect from network (simulate offline)
console.log('📡 Simulating offline mode...')

// 2. Make changes while "offline"
const offlineProject = await mutations.projects.create({
  name: 'Offline Test Project',
  description: 'Created while offline',
  status: 'draft',
  organization_id: '01920000-1000-7000-8000-000000000001'
})

const offlineTask = await mutations.tasks.create({
  title: 'Offline Task',
  description: 'Created while offline',
  project_id: offlineProject.id,
  completed: false,
  organization_id: '01920000-1000-7000-8000-000000000001'
})

console.log('✅ Created offline changes:', {
  project: offlineProject.id,
  task: offlineTask.id
})

// 3. Reconnect and verify sync
console.log('📡 Reconnecting to network...')
// (Reconnect network)

// Monitor sync resumption
pureLiveStoreSyncActor?.subscribe((snapshot) => {
  if (snapshot.value === 'live_sync') {
    console.log('✅ Sync resumed - offline changes should sync')
  }
})
```

---

## 🎯 **SUCCESS CRITERIA**

### **✅ Core Functionality**
- [ ] Wide Corp login works with pure LiveStore system
- [ ] Initial sync loads all Wide Corp data correctly
- [ ] Real-time bidirectional sync works between users
- [ ] All CRUD operations work via LiveStore mutations
- [ ] Data consistency maintained across clients

### **✅ Performance**
- [ ] LiveStore queries faster than equivalent Dexie operations
- [ ] Bulk operations complete efficiently
- [ ] Real-time updates appear within 1-2 seconds
- [ ] No memory leaks or performance degradation

### **✅ Reliability**
- [ ] No sync loops or duplicate changes
- [ ] Offline changes sync correctly when reconnected
- [ ] Error handling works properly
- [ ] System recovers gracefully from failures

### **✅ Data Integrity**
- [ ] No data loss during migration
- [ ] All relationships preserved correctly
- [ ] Timestamps and audit fields maintained
- [ ] Organization isolation works properly

---

## 🚀 **EXECUTION CHECKLIST**

### **Pre-Test Setup**
- [ ] Start dev servers: `./scripts/dev-start.sh`
- [ ] Verify Wide Corp test data exists in server database
- [ ] Clear all browser storage for clean test
- [ ] Open browser dev tools for monitoring

### **Test Execution Order**
1. [ ] **Phase 1** - Single user sync (CEO)
2. [ ] **Phase 2** - Bidirectional sync (CEO ↔ CTO)
3. [ ] **Phase 3** - Performance validation
4. [ ] **Phase 4** - Stress testing
5. [ ] **Phase 5** - Offline/online testing

### **Test Documentation**
- [ ] Record sync timings and performance metrics
- [ ] Screenshot any errors or issues
- [ ] Document data counts and consistency checks
- [ ] Note any differences from Dexie behavior

**Target**: 100% test pass rate with improved performance over Dexie system.
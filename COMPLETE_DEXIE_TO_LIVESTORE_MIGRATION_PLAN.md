# Complete Dexie to LiveStore Migration Plan

## 🎯 **MIGRATION OBJECTIVE**

**GOAL**: Complete elimination of Dexie dependency and migration to pure LiveStore native system.

**CURRENT STATE**: Hybrid system with both Dexie and LiveStore running in parallel  
**TARGET STATE**: Pure LiveStore system with native sync capabilities

---

## 🔍 **ANALYSIS OF CURRENT HYBRID SYSTEM**

### **❌ PROBLEMS WITH CURRENT APPROACH**

1. **Dual Storage Complexity**: Maintaining both Dexie and LiveStore creates unnecessary complexity
2. **Sync Duplication**: Changes flow through both Dexie hooks AND LiveStore subscriptions
3. **Data Consistency Issues**: Two sources of truth can diverge
4. **Performance Overhead**: Double storage and processing overhead
5. **Maintenance Burden**: Two different database systems to maintain

### **✅ WHAT WORKS IN CURRENT SYSTEM**

1. **LiveStore Event Generation**: Schema-driven mutations are working
2. **Native Sync Integration**: LiveStore subscriptions detect changes correctly
3. **Service Integration**: LiveStore integrates well with existing WebSocket infrastructure
4. **Organization Isolation**: LiveStore handles org-specific databases properly

---

## 📋 **COMPLETE MIGRATION PLAN**

### **Phase 1: LiveStore-Only Data Layer** 🔄

#### **1.1 Replace All Dexie Database Access**

**Target Files to Replace:**
- `apps/web/src/db/dexie-init.ts` → ELIMINATE
- `apps/web/src/db/dexie-schema.ts` → ELIMINATE  
- `apps/web/src/db/dexie-change-tracking.ts` → ELIMINATE
- All components importing `db` from Dexie → Replace with LiveStore

**Implementation:**
```typescript
// REPLACE: import { db } from '../db/dexie-init'
// WITH: import { useLiveStoreMutations, useLiveStoreQuery } from '../lib/livestore-hooks'

// OLD: await db.projects.add(projectData)
// NEW: await mutations.projects.create(projectData)

// OLD: const projects = await db.projects.where('organization_id').equals(orgId).toArray()
// NEW: const projects = useLiveStoreQuery(orgId, 'projects', 'SELECT * FROM org_123_projects WHERE organization_id = ?', [orgId])
```

#### **1.2 Create LiveStore React Hooks**

**New File**: `apps/web/src/lib/livestore-hooks.ts`
```typescript
export function useLiveStoreMutations(organizationId: string) {
  const { liveStoreSync } = useServiceCoordinator()
  return liveStoreSync?.getMutations() || null
}

export function useLiveStoreQuery(organizationId: string, entityName: string, sql: string, params: any[]) {
  const { liveStore } = useServiceCoordinator()
  const [data, setData] = useState([])
  
  useEffect(() => {
    if (!liveStore) return
    
    // Execute query
    liveStore.query(sql, params).then(setData)
    
    // Subscribe to changes
    const tableName = `org_${organizationId}_${entityName}`
    const unsubscribe = liveStore.store.subscribe(tableName, (updatedData) => {
      liveStore.query(sql, params).then(setData)
    })
    
    return unsubscribe
  }, [liveStore, sql, params])
  
  return data
}
```

#### **1.3 Replace Dexie-Dependent Components**

**Strategy**: Systematic replacement of all `db.` calls with LiveStore equivalents

**Component Pattern:**
```typescript
// OLD: Dexie-based component
function ProjectsList() {
  const [projects, setProjects] = useState([])
  
  useEffect(() => {
    db.projects.where('organization_id').equals(orgId).toArray()
      .then(setProjects)
  }, [orgId])
  
  const createProject = async (data) => {
    await db.projects.add({ ...data, organization_id: orgId })
    // Refetch...
  }
}

// NEW: LiveStore-based component  
function ProjectsList() {
  const mutations = useLiveStoreMutations(orgId)
  const projects = useLiveStoreQuery(orgId, 'projects', 
    'SELECT * FROM org_? _projects WHERE organization_id = ?', [orgId, orgId]
  )
  
  const createProject = async (data) => {
    await mutations?.projects.create({ ...data, organization_id: orgId })
    // LiveStore subscription automatically updates UI
  }
}
```

---

### **Phase 2: Native LiveStore Sync System** 🔄

#### **2.1 Eliminate Dexie Change Tracking**

**Remove Files:**
- `apps/web/src/db/dexie-change-tracking.ts`
- `apps/web/src/sync/DexieOutgoingChangeService.ts`
- All `local_changes` table references

**Replace With**: Pure LiveStore native event system

#### **2.2 Create Pure LiveStore Sync Services**

**New File**: `apps/web/src/sync/LiveStoreOutgoingService.ts`
```typescript
/**
 * Pure LiveStore Outgoing Service
 * Uses only LiveStore subscriptions - no Dexie dependencies
 */
export class LiveStoreOutgoingService {
  private subscriptions: Map<string, () => void> = new Map()
  
  constructor(
    private store: LiveStore,
    private webSocketService: WebSocketService,
    private organizationId: string
  ) {}
  
  initialize() {
    // Subscribe to ALL entity tables for this organization
    const entities = Object.keys(this.orgSchema.entitySchemas)
    
    entities.forEach(entityName => {
      const tableName = `org_${this.organizationId}_${entityName}`
      
      const unsubscribe = this.store.subscribe(tableName, (changes) => {
        this.handleNativeChange(entityName, changes)
      })
      
      this.subscriptions.set(entityName, unsubscribe)
    })
  }
  
  private handleNativeChange(entityName: string, changes: any[]) {
    // Convert LiveStore changes to sync format
    changes.forEach(record => {
      const tableChange = this.convertToTableChange(entityName, record)
      this.sendToServer(tableChange)
    })
  }
  
  private sendToServer(change: TableChange) {
    this.webSocketService.send({
      type: 'clt_send_changes',
      changes: [change],
      clientId: this.clientId,
      organizationId: this.organizationId
    })
  }
}
```

#### **2.3 Create Pure LiveStore Incoming Service**

**New File**: `apps/web/src/sync/LiveStoreIncomingService.ts`
```typescript
/**
 * Pure LiveStore Incoming Service  
 * Applies changes directly to LiveStore - no Dexie
 */
export class LiveStoreIncomingService {
  constructor(
    private liveStoreSync: LiveStoreNativeSync
  ) {}
  
  async processIncomingChanges(changes: TableChange[]) {
    // Use our existing native sync but remove Dexie parts
    await this.liveStoreSync.applyIncomingChanges(changes)
  }
}
```

---

### **Phase 3: Pure LiveStore ServiceCoordinator** 🔄

#### **3.1 Create LiveStore-Only ServiceCoordinator**

**New File**: `apps/web/src/sync/utils/PureLiveStoreServiceCoordinator.ts`
```typescript
/**
 * Pure LiveStore Service Coordinator
 * No Dexie dependencies - LiveStore only
 */
export class PureLiveStoreServiceCoordinator {
  private services = {
    webSocket: null as WebSocketService | null,
    liveStore: null as LiveStoreInstance | null,
    outgoing: null as LiveStoreOutgoingService | null,
    incoming: null as LiveStoreIncomingService | null,
    integrity: null as LiveStoreIntegrityService | null
  }
  
  async initialize(config: PureLiveStoreConfig): Promise<PureLiveStoreServices> {
    // 1. Initialize LiveStore first (primary data store)
    this.services.liveStore = await this.initializeLiveStore(config)
    
    // 2. Initialize WebSocket
    this.services.webSocket = new WebSocketService(config.webSocketConfig)
    
    // 3. Initialize LiveStore-only sync services
    this.services.outgoing = new LiveStoreOutgoingService(
      this.services.liveStore.store,
      this.services.webSocket,
      config.organizationId
    )
    
    this.services.incoming = new LiveStoreIncomingService(
      this.services.liveStore
    )
    
    // 4. Initialize LiveStore-based integrity service
    this.services.integrity = new LiveStoreIntegrityService(
      this.services.liveStore,
      this.services.webSocket
    )
    
    return this.services as PureLiveStoreServices
  }
}
```

---

### **Phase 4: Database Schema Migration** 🔄

#### **4.1 LiveStore Schema Generation Enhancement**

**Enhance**: `apps/web/src/lib/livestore-dynamic-schema.ts`
```typescript
// Add support for ALL database features that Dexie provided
export function generateCompleteLiveStoreSchema(orgSchema: OrgEntitySchema) {
  return {
    // All entity tables
    ...generateEntityTables(orgSchema),
    
    // System tables (replace Dexie system tables)
    system_info: {
      id: Schema.String,
      key: Schema.String,
      value: Schema.String,
      updated_at: Schema.String
    },
    
    // User preferences (replace Dexie user_preferences) 
    user_preferences: {
      id: Schema.String,
      user_id: Schema.String,
      organization_id: Schema.String,
      preferences: Schema.String, // JSON
      updated_at: Schema.String
    },
    
    // Sync metadata (replace LSN tracking)
    sync_metadata: {
      id: Schema.String,
      client_id: Schema.String,
      current_lsn: Schema.String,
      last_sync: Schema.String,
      organization_id: Schema.String
    }
  }
}
```

#### **4.2 Data Migration Utility**

**New File**: `apps/web/src/lib/dexie-to-livestore-migration.ts`
```typescript
/**
 * One-time migration utility to move data from Dexie to LiveStore
 */
export class DexieToLiveStoreMigration {
  async migrateOrganizationData(organizationId: string) {
    console.log(`🔄 Migrating organization ${organizationId} from Dexie to LiveStore`)
    
    // 1. Initialize LiveStore for org
    const liveStoreInstance = await liveStoreSchemaClient.initializeLiveStore(organizationId, 'migration-client')
    const mutations = await liveStoreEventGenerator.createMutations(organizationId, liveStoreInstance.store, orgSchema)
    
    // 2. Read all data from Dexie
    const dexieData = await this.readAllDexieData(organizationId)
    
    // 3. Write data to LiveStore using mutations
    for (const [entityName, records] of Object.entries(dexieData)) {
      console.log(`📋 Migrating ${records.length} ${entityName} records`)
      
      for (const record of records as any[]) {
        await mutations[entityName].create(record)
      }
    }
    
    // 4. Migrate system data
    await this.migrateSystemData(organizationId, liveStoreInstance)
    
    console.log(`✅ Migration completed for organization ${organizationId}`)
  }
  
  private async readAllDexieData(organizationId: string) {
    const data: Record<string, any[]> = {}
    
    // Read all entity data from Dexie
    data.projects = await db.projects.where('organization_id').equals(organizationId).toArray()
    data.tasks = await db.tasks.where('organization_id').equals(organizationId).toArray()
    data.users = await db.users.where('organization_id').equals(organizationId).toArray()
    // ... all other entities
    
    return data
  }
}
```

---

### **Phase 5: Update React Components** 🔄

#### **5.1 Replace All Database Hooks**

**Strategy**: Replace all Dexie-based hooks with LiveStore equivalents

**Examples:**
```typescript
// REPLACE: useLiveQuery hooks
// OLD:
const projects = useLiveQuery(() => 
  db.projects.where('organization_id').equals(orgId).toArray()
, [orgId])

// NEW:
const projects = useLiveStoreQuery(orgId, 'projects', 
  'SELECT * FROM org_123_projects WHERE organization_id = ?', [orgId]
)

// REPLACE: Direct Dexie mutations
// OLD:
const addProject = async (data) => {
  await db.projects.add({ ...data, organization_id: orgId })
}

// NEW:
const mutations = useLiveStoreMutations(orgId)
const addProject = async (data) => {
  await mutations.projects.create({ ...data, organization_id: orgId })
}
```

#### **5.2 Update All Domain Services**

**Replace**: All domain services that use Dexie
```typescript
// OLD: apps/web/src/services/project-service.ts
export class ProjectService {
  async getProjects(orgId: string) {
    return await db.projects.where('organization_id').equals(orgId).toArray()
  }
  
  async createProject(orgId: string, data: any) {
    return await db.projects.add({ ...data, organization_id: orgId })
  }
}

// NEW: Use LiveStore mutations directly
export class LiveStoreProjectService {
  constructor(private mutations: LiveStoreMutations) {}
  
  async createProject(data: any) {
    return await this.mutations.projects.create(data)
  }
  
  // Queries handled by React hooks, not services
}
```

---

### **Phase 6: ⚠️ CAREFUL VALIDATION (DO NOT DELETE ANYTHING YET)** 🔄

#### **6.1 Keep All Existing Files During Migration**

**⚠️ CRITICAL: DO NOT DELETE ANY DEXIE FILES UNTIL ENTIRE SYSTEM IS CONFIRMED WORKING**

**Parallel Implementation Strategy:**
- Keep all existing Dexie files intact
- Create new LiveStore equivalents alongside existing files  
- Use feature flags to switch between systems
- Maintain rollback capability at all times

#### **6.2 Create Side-by-Side Implementation**

**Keep Existing Files:**
```bash
# KEEP ALL EXISTING FILES:
# ✅ apps/web/src/db/dexie-* (KEEP)
# ✅ apps/web/src/sync/DexieOutgoingChangeService.ts (KEEP)
# ✅ apps/web/src/sync/DexieIntegrityService.ts (KEEP)
# ✅ All existing Dexie components (KEEP)

# CREATE NEW FILES ALONGSIDE:
# 🆕 apps/web/src/lib/pure-livestore-hooks.ts (NEW)
# 🆕 apps/web/src/sync/PureLiveStoreOutgoingService.ts (NEW) 
# 🆕 apps/web/src/sync/utils/PureLiveStoreServiceCoordinator.ts (NEW)
```

#### **6.3 Feature Flag Implementation**

**New File**: `apps/web/src/lib/migration-feature-flags.ts`
```typescript
/**
 * Feature flags for controlled Dexie → LiveStore migration
 * Allows per-component and per-feature rollback
 */
export const MIGRATION_FLAGS = {
  // Global toggle - can disable entire LiveStore system
  ENABLE_LIVESTORE: true,
  
  // Per-component migration flags
  PROJECTS_COMPONENT_LIVESTORE: false, // Start with false, enable after testing
  TASKS_COMPONENT_LIVESTORE: false,
  USERS_COMPONENT_LIVESTORE: false,
  
  // Per-service migration flags  
  OUTGOING_SYNC_LIVESTORE: false,
  INCOMING_SYNC_LIVESTORE: false,
  
  // Development/testing flags
  PARALLEL_VALIDATION: true, // Run both systems, compare results
  LOG_MIGRATION_EVENTS: true
}

// Helper to check if component should use LiveStore
export function shouldUseLiveStore(componentName: string): boolean {
  if (!MIGRATION_FLAGS.ENABLE_LIVESTORE) return false
  
  const flagKey = `${componentName.toUpperCase()}_LIVESTORE` as keyof typeof MIGRATION_FLAGS
  return MIGRATION_FLAGS[flagKey] as boolean || false
}
```

#### **6.4 Gradual Component Migration with Rollback**

**Pattern for Component Updates:**
```typescript
// Example: Updating ProjectsList component
function ProjectsList() {
  const shouldUseLiveStore = shouldUseLiveStore('PROJECTS_COMPONENT')
  
  if (shouldUseLiveStore) {
    return <ProjectsListLiveStore />
  } else {
    return <ProjectsListDexie /> // Keep original working version
  }
}

// Keep both implementations during migration
function ProjectsListDexie() {
  // Original Dexie implementation - KEEP INTACT
  const projects = useLiveQuery(() => 
    db.projects.where('organization_id').equals(orgId).toArray()
  , [orgId])
  // ... rest of original implementation
}

function ProjectsListLiveStore() {
  // New LiveStore implementation
  const projects = useLiveStoreQuery(orgId, 'projects', 
    'SELECT * FROM org_123_projects WHERE organization_id = ?', [orgId]
  )
  // ... new implementation
}
```

---

### **Phase 7: Pure LiveStore Testing** 🔄

#### **7.1 Update Test Suite**

**New File**: `apps/web/src/lib/pure-livestore-system-test.ts`
```typescript
export class PureLiveStoreSystemTest {
  async testCompleteSystem() {
    // 1. Test pure LiveStore data operations
    await this.testPureLiveStoreOperations()
    
    // 2. Test pure LiveStore sync (no Dexie)
    await this.testPureLiveStoreSync()
    
    // 3. Test data integrity without Dexie
    await this.testDataConsistency()
    
    // 4. Test offline/online scenarios
    await this.testOfflineSupport()
    
    // 5. Test multi-organization isolation
    await this.testOrganizationIsolation()
  }
}
```

#### **7.2 Browser Testing Function**
```typescript
// Global test function
if (typeof window !== 'undefined') {
  window.testPureLiveStoreSystem = async () => {
    const test = new PureLiveStoreSystemTest()
    return await test.testCompleteSystem()
  }
}
```

---

## 📅 **SAFE MIGRATION TIMELINE**

### **Week 1: Parallel Implementation Setup**
- [ ] Create feature flag system for controlled rollout
- [ ] Create LiveStore hooks alongside existing Dexie hooks
- [ ] Implement first component with both versions (Dexie + LiveStore)
- [ ] Test single component thoroughly before proceeding

### **Week 2: Gradual Component Migration**
- [ ] Convert 2-3 components with feature flags (keep both versions)
- [ ] Create data validation system to compare Dexie vs LiveStore results
- [ ] Test sync functionality with partial LiveStore components
- [ ] Monitor for any data consistency issues

### **Week 3: Sync Service Migration**
- [ ] Create pure LiveStore sync services alongside existing ones
- [ ] Use feature flags to test LiveStore sync on subset of operations
- [ ] Validate bidirectional sync works correctly
- [ ] Keep Dexie sync as fallback during testing

### **Week 4: Validation & Gradual Rollout**
- [ ] Enable LiveStore for more components via feature flags
- [ ] Test entire user workflows with LiveStore enabled
- [ ] Monitor performance and data consistency
- [ ] Keep rollback plan ready at all times

### **Week 5: Full System Testing**
- [ ] Enable LiveStore for all components (but keep Dexie code)
- [ ] Run comprehensive end-to-end testing
- [ ] Test edge cases, error scenarios, offline/online
- [ ] Validate with real user data and workflows

### **Week 6: Cleanup (ONLY AFTER FULL VALIDATION)**
- [ ] ⚠️ ONLY delete Dexie files after 100% confirmation everything works
- [ ] Remove feature flags once stable
- [ ] Remove Dexie dependencies from package.json
- [ ] Final production validation

---

## 🎯 **SUCCESS CRITERIA**

### **Technical Goals**
1. ✅ **Zero Dexie Dependencies**: No `dexie` imports anywhere in codebase
2. ✅ **Pure LiveStore Storage**: All data operations through LiveStore only
3. ✅ **Native Sync**: Sync uses only LiveStore subscriptions and mutations
4. ✅ **Data Integrity**: All existing data preserved during migration
5. ✅ **Performance**: Equal or better performance than Dexie system

### **Functional Goals**
1. ✅ **All Features Work**: Every existing feature continues to work
2. ✅ **Real-time Sync**: Bidirectional sync continues to work perfectly
3. ✅ **Offline Support**: Offline-first functionality maintained
4. ✅ **Multi-org Support**: Organization isolation continues to work
5. ✅ **Error Handling**: All error scenarios handled properly

### **Migration Validation**
1. ✅ **Data Migration**: All existing user data successfully migrated
2. ✅ **Zero Data Loss**: No data lost during migration process
3. ✅ **Rollback Plan**: Ability to rollback if issues discovered
4. ✅ **User Experience**: Users see no disruption during migration
5. ✅ **Performance**: System performs better or equal to before

---

## ⚠️ **RISKS & MITIGATION**

### **High Risk: Data Loss During Migration**
**Mitigation**: 
- Create complete backup before migration
- Test migration extensively on dev/staging
- Implement rollback mechanism
- Validate data integrity at each step

### **Medium Risk: Performance Regression**
**Mitigation**:
- Benchmark current Dexie performance
- Compare LiveStore performance before migration
- Optimize LiveStore queries for heavy operations
- Monitor performance during rollout

### **Medium Risk: Sync Disruption**
**Mitigation**:
- Test sync extensively with pure LiveStore system
- Maintain WebSocket compatibility during transition  
- Test offline/online scenarios thoroughly
- Have fallback sync mechanism ready

---

## 🚀 **IMMEDIATE SAFE NEXT ACTIONS**

### **Priority 1: Setup Safe Migration Infrastructure**

1. **Create feature flag system** (`apps/web/src/lib/migration-feature-flags.ts`)
   - Global and per-component toggles
   - Easy rollback mechanism
   - Validation and comparison tools

2. **Create LiveStore hooks alongside Dexie** (`apps/web/src/lib/pure-livestore-hooks.ts`)
   - **DO NOT REPLACE** existing Dexie hooks
   - Create new hooks with different names
   - Test thoroughly in isolation

3. **Choose ONE simple component as prototype** (e.g., project list)
   - Keep original Dexie version intact
   - Create new LiveStore version alongside
   - Use feature flag to switch between versions

### **Priority 2: Validation First Approach**

4. **Create data comparison utility** (`apps/web/src/lib/migration-validation.ts`)
   - Compare Dexie vs LiveStore results
   - Log any discrepancies
   - Validate data integrity constantly

5. **Test prototype extensively** 
   - Test with feature flag OFF (original Dexie)
   - Test with feature flag ON (new LiveStore)
   - Compare results and behavior
   - **Only proceed if 100% identical behavior**

### **Priority 3: Gradual Expansion**

6. **Add more components only after prototype works**
   - One component at a time
   - Always keep both versions
   - Always maintain rollback capability

## ⚠️ **CRITICAL SAFETY RULES**

1. **NEVER delete any existing Dexie files until the entire system is confirmed working**
2. **NEVER make breaking changes** - always maintain backward compatibility
3. **ALWAYS keep rollback option** - feature flags must allow instant revert
4. **VALIDATE everything** - compare Dexie vs LiveStore results constantly
5. **ONE change at a time** - never migrate multiple components simultaneously

This plan will result in a **pure LiveStore system with zero Dexie dependencies**, but only after **extremely careful validation** and **guaranteed rollback capability** throughout the entire migration process.
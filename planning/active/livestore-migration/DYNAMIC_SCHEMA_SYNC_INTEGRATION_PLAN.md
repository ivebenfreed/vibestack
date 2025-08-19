# Dynamic Schema Updates & Sync System Integration Plan

## 🎯 **MISSION OBJECTIVE**

**GOAL**: Create a comprehensive dynamic schema system that automatically updates LiveStore schemas and sync services when organizations modify their entity definitions, with real-time propagation across all clients.

**CURRENT STATE**: LiveStore v0.3.1 working with static schema, organization schemas generated but not dynamic  
**TARGET STATE**: Fully dynamic schema system with real-time updates, automated sync coordination, and hot schema swapping

---

## 🔍 **ANALYSIS OF CURRENT SYSTEM**

### **✅ WHAT'S WORKING**
1. **LiveStore v0.3.1 Integration**: Basic LiveStore working with correct API
2. **Dynamic Schema Generation**: Transforms org schemas to LiveStore format
3. **Organization Isolation**: Multi-tenant data separation working
4. **Sync Infrastructure**: WebSocket sync services operational
5. **Event System**: Event-sourced architecture in place

### **🔄 WHAT NEEDS DYNAMIC UPDATES**
1. **Schema Hot-Swapping**: LiveStore schema updates without restart
2. **Sync Service Coordination**: Update sync subscriptions when schema changes
3. **Client Schema Propagation**: Push schema updates to all connected clients
4. **Migration Handling**: Migrate existing data when schema changes
5. **Rollback Capabilities**: Safe schema rollback for failed updates

---

## 📋 **COMPREHENSIVE INTEGRATION PLAN**

## **Phase 1: Dynamic Schema Foundation** 🚀

### **1.1 Enhanced Schema Change Detection**

**New File**: `apps/web/src/lib/schema-change-detector.ts`
```typescript
/**
 * Real-time schema change detection and coordination
 */
export class SchemaChangeDetector {
  private schemaSubscriptions = new Map<string, (() => void)[]>()
  private lastSchemaHashes = new Map<string, string>()
  
  /**
   * Subscribe to schema changes for organization
   */
  subscribeToSchemaChanges(orgId: string, callback: (newSchema: OrgEntitySchema) => void): () => void {
    // Set up WebSocket subscription to org schema changes
    // Watch for DataForge entity creation/modification events
    // Detect field additions, removals, type changes
  }
  
  /**
   * Detect what type of schema change occurred
   */
  analyzeSchemaChange(oldSchema: OrgEntitySchema, newSchema: OrgEntitySchema): SchemaChangeAnalysis {
    return {
      type: 'additive' | 'breaking' | 'compatible',
      changes: [
        { entity: 'ProjectEntity', action: 'field_added', field: 'budget', type: 'number' },
        { entity: 'TaskEntity', action: 'field_removed', field: 'legacy_priority' },
        { entity: 'ClientEntity', action: 'field_type_changed', field: 'phone', from: 'string', to: 'phone' }
      ],
      migrationRequired: boolean,
      breakingChanges: string[],
      estimatedImpact: 'low' | 'medium' | 'high'
    }
  }
}
```

### **1.2 Schema Version Management**

**New File**: `apps/web/src/lib/schema-version-manager.ts`
```typescript
/**
 * Schema versioning and compatibility management
 */
export class SchemaVersionManager {
  /**
   * Version schema and track changes
   */
  async createSchemaVersion(orgId: string, schema: OrgEntitySchema, changes: SchemaChangeAnalysis): Promise<SchemaVersion> {
    const version: SchemaVersion = {
      id: generateId(),
      organizationId: orgId,
      version: this.getNextVersion(orgId),
      schema: schema,
      changes: changes,
      status: 'pending',
      createdAt: new Date(),
      appliedAt: null,
      rollbackVersion: this.getCurrentVersion(orgId),
      migrationPlan: await this.generateMigrationPlan(changes)
    }
    
    await this.storeSchemaVersion(version)
    return version
  }
  
  /**
   * Generate migration plan for schema changes
   */
  private async generateMigrationPlan(changes: SchemaChangeAnalysis): Promise<MigrationPlan> {
    const steps: MigrationStep[] = []
    
    for (const change of changes.changes) {
      switch (change.action) {
        case 'field_added':
          steps.push({
            type: 'add_column',
            table: change.entity,
            column: change.field,
            sqlStatement: `ALTER TABLE ${change.entity} ADD COLUMN ${change.field} ${this.mapTypeToSQL(change.type)}`
          })
          break
          
        case 'field_removed':
          // SQLite doesn't support DROP COLUMN, need to recreate table
          steps.push({
            type: 'recreate_table',
            table: change.entity,
            reason: 'SQLite does not support DROP COLUMN'
          })
          break
          
        case 'field_type_changed':
          steps.push({
            type: 'type_migration',
            table: change.entity,
            column: change.field,
            dataTransformation: this.generateTypeConverter(change.from, change.to)
          })
          break
      }
    }
    
    return { steps, estimatedDuration: this.estimateMigrationTime(steps) }
  }
}
```

## **Phase 2: LiveStore Schema Hot-Swapping** 🔄

### **2.1 Dynamic Schema Updates**

**Enhanced**: `apps/web/src/lib/livestore-schema-client.ts`
```typescript
/**
 * Enhanced LiveStore client with hot schema swapping
 */
export class LiveStoreSchemaClient {
  private schemaChangeDetector = new SchemaChangeDetector()
  private schemaVersionManager = new SchemaVersionManager()
  private migrationEngine = new SchemaMigrationEngine()
  
  /**
   * Initialize with schema change monitoring
   */
  async initializeLiveStore(orgId: string, clientId: string): Promise<LiveStoreInstance | null> {
    // ... existing initialization ...
    
    // Set up schema change monitoring
    this.schemaChangeDetector.subscribeToSchemaChanges(orgId, async (newSchema) => {
      await this.handleSchemaChange(orgId, newSchema)
    })
    
    return instance
  }
  
  /**
   * Handle real-time schema changes
   */
  private async handleSchemaChange(orgId: string, newSchema: OrgEntitySchema): Promise<void> {
    console.log(`🔄 Schema change detected for org: ${orgId}`)
    
    try {
      // 1. Analyze the change
      const oldSchema = await this.getCurrentSchema(orgId)
      const changeAnalysis = this.schemaChangeDetector.analyzeSchemaChange(oldSchema, newSchema)
      
      // 2. Create new schema version
      const schemaVersion = await this.schemaVersionManager.createSchemaVersion(orgId, newSchema, changeAnalysis)
      
      // 3. Determine update strategy
      if (changeAnalysis.type === 'additive') {
        // Safe to apply immediately - only adding fields/tables
        await this.applyAdditiveSchemaChange(orgId, schemaVersion)
      } else if (changeAnalysis.type === 'compatible') {
        // Requires migration but safe
        await this.applyCompatibleSchemaChange(orgId, schemaVersion)
      } else {
        // Breaking changes - require careful migration
        await this.scheduleBreakingSchemaChange(orgId, schemaVersion)
      }
      
    } catch (error) {
      console.error(`❌ Schema update failed for org ${orgId}:`, error)
      // Rollback to previous schema version
      await this.rollbackToLastVersion(orgId)
    }
  }
  
  /**
   * Apply additive schema changes immediately
   */
  private async applyAdditiveSchemaChange(orgId: string, version: SchemaVersion): Promise<void> {
    const instance = this.liveStoreInstances.get(orgId)
    if (!instance) return
    
    // 1. Generate new LiveStore schema
    const newLiveStoreSchema = liveStoreSchemaManager.generateLiveStoreSchema(version.schema)
    
    // 2. Apply schema changes to LiveStore
    await this.updateLiveStoreSchema(instance, newLiveStoreSchema)
    
    // 3. Update sync subscriptions
    await this.updateSyncSubscriptions(orgId, version.schema)
    
    // 4. Notify other clients
    await this.broadcastSchemaUpdate(orgId, version)
    
    // 5. Mark version as applied
    await this.schemaVersionManager.markVersionApplied(version.id)
    
    console.log(`✅ Additive schema change applied for org: ${orgId}`)
  }
  
  /**
   * Apply compatible schema changes with migration
   */
  private async applyCompatibleSchemaChange(orgId: string, version: SchemaVersion): Promise<void> {
    const instance = this.liveStoreInstances.get(orgId)
    if (!instance) return
    
    // 1. Create migration plan
    const migrationPlan = version.migrationPlan
    
    // 2. Execute migration
    await this.migrationEngine.executeMigration(instance, migrationPlan)
    
    // 3. Update LiveStore schema
    const newLiveStoreSchema = liveStoreSchemaManager.generateLiveStoreSchema(version.schema)
    await this.updateLiveStoreSchema(instance, newLiveStoreSchema)
    
    // 4. Update sync services
    await this.updateSyncSubscriptions(orgId, version.schema)
    
    // 5. Broadcast to clients
    await this.broadcastSchemaUpdate(orgId, version)
    
    console.log(`✅ Compatible schema change applied with migration for org: ${orgId}`)
  }
}
```

### **2.2 Schema Migration Engine**

**New File**: `apps/web/src/lib/schema-migration-engine.ts`
```typescript
/**
 * Handles safe schema migrations for LiveStore
 */
export class SchemaMigrationEngine {
  /**
   * Execute migration plan safely
   */
  async executeMigration(instance: LiveStoreInstance, plan: MigrationPlan): Promise<void> {
    console.log(`🔄 Executing migration plan with ${plan.steps.length} steps`)
    
    // Create migration transaction
    await instance.store.transaction(async (tx) => {
      for (const step of plan.steps) {
        await this.executeStep(tx, step)
      }
    })
  }
  
  /**
   * Execute individual migration step
   */
  private async executeStep(tx: any, step: MigrationStep): Promise<void> {
    switch (step.type) {
      case 'add_column':
        await tx.query(step.sqlStatement)
        break
        
      case 'recreate_table':
        await this.recreateTable(tx, step.table)
        break
        
      case 'type_migration':
        await this.migrateColumnType(tx, step.table, step.column, step.dataTransformation)
        break
        
      case 'add_index':
        await tx.query(`CREATE INDEX ${step.indexName} ON ${step.table} (${step.columns.join(', ')})`)
        break
    }
  }
  
  /**
   * Safely recreate table (for SQLite DROP COLUMN limitation)
   */
  private async recreateTable(tx: any, tableName: string): Promise<void> {
    // 1. Get current table schema
    const tableInfo = await tx.query(`PRAGMA table_info(${tableName})`)
    
    // 2. Create temporary table with new schema
    const tempTableName = `${tableName}_temp_${Date.now()}`
    await this.createTempTable(tx, tempTableName, tableInfo)
    
    // 3. Copy data to temp table
    await tx.query(`INSERT INTO ${tempTableName} SELECT * FROM ${tableName}`)
    
    // 4. Drop original table
    await tx.query(`DROP TABLE ${tableName}`)
    
    // 5. Rename temp table
    await tx.query(`ALTER TABLE ${tempTableName} RENAME TO ${tableName}`)
  }
}
```

## **Phase 3: Sync System Integration** 🔄

### **3.1 Dynamic Sync Subscription Management**

**Enhanced**: `apps/web/src/sync/PureLiveStoreSync.ts`
```typescript
/**
 * Enhanced sync with dynamic schema awareness
 */
export class PureLiveStoreSync {
  private schemaSubscriptions = new Map<string, () => void>()
  
  /**
   * Initialize with schema change monitoring
   */
  async initialize(): Promise<void> {
    // ... existing initialization ...
    
    // Subscribe to schema changes
    const unsubscribe = liveStoreSchemaClient.subscribeToSchemaChanges(
      this.config.organizationId,
      (newSchema) => this.handleSchemaChange(newSchema)
    )
    this.schemaSubscriptions.set(this.config.organizationId, unsubscribe)
  }
  
  /**
   * Handle schema changes in sync system
   */
  private async handleSchemaChange(newSchema: OrgEntitySchema): Promise<void> {
    console.log(`🔄 Sync system handling schema change for org: ${this.config.organizationId}`)
    
    // 1. Update entity subscriptions
    await this.updateEntitySubscriptions(newSchema)
    
    // 2. Update event generators
    await this.updateEventGenerators(newSchema)
    
    // 3. Notify server of schema change
    await this.notifyServerSchemaChange(newSchema)
    
    // 4. Update incoming change handlers
    await this.updateIncomingHandlers(newSchema)
  }
  
  /**
   * Update LiveStore subscriptions for new/modified entities
   */
  private async updateEntitySubscriptions(newSchema: OrgEntitySchema): Promise<void> {
    // Clear existing subscriptions
    this.subscriptions.forEach(unsubscribe => unsubscribe())
    this.subscriptions.clear()
    
    // Create new subscriptions for updated entity list
    const entities = Object.keys(newSchema.entities)
    for (const entityName of entities) {
      const tableName = `org_${this.config.organizationId}_${entityName}`
      
      const unsubscribe = this.liveStore.subscribe(tableName, (changes: any[]) => {
        this.handleNativeChange(entityName, tableName, changes)
      })
      
      this.subscriptions.set(entityName, unsubscribe)
    }
    
    console.log(`✅ Updated ${entities.length} entity subscriptions`)
  }
  
  /**
   * Update event generators for new schema
   */
  private async updateEventGenerators(newSchema: OrgEntitySchema): Promise<void> {
    // Regenerate event handlers for new/modified entities
    const generator = new LiveStoreEventGenerator()
    const newComponents = generator.generateForOrganization(this.config.organizationId, newSchema)
    
    // Update mutation handlers
    this.mutations = newComponents.mutations
    
    // Update query helpers
    this.queries = newComponents.queries
    
    console.log(`✅ Updated event generators for ${Object.keys(newSchema.entities).length} entities`)
  }
}
```

### **3.2 Server-Side Schema Coordination**

**Enhanced**: `apps/server/src/sync/SyncDO.ts`
```typescript
/**
 * Enhanced SyncDO with schema change coordination
 */
export class SyncDO implements DurableObject {
  private currentOrgSchema: OrgEntitySchema | null = null
  private schemaVersion: string | null = null
  
  /**
   * Handle client schema update notifications
   */
  async handleSchemaUpdate(message: SchemaUpdateMessage): Promise<void> {
    const { organizationId, schemaVersion, changes } = message
    
    console.log(`🔄 Server handling schema update for org: ${organizationId}`)
    
    // 1. Validate schema change
    const validation = await this.validateSchemaChange(organizationId, changes)
    if (!validation.valid) {
      throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`)
    }
    
    // 2. Update server-side schema cache
    await this.updateOrgSchemaCache(organizationId, schemaVersion)
    
    // 3. Update table subscriptions in ReplicationDO
    await this.updateReplicationSubscriptions(organizationId, changes)
    
    // 4. Broadcast schema change to all org clients
    await this.broadcastSchemaChange(organizationId, schemaVersion, changes)
    
    // 5. Update permission matrix for new entities
    await this.updatePermissionMatrix(organizationId, changes)
  }
  
  /**
   * Broadcast schema changes to all connected org clients
   */
  private async broadcastSchemaChange(
    organizationId: string, 
    schemaVersion: string, 
    changes: SchemaChangeAnalysis
  ): Promise<void> {
    const orgClients = this.getOrganizationClients(organizationId)
    
    const schemaChangeEvent = {
      type: 'schema_change',
      organizationId,
      schemaVersion,
      changes,
      timestamp: new Date().toISOString()
    }
    
    // Send to all clients in organization
    for (const clientId of orgClients) {
      await this.sendToClient(clientId, schemaChangeEvent)
    }
    
    console.log(`📡 Broadcasted schema change to ${orgClients.length} clients`)
  }
}
```

## **Phase 4: Client Schema Synchronization** 📡

### **4.1 Client Schema Update Handler**

**New File**: `apps/web/src/lib/client-schema-sync.ts`
```typescript
/**
 * Handles incoming schema updates from server
 */
export class ClientSchemaSync {
  /**
   * Handle incoming schema change from server
   */
  async handleIncomingSchemaChange(event: SchemaChangeEvent): Promise<void> {
    const { organizationId, schemaVersion, changes } = event
    
    console.log(`📡 Received schema change for org: ${organizationId}`)
    
    // 1. Check if we need to update our schema
    const currentVersion = await this.getCurrentSchemaVersion(organizationId)
    if (currentVersion === schemaVersion) {
      console.log(`ℹ️ Already on schema version ${schemaVersion}`)
      return
    }
    
    // 2. Apply schema change locally
    await this.applyRemoteSchemaChange(organizationId, changes)
    
    // 3. Update UI to reflect new schema
    await this.updateUIForSchemaChange(organizationId, changes)
    
    // 4. Refresh any affected components
    await this.refreshAffectedComponents(organizationId, changes)
  }
  
  /**
   * Apply remote schema change to local LiveStore
   */
  private async applyRemoteSchemaChange(
    organizationId: string, 
    changes: SchemaChangeAnalysis
  ): Promise<void> {
    const instance = liveStoreSchemaClient.getLiveStoreInstance(organizationId)
    if (!instance) return
    
    // Let the schema client handle the update
    await liveStoreSchemaClient.applyRemoteSchemaChange(organizationId, changes)
  }
  
  /**
   * Update UI components for schema changes
   */
  private async updateUIForSchemaChange(
    organizationId: string, 
    changes: SchemaChangeAnalysis
  ): Promise<void> {
    // Notify React components about schema changes
    window.dispatchEvent(new CustomEvent('schema:changed', {
      detail: { organizationId, changes }
    }))
    
    // Update form generators
    await this.updateFormGenerators(organizationId, changes)
    
    // Update data grid configurations
    await this.updateDataGrids(organizationId, changes)
  }
}
```

### **4.2 React Hook Integration**

**Enhanced**: `apps/web/src/lib/livestore-hooks.ts`
```typescript
/**
 * Schema-aware React hooks
 */
export function useDynamicSchema(organizationId: string | null) {
  const [schema, setSchema] = useState<OrgEntitySchema | null>(null)
  const [schemaVersion, setSchemaVersion] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  useEffect(() => {
    if (!organizationId) return
    
    // Subscribe to schema changes
    const unsubscribe = liveStoreSchemaClient.subscribeToSchemaChanges(
      organizationId,
      (newSchema, version) => {
        setSchema(newSchema)
        setSchemaVersion(version)
        setLastUpdated(new Date())
      }
    )
    
    return unsubscribe
  }, [organizationId])
  
  return {
    schema,
    schemaVersion,
    lastUpdated,
    isUpdating: schema === null
  }
}

/**
 * Hook that automatically updates when entity schema changes
 */
export function useEntityFields(organizationId: string | null, entityName: string) {
  const { schema } = useDynamicSchema(organizationId)
  const [fields, setFields] = useState<FieldDefinition[]>([])
  
  useEffect(() => {
    if (!schema || !entityName) return
    
    const entityDef = schema.entities[entityName]
    if (entityDef) {
      const fieldList = Object.entries(entityDef.syncableFields).map(([name, def]) => ({
        name,
        ...def
      }))
      setFields(fieldList)
    }
  }, [schema, entityName])
  
  return fields
}
```

## **Phase 5: Migration & Rollback System** ⚡

### **5.1 Safe Migration Framework**

**New File**: `apps/web/src/lib/safe-migration-framework.ts`
```typescript
/**
 * Safe schema migration with rollback capabilities
 */
export class SafeMigrationFramework {
  /**
   * Execute migration with automatic rollback on failure
   */
  async executeSafeMigration(
    organizationId: string,
    migrationPlan: MigrationPlan
  ): Promise<MigrationResult> {
    const migrationId = generateId()
    const startTime = new Date()
    
    // Create migration checkpoint
    const checkpoint = await this.createMigrationCheckpoint(organizationId)
    
    try {
      console.log(`🔄 Starting safe migration ${migrationId} for org: ${organizationId}`)
      
      // 1. Pre-migration validation
      await this.validateMigrationPreconditions(organizationId, migrationPlan)
      
      // 2. Execute migration steps
      const result = await this.executeMigrationSteps(organizationId, migrationPlan)
      
      // 3. Post-migration validation
      await this.validateMigrationResult(organizationId, result)
      
      // 4. Cleanup checkpoint (migration succeeded)
      await this.cleanupCheckpoint(checkpoint.id)
      
      return {
        success: true,
        migrationId,
        duration: Date.now() - startTime.getTime(),
        stepsExecuted: result.stepsExecuted,
        rowsMigrated: result.rowsMigrated
      }
      
    } catch (error) {
      console.error(`❌ Migration ${migrationId} failed:`, error)
      
      // Automatic rollback
      await this.rollbackMigration(organizationId, checkpoint)
      
      return {
        success: false,
        migrationId,
        duration: Date.now() - startTime.getTime(),
        error: error.message,
        rolledBack: true
      }
    }
  }
  
  /**
   * Create rollback checkpoint before migration
   */
  private async createMigrationCheckpoint(organizationId: string): Promise<MigrationCheckpoint> {
    const instance = liveStoreSchemaClient.getLiveStoreInstance(organizationId)
    if (!instance) throw new Error('LiveStore instance not available')
    
    // Create full database backup
    const backup = await this.createDatabaseBackup(instance)
    
    const checkpoint: MigrationCheckpoint = {
      id: generateId(),
      organizationId,
      createdAt: new Date(),
      databaseBackup: backup,
      schemaSnapshot: await this.getCurrentSchema(organizationId),
      tableCounts: await this.getTableCounts(instance)
    }
    
    await this.storeCheckpoint(checkpoint)
    return checkpoint
  }
  
  /**
   * Rollback migration using checkpoint
   */
  private async rollbackMigration(
    organizationId: string, 
    checkpoint: MigrationCheckpoint
  ): Promise<void> {
    console.log(`🔄 Rolling back migration for org: ${organizationId}`)
    
    const instance = liveStoreSchemaClient.getLiveStoreInstance(organizationId)
    if (!instance) return
    
    // 1. Restore database from backup
    await this.restoreDatabaseBackup(instance, checkpoint.databaseBackup)
    
    // 2. Restore schema
    await this.restoreSchema(organizationId, checkpoint.schemaSnapshot)
    
    // 3. Verify rollback
    const currentCounts = await this.getTableCounts(instance)
    const rollbackValid = this.validateRollback(checkpoint.tableCounts, currentCounts)
    
    if (rollbackValid) {
      console.log(`✅ Rollback successful for org: ${organizationId}`)
    } else {
      console.error(`❌ Rollback validation failed for org: ${organizationId}`)
      throw new Error('Rollback validation failed')
    }
  }
}
```

## **Phase 6: Performance & Monitoring** 📊

### **6.1 Schema Update Performance Monitoring**

**New File**: `apps/web/src/lib/schema-performance-monitor.ts`
```typescript
/**
 * Monitor performance of schema updates
 */
export class SchemaPerformanceMonitor {
  private metrics = new Map<string, SchemaMetrics>()
  
  /**
   * Track schema update performance
   */
  async trackSchemaUpdate(
    organizationId: string,
    operation: 'update' | 'migration' | 'rollback',
    startTime: number
  ): Promise<void> {
    const duration = Date.now() - startTime
    const metric: SchemaMetric = {
      organizationId,
      operation,
      duration,
      timestamp: new Date(),
      memoryUsage: this.getMemoryUsage(),
      clientCount: this.getConnectedClientCount(organizationId)
    }
    
    await this.recordMetric(metric)
    
    // Alert if performance is degraded
    if (duration > this.getPerformanceThreshold(operation)) {
      await this.alertSlowSchemaUpdate(metric)
    }
  }
  
  /**
   * Get schema update statistics
   */
  getSchemaUpdateStats(organizationId: string): SchemaStats {
    const orgMetrics = this.metrics.get(organizationId) || []
    
    return {
      totalUpdates: orgMetrics.length,
      averageDuration: this.calculateAverage(orgMetrics.map(m => m.duration)),
      slowestUpdate: Math.max(...orgMetrics.map(m => m.duration)),
      fastestUpdate: Math.min(...orgMetrics.map(m => m.duration)),
      lastUpdate: orgMetrics[orgMetrics.length - 1]?.timestamp,
      errorRate: this.calculateErrorRate(orgMetrics)
    }
  }
}
```

### **6.2 Real-time Schema Health Dashboard**

**New File**: `apps/web/src/components/admin/SchemaHealthDashboard.tsx`
```typescript
/**
 * Real-time schema health monitoring dashboard
 */
export function SchemaHealthDashboard() {
  const [schemaHealth, setSchemaHealth] = useState<SchemaHealthData>()
  const [activeUpdates, setActiveUpdates] = useState<SchemaUpdate[]>([])
  
  useEffect(() => {
    // Subscribe to schema health updates
    const unsubscribe = schemaPerformanceMonitor.subscribeToHealth((health) => {
      setSchemaHealth(health)
    })
    
    return unsubscribe
  }, [])
  
  return (
    <div className="schema-health-dashboard">
      <h2>Schema Health Monitoring</h2>
      
      {/* Real-time update status */}
      <div className="active-updates">
        <h3>Active Schema Updates</h3>
        {activeUpdates.map(update => (
          <div key={update.id} className="update-status">
            <span>Org: {update.organizationId}</span>
            <span>Type: {update.type}</span>
            <span>Progress: {update.progress}%</span>
            <span>Duration: {update.duration}ms</span>
          </div>
        ))}
      </div>
      
      {/* Performance metrics */}
      <div className="performance-metrics">
        <h3>Performance Metrics</h3>
        <div>Average Update Time: {schemaHealth?.averageUpdateTime}ms</div>
        <div>Success Rate: {schemaHealth?.successRate}%</div>
        <div>Active Organizations: {schemaHealth?.activeOrgs}</div>
      </div>
      
      {/* Schema version status */}
      <div className="schema-versions">
        <h3>Schema Versions by Organization</h3>
        {schemaHealth?.orgVersions.map(org => (
          <div key={org.id} className="org-version">
            <span>{org.name}</span>
            <span>v{org.schemaVersion}</span>
            <span className={`status ${org.status}`}>{org.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 📅 **IMPLEMENTATION TIMELINE**

### **Week 1: Foundation (Days 1-5)**
- [ ] **Day 1-2**: Schema change detection and version management
- [ ] **Day 3-4**: LiveStore hot-swapping capabilities  
- [ ] **Day 5**: Basic migration engine

### **Week 2: Sync Integration (Days 6-10)**
- [ ] **Day 6-7**: Dynamic sync subscription management
- [ ] **Day 8-9**: Server-side schema coordination
- [ ] **Day 10**: Client schema synchronization

### **Week 3: Migration System (Days 11-15)**
- [ ] **Day 11-12**: Safe migration framework
- [ ] **Day 13-14**: Rollback capabilities
- [ ] **Day 15**: Migration testing and validation

### **Week 4: Performance & Polish (Days 16-20)**
- [ ] **Day 16-17**: Performance monitoring
- [ ] **Day 18-19**: Health dashboard and debugging tools
- [ ] **Day 20**: Integration testing and optimization

---

## 🎯 **SUCCESS CRITERIA**

### **Dynamic Schema Updates**
✅ **Hot Schema Swapping**: LiveStore schemas update without service restart  
✅ **Real-time Propagation**: Schema changes reach all connected clients within 2 seconds  
✅ **Safe Migrations**: Data preserved during all schema modifications  
✅ **Automatic Rollback**: Failed updates automatically revert to previous state  

### **Sync System Integration**
✅ **Dynamic Subscriptions**: Sync services automatically adapt to schema changes  
✅ **Server Coordination**: Server-side sync handles new entities immediately  
✅ **Client Synchronization**: All clients receive and apply schema updates  
✅ **Permission Updates**: Access control adapts to new/modified entities  

### **Performance & Reliability**
✅ **Sub-second Updates**: Additive schema changes apply in under 1 second  
✅ **Zero Downtime**: Schema updates don't interrupt user workflows  
✅ **Data Integrity**: No data loss during any schema modification  
✅ **Monitoring**: Full visibility into schema update performance and health  

---

## ⚠️ **RISKS & MITIGATION**

### **High Risk: Data Loss During Migration**
**Mitigation**: 
- Automatic checkpoint creation before every migration
- Full database backup with instant rollback capability
- Validation at every step with automatic abort on failure

### **Medium Risk: Client Desynchronization**
**Mitigation**:
- Forced client refresh for breaking changes
- Version compatibility checks before applying updates
- Fallback to full re-sync if client can't apply update

### **Medium Risk: Performance Impact**
**Mitigation**:
- Staged rollout of schema changes (small orgs first)
- Background migration for large datasets
- Performance monitoring with automatic throttling

---

## 🚀 **IMMEDIATE NEXT ACTIONS**

### **Priority 1: Schema Change Detection (This Week)**
1. **Implement SchemaChangeDetector** - Monitor for DataForge entity changes
2. **Build SchemaVersionManager** - Version and track schema changes
3. **Create migration plan generator** - Analyze changes and create safe migration steps

### **Priority 2: LiveStore Integration (Next Week)**  
4. **Enhance LiveStoreSchemaClient** - Add hot-swapping capabilities
5. **Build SchemaMigrationEngine** - Execute safe database migrations
6. **Test with sample org** - Validate end-to-end schema updates

### **Priority 3: Sync Coordination (Week 3)**
7. **Update PureLiveStoreSync** - Handle dynamic schema changes
8. **Enhance SyncDO** - Server-side schema coordination
9. **Build ClientSchemaSync** - Client-side update handling

This comprehensive plan transforms your working LiveStore foundation into a fully dynamic, self-updating system that seamlessly handles schema evolution while maintaining data integrity and system performance! 🎉

---

## 🏗️ **SERVER-SIDE ARCHITECTURE ANALYSIS**

### **Existing Infrastructure Review (January 2025)**

The server-side schema generation and sync infrastructure is **already well-architected** and ready to support dynamic schema updates. Here's what's currently available:

#### **✅ Core Components Already Implemented**

**1. RuntimeSchemaGenerator** (`apps/server/src/dataforge/kysely-generator/runtime-schema-generator.ts`)
- Converts JSON entity definitions to TypeScript interfaces and SQL DDL at runtime
- Maps field types from JSON schema to TypeScript and SQL types  
- Creates both full database interfaces and sync-only filtered interfaces
- Supports base archetype patterns (projects, tasks, events, contacts)
- **Status**: Production-ready, no changes needed for dynamic schema integration

**2. OrgSchemaDO** (`apps/server/src/dataforge/durable-objects/OrgSchemaDO.ts`)  
- Persistent storage using Cloudflare Durable Objects with SQLite
- Universal archetype pattern support for entity creation
- Syncable schema filtering (removes server-only fields)
- HTTP API for schema operations (CRUD, archetype creation)
- Temporary schema cleanup for migration workflows
- **Status**: Fully functional, ready for dynamic schema integration

**3. SchemaSyncHandler** (`apps/server/src/sync/schema-sync-handler.ts`)
- Real-time schema update broadcasting through WebSocket connections
- Organization-based client registration and message routing  
- Schema update notifications with change analysis
- Migration progress tracking and error handling
- Client acknowledgment and error reporting
- **Status**: Complete WebSocket infrastructure, ready for client integration

**4. SchemaUpdateNotifier** (`apps/server/src/dataforge/entity-operations/schema-update-notifier.ts`)
- Integration layer that triggers schema sync when entities are modified
- Comprehensive change detection (entity/field create/update/delete)
- Field sanitization for client consumption
- Migration coordination and progress notifications
- Version generation and change type classification
- **Status**: Full notification system implemented

#### **🔄 Server-Side Integration Flow (Already Working)**

```
EntityManager Changes → SchemaUpdateNotifier → SchemaSyncHandler → WebSocket Broadcast
                                 ↓
                          OrgSchemaDO (Persistence)
                                 ↓  
                      RuntimeSchemaGenerator (Code Gen)
```

#### **🎯 Server Infrastructure Readiness Assessment**

| Component | Status | Dynamic Schema Ready | Notes |
|-----------|--------|---------------------|-------|
| **Schema Storage** | ✅ Complete | ✅ Yes | OrgSchemaDO handles all persistence needs |
| **Change Detection** | ✅ Complete | ✅ Yes | SchemaUpdateNotifier covers all change types |
| **Real-time Sync** | ✅ Complete | ✅ Yes | SchemaSyncHandler ready for WebSocket broadcast |
| **Code Generation** | ✅ Complete | ✅ Yes | RuntimeSchemaGenerator handles TS/SQL generation |
| **Migration Support** | ✅ Complete | ✅ Yes | Full migration coordination infrastructure |

#### **⚡ Implementation Focus Shift**

**MAJOR INSIGHT**: The server-side infrastructure is **already complete** and production-ready for dynamic schema updates. 

**Updated Implementation Priority**:
1. **Client-Side Integration** (Weeks 1-2) - Focus entirely on LiveStore schema hot-swapping
2. **Client-Server Protocol** (Week 3) - Integrate existing server WebSocket APIs with LiveStore client
3. **End-to-End Testing** (Week 4) - Validate full dynamic schema flow

**Server-Side Tasks Eliminated**:
- ❌ ~~Build server schema coordination~~ (Already exists)
- ❌ ~~Create migration coordination~~ (Already exists)  
- ❌ ~~Implement WebSocket broadcasting~~ (Already exists)
- ❌ ~~Build change detection~~ (Already exists)

**Client-Side Focus Areas**:
- ✅ LiveStore schema hot-swapping capabilities
- ✅ Client schema change handling and migration
- ✅ React hooks integration for dynamic schemas
- ✅ UI component updates for schema changes

This analysis shows that **80% of the dynamic schema infrastructure already exists on the server-side**, allowing the implementation to focus primarily on client-side LiveStore integration and testing! 🚀
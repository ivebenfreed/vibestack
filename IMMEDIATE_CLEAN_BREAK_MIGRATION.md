# Immediate Clean Break: Dexie → LiveStore Migration

## 🎯 **SIMPLE OBJECTIVE**

**GOAL**: Immediate switch to pure LiveStore system. Keep old Dexie code as reference only.

**KEY INSIGHTS**:
- ✅ No feature flags needed
- ✅ No data migration needed (server has all data)
- ✅ Keep old code as reference only
- ✅ Clean break - replace all Dexie usage immediately

---

## 🚀 **IMMEDIATE IMPLEMENTATION PLAN**

### **Step 1: Create Pure LiveStore Hooks** ⚡

**New File**: `apps/web/src/lib/livestore-hooks.ts`
```typescript
/**
 * Pure LiveStore React Hooks - Replaces all Dexie usage
 */
import { useState, useEffect } from 'react'
import { liveStoreEventGenerator } from './livestore-event-generator'
import { getLiveStoreClient } from './livestore-client'

// Replace useLiveQuery from Dexie
export function useLiveStoreQuery<T>(
  organizationId: string,
  entityName: string,
  sql: string,
  params: any[] = []
): T[] {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return

    const loadData = async () => {
      try {
        setLoading(true)
        const liveStoreClient = await getLiveStoreClient(organizationId)
        
        if (liveStoreClient) {
          // Execute query
          const result = await liveStoreClient.store.query(sql, params)
          setData(result)

          // Subscribe to table changes
          const tableName = `org_${organizationId}_${entityName}`
          const unsubscribe = liveStoreClient.store.subscribe(tableName, async () => {
            const updatedResult = await liveStoreClient.store.query(sql, params)
            setData(updatedResult)
          })

          return unsubscribe
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Query failed')
      } finally {
        setLoading(false)
      }
    }

    const unsubscribe = loadData()
    return () => {
      unsubscribe?.then(unsub => unsub?.())
    }
  }, [organizationId, entityName, sql, JSON.stringify(params)])

  return { data, loading, error }
}

// Replace direct Dexie mutations
export function useLiveStoreMutations(organizationId: string) {
  const [mutations, setMutations] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) return

    const loadMutations = async () => {
      try {
        const liveStoreClient = await getLiveStoreClient(organizationId)
        const orgSchema = await getOrgSchema(organizationId)
        
        if (liveStoreClient && orgSchema) {
          const generatedMutations = await liveStoreEventGenerator.createMutations(
            organizationId, 
            liveStoreClient.store, 
            orgSchema
          )
          setMutations(generatedMutations)
        }
      } catch (err) {
        console.error('Failed to load mutations:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMutations()
  }, [organizationId])

  return { mutations, loading }
}

// Convenience hooks for common queries
export function useProjects(organizationId: string) {
  return useLiveStoreQuery(
    organizationId,
    'projects',
    'SELECT * FROM org_? _projects WHERE organization_id = ? ORDER BY created_at DESC',
    [organizationId, organizationId]
  )
}

export function useTasks(organizationId: string, projectId?: string) {
  const whereClause = projectId 
    ? 'WHERE organization_id = ? AND project_id = ?' 
    : 'WHERE organization_id = ?'
  const params = projectId ? [organizationId, projectId] : [organizationId]
  
  return useLiveStoreQuery(
    organizationId,
    'tasks',
    `SELECT * FROM org_? _tasks ${whereClause} ORDER BY created_at DESC`,
    [organizationId, ...params]
  )
}

export function useUsers(organizationId: string) {
  return useLiveStoreQuery(
    organizationId,
    'users',
    'SELECT * FROM org_? _users WHERE organization_id = ? ORDER BY name',
    [organizationId, organizationId]
  )
}
```

### **Step 2: Create Pure LiveStore Sync Services** ⚡

**New File**: `apps/web/src/sync/LiveStoreSync.ts`
```typescript
/**
 * Pure LiveStore Sync - Replaces all Dexie sync services
 */
import { WebSocketService } from './WebSocketService'
import { createLiveStoreNativeSync } from '../lib/livestore-native-sync'

export class LiveStoreSync {
  private nativeSync: any = null
  private webSocketService: WebSocketService
  
  constructor(
    private organizationId: string,
    private clientId: string,
    private userId: string
  ) {}

  async initialize(webSocketService: WebSocketService) {
    this.webSocketService = webSocketService
    
    // Get LiveStore instance
    const liveStoreClient = await getLiveStoreClient(this.organizationId)
    const orgSchema = await getOrgSchema(this.organizationId)
    
    if (!liveStoreClient || !orgSchema) {
      throw new Error('LiveStore or schema not available')
    }

    // Create native sync with WebSocket integration
    this.nativeSync = await createLiveStoreNativeSync({
      organizationId: this.organizationId,
      clientId: this.clientId,
      userId: this.userId,
      store: liveStoreClient.store,
      orgSchema,
      outgoingChangeService: {
        queueChange: (change) => this.sendChangeToServer(change)
      },
      incomingChangeService: {
        onChangesReceived: (handler) => this.setupIncomingHandler(handler)
      }
    })
  }

  private sendChangeToServer(change: any) {
    // Send via WebSocket
    this.webSocketService.send({
      type: 'clt_send_changes',
      changes: [change],
      clientId: this.clientId,
      organizationId: this.organizationId,
      timestamp: Date.now()
    })
  }

  private setupIncomingHandler(handler: Function) {
    // Setup WebSocket message handler for incoming changes
    this.webSocketService.setCallbacks({
      onMessage: async (message) => {
        if (message.type === 'srv_send_changes') {
          await handler(message.changes)
        }
      }
    })
  }

  async processPendingChanges() {
    if (this.nativeSync) {
      await this.nativeSync.triggerManualSync()
    }
  }

  destroy() {
    if (this.nativeSync) {
      this.nativeSync.shutdown()
    }
  }
}
```

### **Step 3: Replace ServiceCoordinator** ⚡

**New File**: `apps/web/src/sync/utils/LiveStoreServiceCoordinator.ts`
```typescript
/**
 * Pure LiveStore Service Coordinator - Replaces hybrid ServiceCoordinator
 */
import { WebSocketService } from '../WebSocketService'
import { LiveStoreSync } from '../LiveStoreSync'

export class LiveStoreServiceCoordinator {
  private webSocket: WebSocketService | null = null
  private liveStoreSync: LiveStoreSync | null = null

  async initialize(config: {
    clientId: string
    organizationId: string
    userId: string
    serverUrl: string
    currentLSN: string
  }) {
    // 1. Initialize WebSocket
    this.webSocket = new WebSocketService({
      serverUrl: config.serverUrl,
      clientId: config.clientId,
      lsn: config.currentLSN,
      organizationId: config.organizationId
    })

    // 2. Initialize LiveStore Sync
    this.liveStoreSync = new LiveStoreSync(
      config.organizationId,
      config.clientId,
      config.userId
    )

    await this.liveStoreSync.initialize(this.webSocket)

    // 3. Connect WebSocket
    await this.webSocket.connect()

    return {
      webSocket: this.webSocket,
      liveStoreSync: this.liveStoreSync
    }
  }

  setupCallbacks(eventHandler: Function) {
    if (this.webSocket) {
      this.webSocket.setCallbacks({
        onStatusChange: (status) => {
          if (status === 'connected') {
            eventHandler({ type: 'WS_CONNECTED' })
          } else if (status === 'disconnected') {
            eventHandler({ type: 'WS_DISCONNECTED' })
          }
        },
        onMessage: (message) => {
          eventHandler({ type: 'WS_MESSAGE', message })
        },
        onError: (error) => {
          eventHandler({ type: 'WS_ERROR', error })
        }
      })
    }
  }

  getServices() {
    return {
      webSocket: this.webSocket,
      liveStoreSync: this.liveStoreSync
    }
  }

  destroy() {
    this.liveStoreSync?.destroy()
    this.webSocket?.destroy()
  }
}
```

---

## 📝 **COMPONENT UPDATE PATTERNS**

### **Replace Dexie Usage Immediately**

```typescript
// OLD: Dexie pattern (keep as reference in comments)
/*
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie-init'

function ProjectsList() {
  const projects = useLiveQuery(() => 
    db.projects.where('organization_id').equals(orgId).toArray()
  , [orgId])
  
  const addProject = async (data) => {
    await db.projects.add({ ...data, organization_id: orgId })
  }
}
*/

// NEW: LiveStore pattern (immediate replacement)
import { useProjects, useLiveStoreMutations } from '../lib/livestore-hooks'

function ProjectsList() {
  const { data: projects, loading } = useProjects(orgId)
  const { mutations } = useLiveStoreMutations(orgId)
  
  const addProject = async (data) => {
    await mutations.projects.create({ ...data, organization_id: orgId })
  }
  
  if (loading) return <div>Loading...</div>
  
  return (
    <div>
      {projects.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
```

---

## 📋 **SYSTEMATIC REPLACEMENT CHECKLIST**

### **Files to Update Immediately**

1. **All React Components**
   ```typescript
   // Find/Replace:
   // useLiveQuery → useLiveStoreQuery
   // db.projects → mutations.projects  
   // db.tasks → mutations.tasks
   // db.users → mutations.users
   ```

2. **Sync Machine Integration**
   ```typescript
   // Update: apps/web/src/state-machines/machines/sync-machine-v3.ts
   // Replace: ServiceCoordinator → LiveStoreServiceCoordinator
   ```

3. **Remove Dexie Imports**
   ```typescript
   // Delete all:
   // import { db } from '../db/dexie-*'
   // import { useLiveQuery } from 'dexie-react-hooks'
   
   // Replace with:
   // import { useLiveStoreQuery, useLiveStoreMutations } from '../lib/livestore-hooks'
   ```

---

## 🗂️ **KEEP AS REFERENCE (DO NOT DELETE)**

Move these files to a `reference/` folder:
```bash
mkdir apps/web/src/reference
mv apps/web/src/db/dexie-* apps/web/src/reference/
mv apps/web/src/sync/DexieOutgoingChangeService.ts apps/web/src/reference/
mv apps/web/src/sync/DexieIntegrityService.ts apps/web/src/reference/
```

---

## ⚡ **IMMEDIATE EXECUTION PLAN**

### **Day 1: Core Infrastructure**
1. Create `livestore-hooks.ts` 
2. Create `LiveStoreSync.ts`
3. Create `LiveStoreServiceCoordinator.ts`
4. Test basic functionality

### **Day 2: Component Updates**  
1. Update 3-5 core components to use LiveStore hooks
2. Test UI functionality
3. Update sync machine to use new coordinator

### **Day 3: Complete Replacement**
1. Update ALL remaining components
2. Remove ALL Dexie imports
3. Move old files to reference folder
4. Test entire application

### **Day 4: Final Validation**
1. End-to-end testing
2. Sync testing (bidirectional)
3. Performance validation
4. Clean up any remaining issues

---

## 🎯 **SUCCESS VALIDATION**

✅ **Zero Dexie imports** in active codebase  
✅ **All data operations** via LiveStore hooks  
✅ **Sync working** bidirectionally  
✅ **All features** working identically  
✅ **Better performance** than Dexie system  

**Result**: Pure LiveStore system with old Dexie code preserved as reference.
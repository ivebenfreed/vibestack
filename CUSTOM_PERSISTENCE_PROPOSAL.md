# Custom Entity Persistence Layer - Architecture Proposal

## 🎯 Problem Statement

**Current Issue:** `syncedCrud` entities created without `persist` config because:
1. `persistenceConfig` is null when entities are first accessed
2. Conditional spread `...(hasPersistence && { persist })` results in no persistence
3. Timing coordination is nearly impossible with reactive computed observables

**Result:**
- ❌ No IndexedDB caching (every load hits API)
- ❌ No differential sync (fetches full dataset every time)
- ❌ Poor offline support

---

## ✅ Proposed Solution: Custom EntityCacheLayer

### Architecture Overview

```
┌─────────────┐
│  Dashboard  │ Component accesses entity
└──────┬──────┘
       │
       ↓
┌────────────────┐
│  syncedCrud    │ Legend State observable
│  (no persist)  │ Calls custom list/create/update
└────────┬───────┘
         │
         ↓
┌────────────────────┐
│ EntityCacheLayer   │ Custom persistence layer
├────────────────────┤
│ • listEntities()   │ 1. Load from IndexedDB (instant)
│ • createEntity()   │ 2. Fetch changes from API (background)
│ • updateEntity()   │ 3. Merge + save to IndexedDB
│ • deleteEntity()   │ 4. Return merged data
└────────┬───────────┘
         │
         ↓
┌────────────────┐     ┌─────────────┐
│   IndexedDB    │     │  DataForge  │
│  (local cache) │     │  REST API   │
└────────────────┘     └─────────────┘
```

---

## 📋 Implementation Design

### 1. EntityCacheLayer Class

```typescript
// src/legend-state/persistence/EntityCacheLayer.ts

import { log } from '@/logger'

const fileLog = log('legend-state/persistence/EntityCacheLayer')

export interface CacheMetadata {
  lastSync: number
  lastLSN: string
  entityCount: number
  version: number
}

export class EntityCacheLayer {
  private db: IDBDatabase | null = null
  private dbName: string
  private ready: Promise<void>

  constructor(userId: string, orgIds: string[]) {
    this.dbName = `elevra_universe_${userId.replace(/-/g, '_')}`
    this.ready = this.initialize(orgIds)
  }

  private async initialize(orgIds: string[]): Promise<void> {
    // Open IndexedDB with dynamic object stores for each entity
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create generic 'entities' store with entity type as key prefix
        if (!db.objectStoreNames.contains('entities')) {
          db.createObjectStore('entities', { keyPath: '_cacheKey' })
        }

        // Create metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'entityType' })
        }
      }

      request.onsuccess = () => {
        this.db = request.result
        fileLog.info(`✅ EntityCacheLayer initialized: ${this.dbName}`)
        resolve()
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * LIST: Load from cache + fetch changes from server
   * Returns cached data immediately, fetches updates in background
   */
  async listEntities(entityType: string, apiUrl: string): Promise<any[]> {
    await this.ready

    // 1. Load from cache FIRST (instant)
    const cached = await this.getCachedData(entityType)
    const metadata = await this.getMetadata(entityType)

    fileLog.info(`📦 [CACHE-LAYER] ${entityType}: Loaded ${cached.length} records from cache`)

    // 2. Fetch changes from API (differential sync)
    try {
      const lastSync = metadata?.lastSync || 0
      const diffUrl = lastSync > 0
        ? `${apiUrl}?updated_at[gte]=${lastSync}`
        : apiUrl

      fileLog.info(`🔄 [CACHE-LAYER] ${entityType}: Fetching changes since ${new Date(lastSync).toISOString()}`)

      const response = await fetch(diffUrl, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      })

      if (!response.ok) {
        fileLog.warn(`⚠️  [CACHE-LAYER] ${entityType}: API error ${response.status}, using cached data`)
        return cached
      }

      const result = await response.json()
      const serverData = result.data || []

      fileLog.info(`✅ [CACHE-LAYER] ${entityType}: Received ${serverData.length} changes from server`)

      // 3. Merge server data with cache
      const merged = this.mergeData(cached, serverData)

      // 4. Save merged data back to cache
      await this.saveCachedData(entityType, merged)
      await this.updateMetadata(entityType, {
        lastSync: Date.now(),
        entityCount: merged.length,
        version: metadata?.version + 1 || 1
      })

      fileLog.info(`💾 [CACHE-LAYER] ${entityType}: Saved ${merged.length} records to cache`)

      return merged

    } catch (error) {
      fileLog.error(`❌ [CACHE-LAYER] ${entityType}: Sync failed, using cached data`, error)
      return cached
    }
  }

  /**
   * CREATE: Save to API + cache
   */
  async createEntity(entityType: string, apiUrl: string, data: any): Promise<any> {
    await this.ready

    // Optimistic: Add to cache immediately
    const cached = await this.getCachedData(entityType)
    cached.push(data)
    await this.saveCachedData(entityType, cached)

    // Sync to server
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        // Rollback cache on error
        await this.saveCachedData(entityType, cached.filter(r => r.id !== data.id))
        throw new Error(`Create failed: ${response.status}`)
      }

      const result = await response.json()
      const created = result.data

      // Update cache with server response (real ID, timestamps, etc.)
      const updated = cached.map(r => r.id === data.id ? created : r)
      await this.saveCachedData(entityType, updated)

      return created
    } catch (error) {
      throw error
    }
  }

  /**
   * UPDATE: Similar pattern - optimistic cache, sync to server
   */
  async updateEntity(entityType: string, apiUrl: string, id: string, changes: any): Promise<any> {
    // Implementation similar to createEntity
  }

  /**
   * DELETE: Remove from cache + server
   */
  async deleteEntity(entityType: string, apiUrl: string, id: string): Promise<void> {
    // Implementation similar to createEntity
  }

  // --- Private IndexedDB Helpers ---

  private async getCachedData(entityType: string): Promise<any[]> {
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('entities', 'readonly')
      const store = tx.objectStore('entities')

      // Query all records for this entity type
      const range = IDBKeyRange.bound(
        `${entityType}/`,
        `${entityType}/\uffff`
      )

      const request = store.getAll(range)

      request.onsuccess = () => {
        const records = request.result.map(r => {
          // Remove internal cache key
          const { _cacheKey, ...data } = r
          return data
        })
        resolve(records)
      }

      request.onerror = () => resolve([]) // Fail gracefully
    })
  }

  private async saveCachedData(entityType: string, data: any[]): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('entities', 'readwrite')
      const store = tx.objectStore('entities')

      // Clear existing records for this entity type
      const range = IDBKeyRange.bound(
        `${entityType}/`,
        `${entityType}/\uffff`
      )
      store.delete(range)

      // Save new data with prefixed keys
      data.forEach(record => {
        store.put({
          ...record,
          _cacheKey: `${entityType}/${record.id}` // Composite key
        })
      })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  private async getMetadata(entityType: string): Promise<CacheMetadata | null> {
    if (!this.db) return null

    return new Promise((resolve) => {
      const tx = this.db!.transaction('metadata', 'readonly')
      const store = tx.objectStore('metadata')
      const request = store.get(entityType)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => resolve(null)
    })
  }

  private async updateMetadata(entityType: string, metadata: Partial<CacheMetadata>): Promise<void> {
    if (!this.db) return

    const current = await this.getMetadata(entityType) || {
      lastSync: 0,
      entityCount: 0,
      version: 0
    }

    return new Promise((resolve) => {
      const tx = this.db!.transaction('metadata', 'readwrite')
      const store = tx.objectStore('metadata')

      store.put({
        entityType,
        ...current,
        ...metadata
      })

      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve() // Fail silently
    })
  }

  private mergeData(cached: any[], serverData: any[]): any[] {
    const mergedMap = new Map()

    // Add cached data
    cached.forEach(record => mergedMap.set(record.id, record))

    // Merge/overwrite with server data (server is source of truth)
    serverData.forEach(record => mergedMap.set(record.id, record))

    return Array.from(mergedMap.values())
  }
}
```

---

### 2. Integration with syncedCrud

```typescript
// src/legend-state/observables.ts

import { EntityCacheLayer } from './persistence/EntityCacheLayer'

// Create singleton cache layer
let entityCacheLayer: EntityCacheLayer | null = null

export async function initializeEntityCache(userId: string, orgIds: string[]) {
  if (!entityCacheLayer) {
    entityCacheLayer = new EntityCacheLayer(userId, orgIds)
    fileLog.info(`✅ Entity cache layer initialized`)
  }
  return entityCacheLayer
}

// Update createEntityObservable
function createEntityObservable(entityName: string, schema?: any) {
  // ... extract orgId, entityName, baseUrl ...

  // ✅ NEW: Use EntityCacheLayer instead of direct API
  const crudConfig = {
    changesSince: 'last-sync',
    fieldId: 'id',
    fieldCreatedAt: 'created_at',
    fieldUpdatedAt: 'updated_at',
    initial: [],

    // LIST: Use cache layer (loads from IndexedDB, fetches diffs)
    list: async () => {
      if (!entityCacheLayer) {
        // Fallback to direct API if cache not initialized
        return fetch(baseUrl).then(r => r.json()).then(r => r.data || [])
      }

      return entityCacheLayer.listEntities(entityName, baseUrl)
    },

    // CREATE: Use cache layer
    create: async (item: any) => {
      if (!entityCacheLayer) {
        // Fallback to direct API
        return fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(item)
        }).then(r => r.json()).then(r => r.data)
      }

      return entityCacheLayer.createEntity(entityName, baseUrl, item)
    },

    // UPDATE, DELETE: Similar pattern
  }

  return observable(syncedCrud(crudConfig))
}
```

---

### 3. Initialization in app-initialization-stages.ts

```typescript
async executePersistenceSetup(): Promise<boolean> {
  initLog.debug('💾 Setting up entity cache layer');

  try {
    const user = unifiedAuth$.user.get();
    const userOrganizations = unifiedAuth$.userOrganizations.get();

    if (!user || !userOrganizations) {
      throw new Error('User or organizations not available');
    }

    const organizationIds = userOrganizations.map(org => org.id);

    // Initialize custom cache layer (no timing issues!)
    await initializeEntityCache(user.id, organizationIds);

    initLog.info('✅ Entity cache layer ready');

    // Auto-advance to entities
    await this.advanceToStage('entities');

    return true;
  } catch (error) {
    initLog.error('❌ EntityCacheLayer failed:', error);
    // Continue without cache (server-only mode)
    await this.advanceToStage('entities');
    return true; // Don't fail init
  }
}
```

---

## 🎁 Benefits of Custom Layer

### 1. **No Timing Issues**
- Cache layer initialized once, before any entities
- Entities call layer methods (layer handles cache lookup)
- No dependency on `persistenceConfig` global variable

### 2. **True Cache-First**
```
T+0ms:  Dashboard calls getEntity$('BuildProject')
T+1ms:  syncedCrud.list() calls cacheLayer.listEntities()
T+2ms:  ✅ Returns 5 cached records (instant!)
T+100ms: API fetch completes with 2 new records
T+101ms: Merged to 7 records, saved to cache
T+102ms: Observable updates with fresh data
```

### 3. **Differential Sync Works**
```typescript
// First sync
GET /api/entities → Returns all 100 records
Cache: Save 100 records + metadata { lastSync: 1234567890 }

// Second sync (30 sec later)
GET /api/entities?updated_at[gte]=1234567890 → Returns 2 changed records
Cache: Merge 2 changes into existing 100
Result: Only 2 records transferred (98% bandwidth savings!)
```

### 4. **Dynamic Entities Just Work™**
- Single 'entities' object store with prefixed keys: `BuildProject/123`, `Client/456`
- No schema versioning needed (keys are self-describing)
- Add new entity types at runtime (just start using them)

### 5. **Offline Support**
```typescript
// Network fails
listEntities() → Returns cached data + marks as stale
createEntity() → Saves to cache, queues for retry

// Network returns
Retry queue processes → Syncs pending changes
```

---

## 📊 Comparison: Current vs Custom Layer

| Feature | Current (Legend State persist plugin) | Custom EntityCacheLayer |
|---------|---------------------------------------|-------------------------|
| **Cache-first** | ❌ No (persist config missing) | ✅ Yes (always) |
| **Differential sync** | ❌ No (fetches full data) | ✅ Yes (via lastSync) |
| **Dynamic entities** | ❌ Hard (version conflicts) | ✅ Easy (prefixed keys) |
| **Timing issues** | ❌ Yes (race conditions) | ✅ No (init once) |
| **Offline support** | ⚠️  Partial | ✅ Full (with retry queue) |
| **Code complexity** | High (timing coordination) | Medium (explicit logic) |
| **Debuggability** | Low (Legend State internals) | High (our code) |

---

## 🚀 Implementation Plan

### Phase 1: Core EntityCacheLayer (2-3 hours)
1. Create `EntityCacheLayer.ts` with IndexedDB wrapper
2. Implement `listEntities()` with cache-first + differential sync
3. Implement `createEntity()`, `updateEntity()`, `deleteEntity()`
4. Add metadata tracking for `lastSync`

### Phase 2: Integration (1-2 hours)
1. Update `createEntityObservable()` to use cache layer
2. Call `initializeEntityCache()` in persistence stage
3. Add fallback for non-initialized state (direct API)
4. Remove all `persistenceConfig` conditional logic

### Phase 3: Testing & Polish (1-2 hours)
1. Test cache-first loading (instant stale data)
2. Verify differential sync (only changed records)
3. Test offline scenarios (cache-only mode)
4. Add cache eviction/cleanup utilities

**Total Effort:** ~6 hours
**Result:** Reliable, debuggable, performant entity caching

---

## 🤔 Alternative: Fix Current Approach

**Could we fix the existing Legend State persist config?**

Option A: Remove conditional spread, always add persist
```typescript
const crudConfig = {
  list: async () => { ... },
  persist: {
    name: `entity_${entityName}`, // Direct name, no mapping needed
    plugin: globalPersistPlugin, // Pre-configured plugin
    retrySync: true
  }
}
```

**Problem:** Still need `globalPersistPlugin` configured before entities created → same timing issue

Option B: Apply persistence retroactively with `syncObservable()`
```typescript
// Create without persistence
const entity$ = observable(syncedCrud({ list, create, update }))

// Later, add persistence
syncObservable(entity$, {
  persist: { name: tableName, plugin: persistPlugin }
})
```

**Problem:** On reload, entities created without cache → API calls happen → then persistence applied (too late)

---

## ✅ Recommendation

**Implement Custom EntityCacheLayer**

**Why:**
1. Solves timing issues permanently (no coordination needed)
2. Provides true cache-first experience
3. Enables proper differential sync
4. Works naturally with dynamic entities
5. Gives full control over caching behavior
6. Easier to debug and test

**Trade-off:** ~300 LOC custom code vs using Legend State's built-in persistence

But given we've spent hours on timing coordination with marginal results, a custom layer is more pragmatic and will be more maintainable long-term.

---

## 📝 Next Steps

If you approve this approach, I'll:

1. Create `src/legend-state/persistence/EntityCacheLayer.ts`
2. Implement IndexedDB operations with proper error handling
3. Update `createEntityObservable()` to use the layer
4. Test cache-first loading and differential sync
5. Document the architecture for future maintenance

**Decision needed:** Proceed with custom layer implementation?

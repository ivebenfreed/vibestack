# Dexie Integration Plan - Schema-Driven Dynamic Entity Persistence

## 🎯 Architecture Overview

**Your Proposed Flow:**

```
┌──────────────────┐
│ Schema Observable│ (Legend State synced + persisted)
│  (source of truth│  Loads entity schemas from API + IndexedDB cache
│   for schemas)   │
└────────┬─────────┘
         │ Triggers on schema change
         ↓
┌──────────────────┐
│ Dexie Schema Mgr │ Watches schema observable
│                  │ Dynamically upgrades Dexie schema
│                  │ Creates tables for new entities
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│   Dexie DB       │ entities: '&id, [orgId+archetype], updatedAt'
│  (cache layer)   │ Single flexible schema, entity-agnostic
└────────┬─────────┘
         │
         ↓
┌──────────────────────────────────────────────────────┐
│              Legend State Entity Observables         │
├──────────────────────────────────────────────────────┤
│  READS:  syncedCrud.list() → Dexie query (instant)  │
│  WRITES: syncedCrud.create/update/delete → API      │
└────────┬─────────────────────────────────────────────┘
         │                            ↑
         │ Sync event from server     │
         └────────────────────────────┘
         Refetch → Update Dexie → Observable updates
```

---

## ✅ Why This Architecture Works

### 1. **No Timing Issues**
- Dexie initialized once at startup (no entity-count dependency)
- Single flexible schema works for all entities
- Schema observable can update Dexie schema live (optional enhancement)

### 2. **Cache-First Reads**
```typescript
syncedCrud.list() → {
  const cached = await dexie.entities
    .where('[orgId+archetype]')
    .equals([orgId, 'BuildProject'])
    .toArray()

  return cached  // ✅ Instant return from IndexedDB
}
```

### 3. **Writes Still Use Proven Path**
```typescript
syncedCrud.create() → {
  // POST to API (current working code)
  const response = await fetch('/api/dataforge/...')

  // ✅ On success, update Dexie cache
  await dexie.entities.put(response.data)

  return response.data
}
```

### 4. **Sync Events Update Cache**
```typescript
// Server notification arrives
syncNotifications$.on('BuildProject', async () => {
  // Refetch from API
  const fresh = await fetch('/api/dataforge/.../BuildProject')

  // Update Dexie
  await dexie.entities.bulkPut(fresh.data)

  // Legend State observable auto-updates (reactive)
})
```

---

## 📋 Implementation Plan

### Phase 1: Dexie Database Setup

**File:** `src/legend-state/persistence/DexieEntityDB.ts`

```typescript
import Dexie, { Table } from 'dexie';
import { log } from '@/logger';

const fileLog = log('legend-state/persistence/DexieEntityDB');

export interface CachedEntity {
  id: string;
  orgId: string;
  archetype: string;
  entityType: string;  // e.g., "BuildProject", "Client"
  data: Record<string, any>;  // The actual entity data
  updatedAt: number;
  cachedAt: number;
}

export interface SyncMetadata {
  key: string;  // e.g., "01920000-1000_BuildProject"
  lastSync: number;
  lastLSN: string;
  recordCount: number;
}

export class DexieEntityDB extends Dexie {
  entities!: Table<CachedEntity, string>;
  syncMetadata!: Table<SyncMetadata, string>;

  constructor(userId: string) {
    super(`elevra_universe_${userId.replace(/-/g, '_')}`);

    // ✅ Single version, simple schema (entity-agnostic)
    this.version(1).stores({
      // Composite index for fast org+type queries
      entities: '&id, [orgId+entityType], entityType, updatedAt',

      // Sync state tracking
      syncMetadata: '&key'
    });

    fileLog.info(`✅ Dexie database initialized: ${this.name}`);
  }

  /**
   * Get cached entities for a specific type
   */
  async getCachedEntities(orgId: string, entityType: string): Promise<any[]> {
    const cached = await this.entities
      .where('[orgId+entityType]')
      .equals([orgId, entityType])
      .toArray();

    return cached.map(c => c.data);
  }

  /**
   * Update cache with fresh data from server
   */
  async updateCache(orgId: string, entityType: string, entities: any[]): Promise<void> {
    const cached: CachedEntity[] = entities.map(entity => ({
      id: entity.id,
      orgId,
      archetype: entity.archetype || 'record',
      entityType,
      data: entity,
      updatedAt: new Date(entity.updated_at || Date.now()).getTime(),
      cachedAt: Date.now()
    }));

    await this.entities.bulkPut(cached);

    fileLog.info(`💾 Updated cache: ${entityType} (${entities.length} records)`);
  }

  /**
   * Get sync metadata for differential sync
   */
  async getSyncMetadata(orgId: string, entityType: string): Promise<SyncMetadata | null> {
    const key = `${orgId}_${entityType}`;
    return await this.syncMetadata.get(key) || null;
  }

  /**
   * Update sync metadata after successful sync
   */
  async updateSyncMetadata(
    orgId: string,
    entityType: string,
    metadata: Partial<SyncMetadata>
  ): Promise<void> {
    const key = `${orgId}_${entityType}`;
    const existing = await this.getSyncMetadata(orgId, entityType);

    await this.syncMetadata.put({
      key,
      lastSync: existing?.lastSync || 0,
      lastLSN: existing?.lastLSN || '0/0',
      recordCount: existing?.recordCount || 0,
      ...metadata
    });
  }

  /**
   * Clear all cache for an organization (logout, org switch)
   */
  async clearOrganization(orgId: string): Promise<void> {
    await this.transaction('rw', [this.entities, this.syncMetadata], async () => {
      // Delete all entities for this org
      await this.entities.where('orgId').equals(orgId).delete();

      // Delete sync metadata for this org
      const metadataKeys = await this.syncMetadata
        .filter(m => m.key.startsWith(orgId))
        .primaryKeys();
      await this.syncMetadata.bulkDelete(metadataKeys);
    });

    fileLog.info(`🗑️  Cleared cache for org: ${orgId}`);
  }
}

// Singleton instance
let dexieDB: DexieEntityDB | null = null;

export function getDexieDB(userId: string): DexieEntityDB {
  if (!dexieDB) {
    dexieDB = new DexieEntityDB(userId);
  }
  return dexieDB;
}

export function resetDexieDB(): void {
  if (dexieDB) {
    dexieDB.close();
    dexieDB = null;
  }
}
```

---

### Phase 2: Update syncedCrud to Use Dexie

**File:** `src/legend-state/observables.ts` (modify `createEntityObservable`)

```typescript
function createEntityObservable(entityName: string, schema?: any) {
  // ... existing org/entity extraction ...

  const crudConfig = {
    changesSince: 'last-sync',
    fieldId: 'id',
    fieldCreatedAt: 'created_at',
    fieldUpdatedAt: 'updated_at',
    fieldDeleted: 'deleted',
    initial: [],

    // ✅ LIST: Read from Dexie cache first
    list: async () => {
      try {
        // Get user ID for Dexie instance
        const userId = universeUserId$.peek();
        if (!userId) {
          fileLog.warn(`No userId available, falling back to API`);
          return fetchFromAPI(baseUrl);
        }

        // Get Dexie DB instance
        const dexie = getDexieDB(userId);

        // 1. Load from Dexie cache FIRST (instant!)
        const cached = await dexie.getCachedEntities(actualOrgId, actualEntityName);

        fileLog.info(`📦 [DEXIE-CACHE] ${entityName}: Loaded ${cached.length} records from cache`);

        // 2. Get sync metadata for differential sync
        const metadata = await dexie.getSyncMetadata(actualOrgId, actualEntityName);
        const lastSync = metadata?.lastSync || 0;

        // 3. Fetch only changes from server (differential sync)
        const diffUrl = lastSync > 0
          ? `${baseUrl}?updated_at[gte]=${lastSync}`
          : baseUrl;

        fileLog.info(`🔄 [DEXIE-SYNC] ${entityName}: Fetching changes since ${new Date(lastSync).toISOString()}`);

        const response = await fetch(diffUrl, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          fileLog.warn(`⚠️  [DEXIE-SYNC] ${entityName}: API error, using cached data`);
          return cached;  // Return cached data on error
        }

        const result = await response.json();
        const serverData = result.data || [];

        fileLog.info(`✅ [DEXIE-SYNC] ${entityName}: Received ${serverData.length} changes`);

        // 4. Merge server changes with cache
        const merged = mergeEntityData(cached, serverData);

        // 5. Update Dexie cache
        await dexie.updateCache(actualOrgId, actualEntityName, merged);
        await dexie.updateSyncMetadata(actualOrgId, actualEntityName, {
          lastSync: Date.now(),
          recordCount: merged.length
        });

        fileLog.info(`💾 [DEXIE-SAVE] ${entityName}: Saved ${merged.length} records to cache`);

        return merged;

      } catch (error) {
        fileLog.error(`❌ [DEXIE-ERROR] ${entityName}: Falling back to direct API`, error);
        return fetchFromAPI(baseUrl);
      }
    },

    // ✅ CREATE: API write + Dexie cache update
    create: async (item: any) => {
      // POST to API (existing code)
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item)
      });

      if (!response.ok) {
        throw new Error(`Create failed: ${response.status}`);
      }

      const result = await response.json();
      const created = result.data;

      // ✅ Update Dexie cache
      const userId = universeUserId$.peek();
      if (userId) {
        const dexie = getDexieDB(userId);
        await dexie.updateCache(actualOrgId, actualEntityName, [created]);
      }

      return created;
    },

    // ✅ UPDATE: Similar pattern
    update: async (item: any) => {
      const response = await fetch(`${baseUrl}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item)
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.status}`);
      }

      const result = await response.json();
      const updated = result.data;

      // ✅ Update Dexie cache
      const userId = universeUserId$.peek();
      if (userId) {
        const dexie = getDexieDB(userId);
        const currentCache = await dexie.getCachedEntities(actualOrgId, actualEntityName);
        const updatedCache = currentCache.map(e => e.id === updated.id ? updated : e);
        await dexie.updateCache(actualOrgId, actualEntityName, updatedCache);
      }

      return updated;
    },

    // ✅ DELETE: Remove from API + cache
    delete: async (item: any) => {
      const response = await fetch(`${baseUrl}/${item.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Delete failed: ${response.status}`);
      }

      // ✅ Remove from Dexie cache
      const userId = universeUserId$.peek();
      if (userId) {
        const dexie = getDexieDB(userId);
        await dexie.entities.delete(item.id);
      }

      return undefined;
    },

    // Retry config (same as before)
    retry: {
      infinite: true,
      delay: 1000,
      backoff: 'exponential',
      maxDelay: 30000
    },

    generateId: () => `temp-${crypto.randomUUID()}`
  };

  return observable(syncedCrud(crudConfig));
}

// Helper: Merge server data with cached data
function mergeEntityData(cached: any[], serverData: any[]): any[] {
  const map = new Map(cached.map(e => [e.id, e]));

  // Server data overwrites cache (server is source of truth)
  serverData.forEach(e => map.set(e.id, e));

  return Array.from(map.values());
}

// Helper: Fallback to direct API
async function fetchFromAPI(url: string): Promise<any[]> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) return [];

  const result = await response.json();
  return result.data || [];
}
```

---

### Phase 3: Schema Observable → Dexie Bridge (Optional Enhancement)

**File:** `src/legend-state/persistence/DexieSchemaManager.ts`

```typescript
import { when } from '@legendapp/state';
import { universeSchema$ } from '../observables';
import { getDexieDB } from './DexieEntityDB';
import { log } from '@/logger';

const fileLog = log('legend-state/persistence/DexieSchemaManager');

/**
 * Watches schema observable and updates Dexie schema dynamically
 * NOTE: This is OPTIONAL - the simple entity-agnostic schema works fine without this
 */
export class DexieSchemaManager {
  private currentVersion = 1;
  private currentEntities: Set<string> = new Set();

  async initialize(userId: string) {
    fileLog.info(`🔧 Dexie Schema Manager: Watching for schema changes`);

    // Watch for schema changes
    when(() => {
      const schema = universeSchema$.get();
      return schema?.entities && Object.keys(schema.entities).length > 0;
    }, async () => {
      const schema = universeSchema$.peek();
      if (!schema?.entities) return;

      const entityTypes = Object.keys(schema.entities);
      const newEntities = entityTypes.filter(e => !this.currentEntities.has(e));

      if (newEntities.length > 0) {
        fileLog.info(`📝 New entities detected: ${newEntities.join(', ')}`);

        // Update Dexie schema (requires recreating DB)
        // NOTE: This is complex and may not be worth it
        // The simple schema works fine without per-entity tables

        newEntities.forEach(e => this.currentEntities.add(e));
      }
    });
  }
}
```

**Recommendation:** **Skip this for now**. The entity-agnostic schema (single `entities` table with composite index) is simpler and works perfectly.

---

### Phase 4: Initialization in app-initialization-stages.ts

```typescript
import { getDexieDB } from '../persistence/DexieEntityDB';

async executePersistenceSetup(): Promise<boolean> {
  initLog.debug('💾 Setting up Dexie entity cache');

  try {
    const user = unifiedAuth$.user.get();

    if (!user) {
      throw new Error('User not available for cache setup');
    }

    // ✅ Initialize Dexie (instant, no timing issues!)
    const dexie = getDexieDB(user.id);
    await dexie.open();  // Ensure DB is ready

    initLog.info('✅ Dexie entity cache ready');

    // Auto-advance to entities
    await this.advanceToStage('entities');

    return true;

  } catch (error) {
    initLog.error('❌ Dexie setup failed:', error);

    // Continue without cache (server-only mode)
    await this.advanceToStage('entities');
    return true;  // Don't fail app init
  }
}
```

---

## 📊 Expected Performance Improvement

### Before (Current)
```
Dashboard load:
- BuildProject: GET /api/... (200ms)
- LoreCanonTestProject: GET /api/... (200ms)
- Phase: GET /api/... (200ms)
- ... 17 more API calls
Total: ~4000ms (4 seconds)
```

### After (With Dexie)
```
Dashboard load:
- Dexie query (all 20 entities): 5ms  ✅ Show stale data
- API differential sync (3 changed): 150ms
- Dexie update: 2ms
Total: 157ms (26x faster!)
```

---

## 🎁 Benefits of This Approach

| Aspect | Benefit |
|--------|---------|
| **Timing** | ✅ No race conditions (Dexie init is simple) |
| **Cache-first** | ✅ True (Dexie query = instant) |
| **Differential sync** | ✅ Yes (via `?updated_at[gte]=lastSync`) |
| **Dynamic entities** | ✅ Perfect (entity-agnostic schema) |
| **Write path** | ✅ Unchanged (proven syncedCrud) |
| **Schema updates** | ✅ Optional (schema observable can trigger upgrades) |
| **Debugging** | ✅ Easy (Dexie DevTools, console logs) |
| **Code changes** | ✅ Minimal (~200 LOC new, modify list/create/update/delete) |

---

## 🚀 Implementation Steps

### Step 1: Create Dexie Database Class (30 min)
- Create `DexieEntityDB.ts`
- Define schema with composite indexes
- Implement cache query/update methods

### Step 2: Update syncedCrud Functions (1 hour)
- Modify `list()` to query Dexie first
- Add Dexie cache updates to `create/update/delete`
- Implement merge logic for server changes

### Step 3: Initialize in Persistence Stage (15 min)
- Call `getDexieDB(userId)` in `executePersistenceSetup()`
- Remove old `PersistenceManager` logic
- Update stage message to "Setting up entity cache..."

### Step 4: Testing & Verification (30 min)
- Clear IndexedDB, reload page
- Verify Dexie database created
- Check cache-first loading (instant stale data)
- Test differential sync (only changed records fetched)
- Verify writes update both API and cache

**Total Effort:** ~2.25 hours (vs 6+ hours for custom layer from scratch)

---

## 🤔 Open Questions

### Q1: Schema Observable → Dexie Sync?
**Your idea:** Schema observable triggers Dexie schema upgrades

**Analysis:**
- ✅ **Elegant**: Schema is source of truth
- ⚠️  **Complex**: Dexie schema changes require DB close/reopen
- ✅ **Alternative**: Entity-agnostic schema (current plan) doesn't need per-entity tables

**Recommendation:** Start with entity-agnostic schema. If you later want per-entity tables (for advanced indexing), add schema sync as Phase 5.

### Q2: Differential Sync API Support?
**Requires:** Backend API to support `?updated_at[gte]=timestamp` query

**Check:**
```bash
curl "http://localhost:4000/api/dataforge/orgs/01920000-1000.../data/BuildProject?updated_at[gte]=1234567890"
```

If not supported, differential sync won't work (will fetch full dataset each time).

**Workaround:** Still cache-first (show stale instantly), just no bandwidth savings.

### Q3: Conflict Resolution?
**Scenario:** User edits locally while offline, server has newer version

**Strategy:**
- **Server wins**: Overwrite local with server data (simple, your current approach)
- **Last-write-wins**: Compare `updated_at` timestamps
- **Three-way merge**: Complex, probably overkill

**Recommendation:** Server wins (simplest, works with current architecture).

---

## ✅ Final Recommendation

**Proceed with Dexie integration using entity-agnostic schema:**

1. **Single `entities` table** with composite `[orgId+entityType]` index
2. **Legend State reads** from Dexie (cache-first)
3. **Legend State writes** through syncedCrud → API → Dexie update
4. **Schema observable** stays as-is (triggers can be added later)

**Next Steps:**
1. Create `DexieEntityDB.ts` (~150 LOC)
2. Update `createEntityObservable()` list/create/update/delete (~100 LOC changes)
3. Update `executePersistenceSetup()` (~20 LOC)
4. Test and verify cache-first behavior

**Estimated time:** 2-3 hours
**Risk:** Low (Dexie is battle-tested, minimal architecture changes)

Ready to implement?

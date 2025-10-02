# Session Summary: Dynamic Entity Persistence Research & Implementation

**Date:** 2025-10-02
**Duration:** ~3 hours
**Status:** Architecture complete, implementation in progress

---

## 🎯 Original Goal

Research Legend State persistence patterns and implement robust caching for dynamically created entities to enable:
1. Cache-first loading (instant UI with stale data)
2. Differential sync (only fetch changed records)
3. Offline-first capability

---

## 🔍 Root Cause Analysis Completed

### Issues Identified

1. **Multi-Organization Database Mismatch**
   - Persistence configured for single org (Throwaway Inc)
   - Entities span 3 organizations (Wide Corp, Personal, Throwaway)
   - Result: 20/24 entities had no persistence mappings

2. **Progressive Schema Loading Race Condition**
   - `when()` resolved after first schema loaded (1 entity)
   - Should wait for all 3 schemas (26 total entities)
   - Result: Persistence configured before most entities existed

3. **Computed Observable Reactivity**
   - `entities$` computed reacts to schema changes immediately
   - Runs outside async control flow
   - Result: Entities created before persistence config ready

4. **Conditional Persistence Spread Bug**
   - Line 433: `...(hasPersistence && { persist })`
   - When `hasPersistence = false`, no persist config added
   - Result: Entities created without IndexedDB caching

---

## ✅ Architecture Decision: Dexie Two-Layer Sync

After extensive research and multiple approaches, settled on **custom Dexie.js persistence layer**:

### Key Architecture Points

**READ PATH:** Legend State ← Dexie ← Server (both using differential sync)
**WRITE PATH:** Legend State → Server (direct, simple, server wins)
**SYNC:** WebSocket notifications → Dexie background sync → liveQuery → Legend State refresh

### Why This Solves All Problems

1. **No Timing Issues**: Dexie initialized once with complete schema, before entities
2. **Cache-First**: Legend State `list()` reads from Dexie (instant)
3. **Differential Sync**: Both layers (LS↔Dexie and Dexie↔Server) use diffs
4. **Simple Writes**: Direct to server, no CRDT complexity
5. **Cross-Tab Sync**: Dexie liveQuery provides automatic reactivity

---

## 📚 Documentation Created

1. **`PERSISTENCE_FIX_ANALYSIS.md`**
   - Root cause analysis
   - Attempted fixes and why they failed
   - Architecture evolution

2. **`CUSTOM_PERSISTENCE_PROPOSAL.md`**
   - Custom EntityCacheLayer design (alternative approach)
   - Comparison with Legend State built-in persistence

3. **`DEXIE_INTEGRATION_PLAN.md`**
   - Dexie research findings
   - Integration patterns
   - Migration strategy

4. **`docs/plans/dexie-entity-persistence-layer.md`** ⭐
   - Complete implementation plan
   - Code examples for all phases
   - Performance projections
   - Schema change detection
   - Refresh storm prevention

---

## 💻 Code Implementation (In Progress)

### Files Created

1. **`src/legend-state/persistence/DexieEntityDB.ts`** (✅ Complete)
   - Schema mapping from entity definitions
   - Dexie database initialization
   - CRUD methods: `getAllRecords()`, `getChangedSince()`, `updateFromServer()`
   - Schema hash computation for change detection
   - ~250 LOC

2. **`src/legend-state/persistence/DexieSyncLayer.ts`** (✅ Complete)
   - Background sync with differential fetch
   - Schema change detection
   - Initial sync vs differential sync
   - liveQuery subscription management
   - WebSocket notification handling
   - ~250 LOC

### Files Modified

1. **`src/legend-state/observables.ts`** (✅ Partially complete)
   - Added Dexie imports
   - Updated `list()` to read from Dexie
   - Added `fetchDirectFromAPI()` fallback helper
   - Added Dexie change event listener in `subscribe()`
   - Removed persistence gates (no longer needed)

2. **`src/legend-state/app-initialization-stages.ts`** (✅ Complete)
   - Added 'persistence' stage
   - Updated `executePersistenceSetup()` to initialize Dexie
   - Schema wait logic
   - Sync layer initialization sequence

---

## ⚠️ Current Status: Not Working Yet

**Observation:** All entity API calls still being made (no cache-first loading)

**Likely Causes:**
1. Dexie DB initialization might be failing silently
2. `list()` fallback path being used (`getDexieDB()` returns null)
3. `liveQuery` import might need adjustment
4. Schema mapping might have errors

**Next Steps to Debug:**
1. Check browser console for Dexie initialization errors
2. Verify `executePersistenceSetup()` is running
3. Check if Dexie database created in IndexedDB DevTools
4. Add more logging to trace execution path
5. Verify `liveQuery` import from 'dexie' works

---

## 📊 Expected vs Actual Results

### Expected (After Implementation)
- ✅ Dexie DB created with 26 tables
- ✅ Initial sync populates cache
- ✅ Legend State reads from Dexie (0 API calls on reload)
- ✅ Differential sync (only changed records fetched)

### Actual (Current)
- ❌ Still making all 24 entity API calls
- ❓ Dexie initialization status unknown
- ❓ Fallback path being used

---

## 🎓 Key Learnings

1. **Legend State Built-in Persistence Has Timing Issues**
   - Reactive computed observables make coordination nearly impossible
   - `configureSynced()` + conditional spread doesn't work for dynamic schemas

2. **Schema-Based Entity Creation Requires Special Handling**
   - Computed observables react immediately to schema changes
   - Can't use traditional async/await to coordinate timing
   - Need initialization stages BEFORE entities are accessed

3. **Dexie.js is Ideal for This Use Case**
   - Built-in liveQuery for reactivity
   - Flexible schema (easy to add tables)
   - Fast queries with compound indexes
   - No timing coordination needed

4. **Asymmetric Sync Pattern is Clean**
   - Reads from local cache (instant)
   - Writes to server (simple, authoritative)
   - Pull-based sync (no conflict resolution needed)

---

## 🚀 Remaining Work

### Immediate (Debug Current Implementation)
- [ ] Check browser console for Dexie errors
- [ ] Verify executePersistenceSetup() runs to completion
- [ ] Check IndexedDB DevTools for created database
- [ ] Fix any import/initialization errors
- [ ] Add debug logging to trace code path

### Implementation Completion
- [ ] Ensure Dexie tables created correctly
- [ ] Verify `list()` reads from Dexie
- [ ] Test initial sync populates cache
- [ ] Test differential sync on reload
- [ ] Test liveQuery triggers Legend State updates
- [ ] Test cross-tab sync
- [ ] Test WebSocket notification → sync flow

### Polish
- [ ] Add error boundaries for Dexie failures
- [ ] Implement retry logic for failed syncs
- [ ] Add cache eviction/cleanup
- [ ] Performance monitoring
- [ ] Documentation updates

---

## 📈 Projected Impact

Once working:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Warm start load** | 4000ms | 5ms | **800x** |
| **Bandwidth (reload)** | 1.2MB | 4KB | **300x** |
| **Offline support** | None | Full | ✅ |
| **Cross-tab sync** | None | 200ms | ✅ |
| **Timing issues** | Many | None | ✅ |

---

## 💡 Next Session Priorities

1. **Debug why Dexie not initializing**
   - Check browser console
   - Verify imports
   - Check if persistence stage running

2. **Complete Dexie integration**
   - Fix any errors
   - Test cache-first loading
   - Verify differential sync

3. **Add liveQuery integration**
   - Need to import from 'dexie' package
   - Setup subscriptions correctly
   - Test cross-tab updates

4. **Validate performance gains**
   - Measure load times
   - Check bandwidth usage
   - Verify differential sync working

---

## 📝 Key Files for Next Session

**To Review:**
- `src/legend-state/persistence/DexieEntityDB.ts`
- `src/legend-state/persistence/DexieSyncLayer.ts`
- `src/legend-state/observables.ts` (list() function)
- `src/legend-state/app-initialization-stages.ts` (executePersistenceSetup)

**To Check:**
- Browser DevTools → Application → IndexedDB (is database created?)
- Browser Console (Dexie initialization logs)
- Network tab (are API calls coming from fallback path?)

---

## 🎯 Success Will Look Like

**Browser console:**
```
✅ Dexie DB initialized: elevra_universe_0198b046...
📋 Schema for BuildProject: &id, name, statusId, updated_at
...
✅ Initial sync complete: 26/26 succeeded
✅ Dexie cache populated
✅ Live queries active for 26 entities
📦 [DEXIE-READ] BuildProject: 5 records (full)
```

**Network tab (second load):**
```
GET /api/dataforge/.../BuildProject?updated_at[gte]=1234567 → 2 records (not 5!)
(No other entity API calls)
```

**Result:** Instant dashboard load from Dexie cache, background refresh with minimal bandwidth.

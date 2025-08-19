# DEPRECATED: Complex LiveStore Bridges

## ⚠️ **DEPRECATION NOTICE**

The following files implement complex manual bridges that are **DEPRECATED** in favor of the new LiveStore native system:

### **Deprecated Files (DO NOT USE)**

#### 1. **`livestore-change-tracking.ts`** - DEPRECATED ❌
- **What it does**: Manual change tracking on top of LiveStore
- **Why deprecated**: LiveStore has native event system that handles this automatically
- **Replace with**: `livestore-native-sync.ts` - uses LiveStore's built-in subscriptions

#### 2. **`livestore-sync-integration.ts`** - DEPRECATED ❌  
- **What it does**: Complex Dexie ↔ LiveStore bridge with manual hooks
- **Why deprecated**: Fighting against LiveStore's design principles
- **Replace with**: `livestore-native-sync.ts` - clean integration with existing services

#### 3. **`LIVESTORE_CHANGE_TRACKING_INTEGRATION.md`** - DEPRECATED ❌
- **What it describes**: Manual change tracking architecture
- **Why deprecated**: Documents the old complex bridge approach
- **Replace with**: `LIVESTORE_ARCHITECTURE_ANALYSIS.md` - documents native approach

#### 4. **`dynamic-livestore-domain.ts`** - DEPRECATED ❌
- **What it does**: Manual domain services with hand-coded CRUD
- **Why deprecated**: Should be auto-generated from schema
- **Replace with**: `livestore-event-generator.ts` - schema-driven mutations

### **NEW NATIVE SYSTEM (USE THESE)**

#### ✅ **`livestore-event-generator.ts`** - ACTIVE
- Auto-generates events and materializers from organization schemas
- Type-safe mutations based on entity definitions  
- Clean LiveStore API usage with native event system

#### ✅ **`livestore-native-sync.ts`** - ACTIVE
- Uses LiveStore's native subscriptions for change detection
- Clean integration with existing OutgoingChangeService and IncomingChangeService
- No manual change tracking - LiveStore handles everything

#### ✅ **`LiveStoreServiceCoordinator.ts`** - ACTIVE
- Extends existing ServiceCoordinator with LiveStore integration
- Preserves all existing sync logic while adding LiveStore native capabilities
- Orchestrates LiveStore + existing services cleanly

#### ✅ **`livestore-native-test.ts`** - ACTIVE
- Comprehensive tests for the native LiveStore system
- Verifies end-to-end data flow with native capabilities
- Browser-testable with `window.testLiveStoreNativeSystem()`

---

## 🔄 **MIGRATION GUIDE**

### **FROM: Manual Change Tracking**
```typescript
// OLD - Manual tracking (DEPRECATED)
import { LiveStoreChangeTrackingService } from './livestore-change-tracking';

const tracker = new LiveStoreChangeTrackingService();
tracker.trackChange({ /* manual tracking logic */ });
```

### **TO: Native LiveStore Subscriptions**
```typescript
// NEW - Native subscriptions (RECOMMENDED)
import { createLiveStoreNativeSync } from './livestore-native-sync';

const nativeSync = await createLiveStoreNativeSync({
  organizationId,
  clientId, 
  userId,
  store, // LiveStore automatically detects changes
  orgSchema,
  outgoingChangeService,
  incomingChangeService
});
// LiveStore subscriptions handle change detection automatically
```

### **FROM: Manual Domain Services**
```typescript
// OLD - Hand-coded services (DEPRECATED)
import { DynamicLiveStoreDomainService } from './dynamic-livestore-domain';

const service = new DynamicLiveStoreDomainService();
await service.create(orgId, 'projects', data); // Manual implementation
```

### **TO: Auto-Generated Mutations**
```typescript
// NEW - Schema-generated mutations (RECOMMENDED)
import { liveStoreEventGenerator } from './livestore-event-generator';

const mutations = await liveStoreEventGenerator.createMutations(orgId, store, orgSchema);
await mutations.projects.create(data); // Auto-generated from schema
```

### **FROM: Complex ServiceCoordinator**
```typescript
// OLD - Manual service wiring (DEPRECATED)
const services = await serviceCoordinator.initialize(config);
// Manual wiring of LiveStore bridges
```

### **TO: Enhanced ServiceCoordinator**
```typescript
// NEW - Integrated LiveStore support (RECOMMENDED) 
import { LiveStoreServiceCoordinator } from './LiveStoreServiceCoordinator';

const coordinator = new LiveStoreServiceCoordinator();
const services = await coordinator.initialize({
  ...config,
  organizationId,
  userId,
  orgSchema,
  enableLiveStore: true
});
// Returns: { webSocket, incoming, outgoing, liveStore, liveStoreSync }
```

---

## 🧹 **CLEANUP CHECKLIST**

When removing deprecated files:

- [ ] **Stop using** `livestore-change-tracking.ts`
- [ ] **Stop using** `livestore-sync-integration.ts`  
- [ ] **Stop using** `dynamic-livestore-domain.ts`
- [ ] **Update imports** to use new native system
- [ ] **Run tests** with `window.testLiveStoreNativeSystem()`
- [ ] **Verify** end-to-end sync still works
- [ ] **Remove** deprecated file imports from other files

---

## 📈 **BENEFITS OF NATIVE SYSTEM**

### **Performance**
- ✅ Native SQLite queries vs manual IndexedDB operations
- ✅ LiveStore's optimized change detection vs manual tracking
- ✅ Built-in batching and transaction handling

### **Maintainability**
- ✅ Schema-driven code generation vs hand-coded services
- ✅ Clean LiveStore API usage vs complex bridges
- ✅ Single source of truth (organization schema)

### **Reliability**
- ✅ LiveStore's battle-tested event system vs manual implementations
- ✅ No sync loops - native prevent-during-sync handling
- ✅ Comprehensive error handling built into LiveStore

### **Developer Experience**  
- ✅ Type-safe auto-generated mutations
- ✅ Familiar LiveStore patterns vs custom bridges
- ✅ Easy testing and debugging with native tools

---

## ⚡ **IMMEDIATE ACTION REQUIRED**

1. **Stop using deprecated files** - they may cause conflicts with native system
2. **Switch to native system** - use the new files listed above
3. **Test thoroughly** - run `window.testLiveStoreNativeSystem()` in browser
4. **Update documentation** - reference new architecture document

The native LiveStore system is **production-ready** and provides all the benefits of the deprecated complex bridges without the maintenance overhead.

---

*Ready to embrace LiveStore's native capabilities* 🚀
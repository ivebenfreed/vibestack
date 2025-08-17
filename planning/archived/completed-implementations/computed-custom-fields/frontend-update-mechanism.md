# Frontend Computed Fields Update Mechanism

## 🔄 **Efficient Update Strategy for Frontend Computation**

Since computed fields are calculated on the frontend using Math.js, we need an optimized mechanism to handle:
1. **Dependency tracking** - Know which computed fields need updates when base fields change
2. **Efficient recalculation** - Minimize unnecessary computations 
3. **Batch updates** - Handle multiple field changes efficiently
4. **Sync integration** - Propagate computed values through existing sync system

## 🎯 **Current Sync Architecture Analysis**

Based on the existing codebase, the current update flow is:
```
User Edit → Domain Service → Dexie Update → Change Tracking Hooks → Sync System
```

### **Key Components:**
- **Domain Services**: Handle entity updates with automatic sync tracking
- **Change Tracking Hooks**: Automatically detect and track changes  
- **Sync Machine V3**: WebSocket-based sync with conflict resolution
- **IncomingChangeService**: Processes incoming changes with batching

## 🏗️ **Computed Fields Integration Architecture**

### **1. Computed Field Registry**
```typescript
// New service to manage computed field definitions and dependencies
export class ComputedFieldRegistry {
  private fieldDefinitions = new Map<string, ComputedFieldDefinition>();
  private dependencyGraph = new Map<string, Set<string>>(); // field -> dependent computed fields
  private entityComputedFields = new Map<string, Set<string>>(); // entityType -> computed fields
  
  constructor() {
    this.loadFromSchema();
  }
  
  // Register computed field definition
  registerComputedField(entityType: string, fieldName: string, definition: ComputedFieldDefinition) {
    const key = `${entityType}.${fieldName}`;
    this.fieldDefinitions.set(key, definition);
    this.entityComputedFields.get(entityType)?.add(fieldName) || 
      this.entityComputedFields.set(entityType, new Set([fieldName]));
    
    // Build dependency graph
    definition.dependencies.forEach(depField => {
      const depKey = `${entityType}.${depField}`;
      if (!this.dependencyGraph.has(depKey)) {
        this.dependencyGraph.set(depKey, new Set());
      }
      this.dependencyGraph.get(depKey)!.add(key);
    });
  }
  
  // Get computed fields that depend on a changed field
  getDependentComputedFields(entityType: string, changedField: string): ComputedFieldDefinition[] {
    const key = `${entityType}.${changedField}`;
    const dependentKeys = this.dependencyGraph.get(key) || new Set();
    
    return Array.from(dependentKeys).map(depKey => 
      this.fieldDefinitions.get(depKey)!
    ).filter(Boolean);
  }
}
```

### **2. Computed Field Engine**
```typescript
export class ComputedFieldEngine {
  private mathJs: any;
  private registry: ComputedFieldRegistry;
  
  constructor(registry: ComputedFieldRegistry) {
    this.registry = registry;
    this.mathJs = create(this.getSecureConfig());
  }
  
  // Calculate single computed field
  async computeField(
    entityData: Record<string, any>, 
    fieldDefinition: ComputedFieldDefinition
  ): Promise<number | null> {
    try {
      // Build context with dependency values
      const context = {};
      for (const dep of fieldDefinition.dependencies) {
        context[dep] = entityData[dep] ?? 0;
      }
      
      // Evaluate formula with Math.js
      const result = this.mathJs.evaluate(fieldDefinition.formula, context);
      return typeof result === 'number' ? result : null;
    } catch (error) {
      console.error(`[ComputedFieldEngine] Error computing ${fieldDefinition.fieldName}:`, error);
      return null;
    }
  }
  
  // Batch compute multiple fields with dependency ordering
  async computeFields(
    entityData: Record<string, any>,
    computedFieldsToUpdate: ComputedFieldDefinition[]
  ): Promise<Record<string, number | null>> {
    const results: Record<string, number | null> = {};
    
    // Sort by dependency order (fields with fewer deps first)
    const sorted = this.topologicalSort(computedFieldsToUpdate);
    
    for (const fieldDef of sorted) {
      // Include previously computed values in context
      const contextData = { ...entityData, ...results };
      const value = await this.computeField(contextData, fieldDef);
      results[fieldDef.fieldName] = value;
    }
    
    return results;
  }
  
  private getSecureConfig() {
    // Secure Math.js configuration (from security-analysis.md)
    return {
      // Only allow safe mathematical functions
      // No eval, import, createUnit, etc.
    };
  }
}
```

### **3. Enhanced Domain Service Integration**
```typescript
// Extend BaseDomainService with computed field support
export abstract class BaseDomainService<TEntity, TCreateInput, TUpdateInput> {
  private static computedRegistry = new ComputedFieldRegistry();
  private static computedEngine = new ComputedFieldEngine(this.computedRegistry);
  
  // Enhanced update method with computed field support
  async update(id: string, updates: TUpdateInput): Promise<TEntity> {
    // 1. Get current entity data
    const currentEntity = await this.getTable().get(id);
    if (!currentEntity) {
      throw new Error(`${this.entityName} ${id} not found`);
    }
    
    // 2. Apply base updates
    const updatedEntity = { ...currentEntity, ...updates, updatedAt: new Date().toISOString() };
    
    // 3. Check if any changed fields affect computed fields
    const changedFields = Object.keys(updates);
    const computedFieldsToUpdate: ComputedFieldDefinition[] = [];
    
    for (const changedField of changedFields) {
      const dependentFields = BaseDomainService.computedRegistry
        .getDependentComputedFields(this.tableName, changedField);
      computedFieldsToUpdate.push(...dependentFields);
    }
    
    // 4. Compute affected computed fields
    if (computedFieldsToUpdate.length > 0) {
      const computedValues = await BaseDomainService.computedEngine
        .computeFields(updatedEntity, computedFieldsToUpdate);
      
      // Add computed values to the update
      Object.assign(updatedEntity, computedValues);
    }
    
    // 5. Save to Dexie (triggers automatic sync tracking)
    await this.getTable().put(updatedEntity);
    
    console.log(`[${this.entityName}Service] Updated with computed fields`, {
      id,
      originalUpdates: Object.keys(updates),
      computedFieldsUpdated: computedFieldsToUpdate.map(f => f.fieldName),
      computedValues: Object.keys(computedValues || {})
    });
    
    return updatedEntity;
  }
  
  // Batch update with computed field efficiency
  async batchUpdate(updates: Array<{ id: string; updates: TUpdateInput }>): Promise<TEntity[]> {
    const results: TEntity[] = [];
    
    // Group by changed fields to optimize computed field calculations
    const updateGroups = this.groupUpdatesByComputedDependencies(updates);
    
    for (const group of updateGroups) {
      // Process each group with optimized computed field handling
      const groupResults = await Promise.all(
        group.map(({ id, updates }) => this.update(id, updates))
      );
      results.push(...groupResults);
    }
    
    return results;
  }
}
```

### **4. Optimized Sync Integration**
```typescript
// Enhanced change processing for computed fields
export class ComputedFieldChangeProcessor {
  private computedRegistry: ComputedFieldRegistry;
  private computedEngine: ComputedFieldEngine;
  
  // Process incoming changes and update affected computed fields
  async processIncomingChanges(changes: TableChange[]): Promise<TableChange[]> {
    const additionalChanges: TableChange[] = [];
    
    for (const change of changes) {
      if (change.operation === 'update' || change.operation === 'insert') {
        // Check if this change affects computed fields
        const changedFields = Object.keys(change.data);
        const computedFieldsToUpdate = changedFields.flatMap(field =>
          this.computedRegistry.getDependentComputedFields(change.table, field)
        );
        
        if (computedFieldsToUpdate.length > 0) {
          // Get current entity data
          const table = db[change.table as keyof typeof db];
          const currentData = await table.get(change.data.id);
          
          if (currentData) {
            // Compute new values
            const computedValues = await this.computedEngine
              .computeFields({ ...currentData, ...change.data }, computedFieldsToUpdate);
            
            // Create additional change for computed fields
            if (Object.keys(computedValues).length > 0) {
              additionalChanges.push({
                ...change,
                data: { ...change.data, ...computedValues },
                metadata: {
                  ...change.metadata,
                  computedFields: Object.keys(computedValues),
                  triggeredBy: changedFields
                }
              });
            }
          }
        }
      }
    }
    
    return [...changes, ...additionalChanges];
  }
}

// Integrate with existing IncomingChangeService
export class EnhancedIncomingChangeService extends IncomingChangeService {
  private computedProcessor = new ComputedFieldChangeProcessor();
  
  async processChanges(changes: TableChange[], messageType: string): Promise<ProcessingResult[]> {
    // 1. Process computed field dependencies
    const enhancedChanges = await this.computedProcessor.processIncomingChanges(changes);
    
    // 2. Apply changes using parent implementation
    return super.processChanges(enhancedChanges, messageType);
  }
}
```

## ⚡ **Performance Optimizations**

### **1. Intelligent Batching**
```typescript
export class ComputedFieldBatchProcessor {
  private updateQueue: Array<{
    entityType: string;
    entityId: string;
    updates: Record<string, any>;
    timestamp: number;
  }> = [];
  
  private flushTimer: NodeJS.Timeout | null = null;
  
  // Queue update for batching
  queueUpdate(entityType: string, entityId: string, updates: Record<string, any>) {
    this.updateQueue.push({
      entityType,
      entityId,
      updates,
      timestamp: Date.now()
    });
    
    // Debounce batch processing
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    
    this.flushTimer = setTimeout(() => this.flushQueue(), 50); // 50ms debounce
  }
  
  private async flushQueue() {
    if (this.updateQueue.length === 0) return;
    
    // Group by entity type and ID
    const grouped = this.groupUpdates(this.updateQueue);
    this.updateQueue = [];
    
    // Process each group efficiently
    for (const [entityType, entityUpdates] of grouped) {
      await this.processBatchForEntityType(entityType, entityUpdates);
    }
  }
}
```

### **2. Memoization & Caching**
```typescript
export class ComputedFieldCache {
  private cache = new Map<string, { value: number; hash: string; timestamp: number }>();
  
  // Generate hash of dependency values
  private generateHash(dependencies: Record<string, any>): string {
    return JSON.stringify(dependencies, Object.keys(dependencies).sort());
  }
  
  // Get cached value if dependencies haven't changed
  getCachedValue(fieldKey: string, dependencies: Record<string, any>): number | null {
    const cached = this.cache.get(fieldKey);
    if (!cached) return null;
    
    const currentHash = this.generateHash(dependencies);
    if (cached.hash === currentHash) {
      return cached.value;
    }
    
    return null;
  }
  
  // Cache computed value
  setCachedValue(fieldKey: string, value: number, dependencies: Record<string, any>) {
    this.cache.set(fieldKey, {
      value,
      hash: this.generateHash(dependencies),
      timestamp: Date.now()
    });
  }
}
```

### **3. Background Processing**
```typescript
export class ComputedFieldWorker {
  private worker: Worker | null = null;
  
  constructor() {
    // Initialize Web Worker for heavy computations
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(
        new URL('./computed-field-worker.ts', import.meta.url),
        { type: 'module' }
      );
    }
  }
  
  // Offload complex computations to worker
  async computeInWorker(
    fieldDefinitions: ComputedFieldDefinition[],
    entityData: Record<string, any>
  ): Promise<Record<string, number | null>> {
    if (!this.worker) {
      // Fallback to main thread
      return this.computeInMainThread(fieldDefinitions, entityData);
    }
    
    return new Promise((resolve, reject) => {
      const messageId = nanoid();
      
      const handler = (event: MessageEvent) => {
        if (event.data.messageId === messageId) {
          this.worker!.removeEventListener('message', handler);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.results);
          }
        }
      };
      
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({
        messageId,
        fieldDefinitions,
        entityData
      });
    });
  }
}
```

## 🔄 **Integration with Existing Sync System**

### **Update Flow:**
1. **User Edit** → Domain Service `update()`
2. **Computed Field Detection** → Registry identifies dependent fields
3. **Batch Computation** → Engine calculates new values efficiently
4. **Single Dexie Write** → All changes (base + computed) written atomically
5. **Automatic Sync** → Existing change tracking hooks handle sync
6. **Conflict Resolution** → Existing sync system handles conflicts

### **Benefits:**
- ✅ **Minimal Changes** to existing architecture
- ✅ **Atomic Updates** - base and computed fields updated together
- ✅ **Efficient Batching** - multiple field changes processed optimally
- ✅ **Background Processing** - Web Workers for complex calculations
- ✅ **Intelligent Caching** - Avoid redundant computations
- ✅ **Conflict Resolution** - Leverages existing sync conflict handling

This mechanism provides efficient, real-time computed field updates while seamlessly integrating with the existing sync architecture!
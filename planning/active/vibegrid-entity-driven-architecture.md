# VibeGrid Entity-Driven Architecture Plan

## Goal
Transform VibeGrid into a fully entity-driven component where passing just `entityType` enables automatic schema loading, column generation, and unified field type processing. **CLEAN BREAK - NO BACKWARD COMPATIBILITY**.

## Current Architecture Analysis

### Current State
- ✅ Schema stored in Legend State observables (`schema-observable.ts`)
- ✅ VibeGrid has sophisticated observable state (`tableCore$`, `visualState$`, `interactionState$`)
- ✅ Field type registry exists for cell rendering (`field-types/FieldTypeRegistry.ts`)
- ❌ External column generation via `useEntityColumns` hook (TO BE REMOVED)
- ❌ Column generation happens outside VibeGrid (TO BE MOVED INTERNAL)
- ❌ No unified schema→columns pipeline in VibeGrid observables

### Current Issues Solved by This Plan
- **Priority Badge Issue**: Field type mismatches between schema and VibeGrid column types
- **Duplication**: Schema field type logic exists in multiple places
- **Complex Consumer API**: Requires external hooks for column generation

## Target Architecture: Entity-Only VibeGrid

### Clean API Design
```typescript
// ✅ Target: Clean entity-only API
<VibeGrid entityType="WorkTask" />
// No columns prop, no external hooks needed
```

### Internal Processing Flow
```typescript
VibeGrid Props: { entityType: string } // ONLY entityType, no columns

// 1. Load schema from Legend State observables
const schema = getEntitySchema$(entityType).get()

// 2. Generate columns using VibeGrid's field type registry
const columns = fieldTypeRegistry.generateColumns(schema.fields)

// 3. Initialize VibeGrid with generated columns
initializeWithColumns(columns)
```

## Implementation Plan - CLEAN BREAK

### Phase 1: Remove columns prop, Add entityType prop
- [ ] **BREAKING**: Remove `columns` prop from VibeGrid interface
- [ ] Add `entityType: string` as required prop
- [ ] Update all VibeGrid consumers to use entityType

### Phase 2: Move Column Generation into VibeGrid tableCore$
- [ ] Add `generateColumnsFromSchema()` method to tableCore$
- [ ] Move field type mapping logic from external hooks into VibeGrid
- [ ] Integrate with existing field type registry

### Phase 3: Schema-Driven Observable Initialization
- [ ] Update VibeGrid initialization to load schema internally
- [ ] Generate columns during tableCore$ initialization
- [ ] Remove external `useEntityColumns` hook usage

### Phase 4: Unified Field Type Processing
- [ ] Centralize all field type evaluation in VibeGrid field type registry
- [ ] Fix `custom_option_reference` → `select` mapping
- [ ] Ensure priority badges work with unified pipeline

### Phase 5: Update All Consumers
- [ ] Replace `<VibeGrid columns={...} />` with `<VibeGrid entityType="..." />`
- [ ] Remove external column generation hooks
- [ ] Test priority badges in WorkTask entity

## Benefits of Entity-Driven Architecture

### 1. Unified Field Type Processing
- **Same Pipeline**: Schema field types → VibeGrid column types → Cell renderers
- **Consistent Evaluation**: Field metadata processed once in VibeGrid
- **Single Source of Truth**: VibeGrid field type registry drives everything

### 2. Simplified Consumer API
- **One Prop**: Just pass `entityType`, everything else handled internally
- **Automatic Updates**: Schema changes automatically update VibeGrid
- **Reduced Complexity**: No external column generation hooks needed

### 3. Performance Optimization
- **Cached Processing**: Schema and columns cached in VibeGrid observables
- **Reactive Updates**: Only regenerate when schema actually changes
- **Unified State**: No duplication between external column state and VibeGrid state

### 4. Developer Experience
- **Easier Usage**: `<VibeGrid entityType="WorkTask" />` vs current complex setup
- **Better Debugging**: All field type logic in one place
- **Consistent Behavior**: Same field type handling across all entities

## Implementation Details

### Schema Integration in tableCore$
```typescript
// Add to tableCore$ observable
const tableCore$ = observable({
  // Existing properties...

  // New entity-driven properties
  entitySchema: null as EntitySchema | null,
  generatedColumns: [] as Column[],
  schemaLoadingState: 'idle' as 'idle' | 'loading' | 'loaded' | 'error',

  // New methods
  async loadEntitySchema(entityType: string, orgId: string) {
    this.schemaLoadingState = 'loading'
    try {
      const schema = await getEntitySchema(entityType, orgId)
      this.entitySchema = schema
      this.generatedColumns = this.generateColumnsFromSchema(schema)
      this.schemaLoadingState = 'loaded'
    } catch (error) {
      this.schemaLoadingState = 'error'
      console.error('Failed to load entity schema:', error)
    }
  },

  generateColumnsFromSchema(schema: EntitySchema): Column[] {
    // Use VibeGrid's field type registry for consistent processing
    return schema.fields.map(field =>
      fieldTypeRegistry.createColumn(field)
    )
  }
})
```

### VibeGrid Props Enhancement
```typescript
interface VibeGridProps<T = any> {
  // New entity-driven mode
  entityType?: string

  // Existing column-based mode (backward compatibility)
  columns?: Column<T>[]

  // Existing props...
  tableId: string
  // ... other props
}
```

### Initialization Logic
```typescript
// In VibeGrid component
useEffect(() => {
  if (entityType && orgId && userId) {
    // Entity-driven initialization
    tableCore$.loadEntitySchema(entityType, orgId).then(() => {
      // Schema loaded, columns generated, initialize visual state
      const columns = tableCore$.generatedColumns.get()
      visualState.visualOperations.initializeColumns(columns, entityType, orgId, userId)
    })
  } else if (columns) {
    // Existing column-based initialization
    visualState.visualOperations.initializeColumns(columns, entityType, orgId, userId)
  }
}, [entityType, columns, orgId, userId])
```

## Testing Strategy

### 1. Backward Compatibility Testing
- [ ] Verify existing VibeGrid usage with `columns` prop still works
- [ ] Test all current VibeGrid implementations
- [ ] Ensure no regressions in existing functionality

### 2. Entity-Driven Mode Testing
- [ ] Test `<VibeGrid entityType="WorkTask" />`
- [ ] Verify priority badges display correctly
- [ ] Test schema loading error handling
- [ ] Validate field type consistency

### 3. Performance Testing
- [ ] Compare performance of entity-driven vs column-based modes
- [ ] Verify schema caching works correctly
- [ ] Test reactive updates when schema changes

## Migration Path

### Phase 1: Add Entity Support (Non-Breaking)
- Add `entityType` prop support alongside existing `columns` prop
- Implement schema loading and column generation
- Test new functionality without affecting existing usage

### Phase 2: Optimize Existing Usage (Optional)
- Gradually migrate existing VibeGrid usage to entity-driven mode
- Simplify consumer components that currently use external column hooks
- Remove unnecessary external column generation where appropriate

### Phase 3: Long-term (Future)
- Consider deprecating external column hooks in favor of entity-driven mode
- Optimize for entity-first usage patterns
- Enhance field type registry with more unified processing

## Success Criteria

### 1. Functional Requirements
- [ ] `<VibeGrid entityType="WorkTask" />` works correctly
- [ ] Priority badges display with proper colors and icons
- [ ] All existing VibeGrid functionality preserved
- [ ] Schema loading handles errors gracefully

### 2. Performance Requirements
- [ ] Entity-driven mode performance comparable to column-based mode
- [ ] Schema caching prevents unnecessary API calls
- [ ] Column generation cached and reactive

### 3. Developer Experience
- [ ] Simplified API for new VibeGrid usage
- [ ] Clear documentation and examples
- [ ] Consistent field type behavior across all entities

## Risk Mitigation

### 1. Backward Compatibility
- Maintain existing `columns` prop support
- No breaking changes to current VibeGrid usage
- Gradual migration path for existing consumers

### 2. Performance Risks
- Implement schema caching to prevent performance degradation
- Monitor observable state size and memory usage
- Optimize column generation for large schemas

### 3. Complexity Risks
- Keep initialization logic clear and well-documented
- Separate entity-driven and column-based code paths
- Comprehensive testing for both modes

## Next Steps

1. **Create Planning Document** ✅ (This file)
2. **Implement Props Interface**: Add `entityType` prop to VibeGrid
3. **Enhance tableCore$**: Add schema loading and column generation methods
4. **Update Initialization**: Handle entity-driven mode in VibeGrid
5. **Test and Validate**: Verify priority badges work with unified pipeline
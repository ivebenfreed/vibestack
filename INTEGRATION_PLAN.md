# Legend State Options Integration Plan

## Phase 1: Schema Enhancement

### Current Schema Loading Process
```typescript
// Current: loads only business entities from database
const schemaResult = await orgSchemaClient.loadOrgSchema(orgId)

// Returns: { entities: { Task: {...}, Project: {...} } }
```

### Enhanced Schema Loading Process
```typescript
// Enhanced: loads business entities + system/custom options
const enhancedSchema = await loadUniverseWithOptions(organizationIds)

// Returns: { 
//   entities: { 
//     // Business entities (existing)
//     'org1_Task': {...}, 'org1_Project': {...},
//     // System entities (new)
//     'SystemOption': {...}, 'CustomOptionTemplate': {...},
//     // Org-specific option entities (new)
//     'org1_CustomOption': {...}
//   } 
// }
```

## Phase 2: Entity Type Categories

### System-Level Entities (Global)
- `SystemOption`: Global priority/status/category options
- `CustomOptionTemplate`: Reusable option templates

### Organization-Level Entities (Per-Org)  
- `{orgId}_CustomOption`: Organization-specific options
- `{orgId}_User`: Organization users (for reference dropdowns)
- `{orgId}_Project`: Business entities (existing pattern)

## Phase 3: Integration Points

### 1. InitializationManager Enhancement
- Include option entities in schema validation
- Add option entities to persistence setup
- Handle option-specific error recovery

### 2. Observable Creation Strategy
- Use same lazy loading for option entities
- Same cache key strategy: `globalEntityCache[entityName]`
- Same persistence context from InitializationManager

### 3. Column Generation Integration
- `useEntityColumns` automatically discovers option entities
- Populates dropdown options from synced observables
- Real-time updates when options change

## Phase 4: Implementation Strategy

### Week 1: Schema Foundation
- [ ] Create option entity definitions in database
- [ ] Extend schema loading to include options
- [ ] Update InitializationManager to handle option entities

### Week 2: Observable Integration  
- [ ] Option entities use same `createEntityObservable` pattern
- [ ] Integrate with existing persistence system
- [ ] Test lazy loading and caching

### Week 3: Column Enhancement
- [ ] Enhance `useEntityColumns` with option population
- [ ] Create option-aware cell types
- [ ] Test real-time option updates

### Week 4: Testing & Polish
- [ ] Comprehensive testing with large option datasets
- [ ] Performance optimization for huge dropdown lists
- [ ] Error handling and edge cases

## Benefits of This Approach

1. **Consistent Architecture**: Options use exact same patterns as business data
2. **Performance**: Same lazy loading, caching, and persistence optimizations  
3. **Real-time Collaboration**: Option changes sync instantly across users
4. **Error Recovery**: Same robust IndexedDB error handling
5. **Scalability**: Virtual scrolling for huge option lists
6. **Developer Experience**: Same API for all data types
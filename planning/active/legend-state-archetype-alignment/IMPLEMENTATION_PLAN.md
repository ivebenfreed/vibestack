# Legend State & Universal Archetype Alignment Plan

## Overview
Align the Legend State client implementation with the Universal Archetype server foundation to enable seamless data display, custom fields, and live schema updates.

## Current State Analysis

### Working Well
- ✅ Legend State differential sync with `changesSince: 'last-sync'`
- ✅ IndexedDB persistence for offline support
- ✅ WebSocket notifications triggering store updates
- ✅ Hybrid RLS + Organization Actor security (85-90% performance gain)
- ✅ Debounced migrations on server (30-second batching)
- ✅ 8 universal archetypes supported

### Gap Analysis
- ❌ Schema format inconsistency between client/server
- ❌ Custom fields not exposed in UI
- ❌ Full entity refetch instead of granular updates
- ❌ No dynamic form generation for custom fields
- ❌ Missing field-level change tracking

## Implementation Phases

### Phase 1: Schema Standardization (Week 1)
**Goal**: Unified schema format with complete field metadata

#### Tasks
1. **Update Schema Endpoint** (Day 1-2)
   - Modify `/api/organizations/:orgId/schema` to include:
     - Full field definitions (standard + custom)
     - Field types, validation rules, default values
     - Archetype metadata
   - Location: `apps/server/src/routes/organization-schema.ts`

2. **Create TypeScript Interfaces** (Day 2)
   - Define `UnifiedEntitySchema` interface
   - Share between client/server via packages
   - Location: `packages/shared-types/src/schema.ts`

3. **Update Legend Central Store** (Day 3)
   - Consume new schema format
   - Parse custom field definitions
   - Location: `apps/web/src/stores/vibestack-legend-central.ts`

### Phase 2: Custom Field Rendering (Week 1-2)
**Goal**: Dynamic UI components for custom fields

#### Tasks
1. **Field Type Components** (Day 4-5)
   - Create field renderers for each type:
     - Text, LongText, RichText
     - Number, Decimal, Integer
     - Boolean, Date, DateTime
     - Email, URL, JSON
     - Status/Priority/Category options
     - User/Entity references
   - Location: `apps/web/src/components/fields/`

2. **Dynamic Form Generator** (Day 6-7)
   - `DynamicEntityForm` component
   - Field validation based on schema
   - Optimistic updates via Legend State
   - Location: `apps/web/src/components/entities/DynamicEntityForm.tsx`

3. **Data Grid Enhancement** (Day 8)
   - `ArchetypeDataGrid` with custom columns
   - Inline editing support
   - Sort/filter by custom fields
   - Location: `apps/web/src/components/entities/ArchetypeDataGrid.tsx`

### Phase 3: Granular Live Updates (Week 2)
**Goal**: Field-level WebSocket updates without full refetch

#### Tasks
1. **Server-Side Change Tracking** (Day 9-10)
   - Implement field-level diff detection
   - Modify WebSocket payload structure:
     ```typescript
     {
       operation: 'update',
       table: 'project',
       recordId: 'uuid',
       changes: {
         title: { old: 'Old', new: 'New' },
         custom_budget: { old: 1000, new: 2000 }
       }
     }
     ```
   - Location: `apps/server/src/services/websocket-notifications.ts`

2. **Client-Side Partial Updates** (Day 11)
   - Update `syncedVibeStack` to handle partial updates
   - Merge changes into existing Legend State observable
   - Location: `apps/web/src/stores/sync/synced-vibestack.ts`

3. **Optimistic Update Reconciliation** (Day 12)
   - Handle conflicts between optimistic and server updates
   - Implement conflict resolution UI
   - Location: `apps/web/src/stores/sync/conflict-resolver.ts`

### Phase 4: Schema Evolution UI (Week 2-3)
**Goal**: Live schema modification from the UI

#### Tasks
1. **Schema Editor Component** (Day 13-14)
   - Visual field editor
   - Drag-drop field ordering
   - Field type conversion rules
   - Location: `apps/web/src/components/schema/SchemaEditor.tsx`

2. **Migration Preview** (Day 15)
   - Show pending migrations (debounced queue)
   - Display affected records count
   - Estimate migration time
   - Location: `apps/web/src/components/schema/MigrationPreview.tsx`

3. **Field Usage Analytics** (Day 16)
   - Track which fields are most used
   - Identify unused fields for cleanup
   - Show field fill rates
   - Location: `apps/web/src/components/schema/FieldAnalytics.tsx`

## Technical Implementation Details

### Unified Schema Structure
```typescript
interface UnifiedEntitySchema {
  entityName: string;
  tableName: string;
  archetype: ArchetypeType;
  fields: {
    standard: StandardField[];
    custom: CustomField[];
  };
  syncConfig: {
    softDelete: boolean;
    optimisticUpdates: boolean;
    conflictResolution: 'client' | 'server' | 'manual';
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    recordCount: number;
    lastMigration?: string;
  };
}

interface FieldDefinition {
  name: string;
  type: FieldType;
  required: boolean;
  defaultValue?: any;
  validation?: ValidationRule[];
  displayConfig?: {
    label: string;
    placeholder?: string;
    helpText?: string;
    hidden?: boolean;
    readonly?: boolean;
  };
}
```

### WebSocket Enhancement
```typescript
// Enhanced notification payload
interface TableChangeNotification {
  organizationId: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  recordId: string;
  changes?: FieldChanges; // New: field-level changes
  timestamp: string;
  userId: string;
}

interface FieldChanges {
  [fieldName: string]: {
    old: any;
    new: any;
  };
}
```

### Legend State Integration
```typescript
// Enhanced entity store with custom field support
export function entity$(entityName: string) {
  const store = observable({
    records: syncedVibeStack({
      // ... existing config
      onFieldChange: (recordId, field, value) => {
        // Granular update handler
        batch(() => {
          store.records[recordId][field].set(value);
        });
      }
    }),
    schema: computed(() => {
      // Derive schema for this entity
      return orgContext$.schema.get()?.entities[entityName];
    }),
    customFields: computed(() => {
      // Extract custom field definitions
      return store.schema.get()?.fields?.custom || [];
    })
  });
  
  return store;
}
```

## Success Metrics
- **Performance**: <100ms latency for field updates
- **Data Integrity**: Zero data loss during schema migrations
- **User Experience**: Seamless custom field editing
- **Developer Experience**: Type-safe field access
- **Scalability**: Support 100+ custom fields per entity

## Risk Mitigation
1. **Migration Rollback**: Implement undo for schema changes
2. **Data Validation**: Validate all custom field data before save
3. **Conflict Resolution**: Clear UI for handling update conflicts
4. **Performance**: Index custom fields for query performance
5. **Testing**: Comprehensive E2E tests for schema evolution

## Dependencies
- Legend State v3.x for reactive state management
- Kysely for type-safe SQL generation
- WebSocket for real-time updates
- IndexedDB for offline persistence
- React Hook Form for form handling

## Timeline Summary
- **Week 1**: Schema standardization & custom field rendering
- **Week 2**: Granular updates & schema evolution UI (partial)
- **Week 3**: Complete schema evolution & testing

## Next Steps
1. Review plan with team
2. Create detailed technical specs for Phase 1
3. Set up testing infrastructure
4. Begin Phase 1 implementation
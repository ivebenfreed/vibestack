# Legend State & Universal Archetype Alignment - Consolidated Plan

## Executive Summary
Align the Legend State client implementation with the Universal Archetype server foundation to enable seamless data display, custom fields, and live schema updates.

## Current State Analysis

### ✅ Working Well
- Legend State differential sync with `changesSince: 'last-sync'`
- IndexedDB persistence for offline support
- WebSocket notifications triggering store updates
- Hybrid RLS + Organization Actor security (85-90% performance gain)
- Debounced migrations on server (30-second batching)
- 8 universal archetypes supported

### ❌ Gap Analysis
- Schema format inconsistency between client/server
- Custom fields not exposed in UI
- Full entity refetch instead of granular updates
- No dynamic form generation for custom fields
- Missing field-level change tracking

## Implementation Phases

### Phase 1: Schema Standardization (Week 1, Days 1-3)
**Goal**: Unified schema format with complete field metadata

#### Unified Schema Structure
```typescript
interface UnifiedEntitySchema {
  entityName: string;
  tableName: string;
  archetype: 'project' | 'task' | 'record' | 'document' | 'file' | 'activity' | 'discussion' | 'collection';
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
  type: 'text' | 'longtext' | 'rich_text' | 'number' | 'decimal' | 'integer' | 
        'boolean' | 'date' | 'datetime' | 'email' | 'url' | 'json' |
        'status_option' | 'priority_option' | 'category_option' | 
        'user_reference' | 'entity_reference';
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

#### Tasks
1. **Update Schema Endpoint** (Day 1-2)
   - Modify `/api/organizations/:orgId/schema` to include full field definitions
   - Add field types, validation rules, default values
   - Include archetype metadata
   - Location: `apps/server/src/routes/organization-schema.ts`

2. **Create TypeScript Interfaces** (Day 2)
   - Define `UnifiedEntitySchema` interface
   - Share between client/server via packages
   - Location: `packages/shared-types/src/schema.ts`

3. **Update Legend Central Store** (Day 3)
   - Consume new schema format
   - Parse custom field definitions
   - Location: `apps/web/src/stores/vibestack-legend-central.ts`

### Phase 2: Custom Field Rendering (Week 1, Days 4-8)
**Goal**: Dynamic UI components for custom fields

#### Field Component Registry
```typescript
export const FieldComponentRegistry = {
  text: TextFieldComponent,
  longtext: LongTextFieldComponent,
  rich_text: RichTextFieldComponent,
  number: NumberFieldComponent,
  decimal: DecimalFieldComponent,
  integer: IntegerFieldComponent,
  boolean: BooleanFieldComponent,
  date: DateFieldComponent,
  datetime: DateTimeFieldComponent,
  email: EmailFieldComponent,
  url: URLFieldComponent,
  json: JSONFieldComponent,
  status_option: StatusOptionFieldComponent,
  priority_option: PriorityOptionFieldComponent,
  category_option: CategoryOptionFieldComponent,
  user_reference: UserReferenceFieldComponent,
  entity_reference: EntityReferenceFieldComponent,
};
```

#### Tasks
1. **Field Type Components** (Day 4-5)
   - Create field renderers for each type
   - Implement validation based on field type
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

### Phase 3: Granular Live Updates (Week 2, Days 9-12)
**Goal**: Field-level WebSocket updates without full refetch

#### Enhanced WebSocket Protocol
```typescript
interface TableChangeNotification {
  organizationId: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  recordId: string;
  changes?: FieldChanges; // Field-level changes
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

#### Tasks
1. **Server-Side Change Tracking** (Day 9-10)
   - Implement field-level diff detection
   - Modify WebSocket payload structure
   - Location: `apps/server/src/services/websocket-notifications.ts`

2. **Client-Side Partial Updates** (Day 11)
   - Update `syncedVibeStack` to handle partial updates
   - Merge changes into existing Legend State observable
   - Location: `apps/web/src/stores/sync/synced-vibestack.ts`

3. **Optimistic Update Reconciliation** (Day 12)
   - Handle conflicts between optimistic and server updates
   - Implement conflict resolution UI
   - Location: `apps/web/src/stores/sync/conflict-resolver.ts`

### Phase 4: Schema Evolution UI (Week 2-3, Days 13-16)
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

### Legend State Enhancement
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

### Dynamic Form Generator
```typescript
export function DynamicEntityForm({ entityName, recordId, onSubmit, onCancel }) {
  const store = entity$(entityName);
  const schema = use$(store.schema);
  const record = recordId ? use$(store.records[recordId]) : null;
  
  // Generate form fields from schema
  const formFields = useMemo(() => {
    return [
      ...schema.fields.standard,
      ...schema.fields.custom
    ].map(field => ({
      name: field.name,
      component: FieldComponentRegistry[field.type],
      validation: field.validation,
      defaultValue: field.defaultValue
    }));
  }, [schema]);
  
  // ... form handling logic
}
```

### Performance Optimizations

#### Batched Field Updates
```typescript
class BatchedFieldUpdater {
  private updateQueue: Map<string, FieldUpdate[]> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  
  queueUpdate(recordId: string, field: string, value: any) {
    if (!this.updateQueue.has(recordId)) {
      this.updateQueue.set(recordId, []);
    }
    
    this.updateQueue.get(recordId)!.push({ field, value });
    
    // Debounce flush
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), 100);
  }
  
  async flush() {
    const updates = Array.from(this.updateQueue.entries());
    this.updateQueue.clear();
    
    // Batch update to server
    await fetch('/api/batch-update', {
      method: 'POST',
      body: JSON.stringify({ updates })
    });
  }
}
```

## Database Schema Extensions

### Custom Fields Table
```sql
-- Store custom field definitions per entity
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entity_name VARCHAR(255) NOT NULL,
  field_name VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  field_config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  UNIQUE(organization_id, entity_name, field_name)
);

-- Index for fast lookups
CREATE INDEX idx_custom_fields_org_entity 
  ON custom_field_definitions(organization_id, entity_name);
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

## Testing Strategy

### Unit Tests
```typescript
describe('Custom Field Rendering', () => {
  it('should render correct component for field type', () => {
    const field: FieldDefinition = {
      name: 'budget',
      type: 'decimal',
      required: true
    };
    
    const Component = FieldComponentRegistry[field.type];
    expect(Component).toBe(DecimalFieldComponent);
  });
});
```

### Integration Tests
```typescript
describe('Schema Evolution', () => {
  it('should handle field addition without data loss', async () => {
    // Add new field
    await addCustomField('project', {
      name: 'priority',
      type: 'priority_option'
    });
    
    // Verify existing data intact
    const projects = await getProjects();
    expect(projects).toHaveLength(10);
    expect(projects[0]).toHaveProperty('priority');
  });
});
```

## Timeline Summary
- **Week 1 (Days 1-8)**: Schema standardization & custom field rendering
- **Week 2 (Days 9-14)**: Granular updates & schema evolution UI (partial)
- **Week 2-3 (Days 15-16)**: Complete schema evolution & testing

## All Phases Summary

### Phase 1: Schema Standardization ✅
- Unified schema format
- TypeScript interfaces
- Legend Central store updates

### Phase 2: Custom Field Rendering ✅
- Field type components (17 types)
- Dynamic form generator
- Data grid enhancement

### Phase 3: Granular Live Updates ✅
- Field-level change tracking
- Partial store updates
- Conflict resolution

### Phase 4: Schema Evolution UI ✅
- Visual schema editor
- Migration preview
- Field usage analytics

## Next Steps
1. Begin Phase 1 implementation with schema endpoint update
2. Create shared TypeScript interfaces package
3. Set up testing infrastructure for custom fields
4. Implement field type components in parallel
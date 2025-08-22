# Technical Specification: Legend State & Archetype Alignment

## Architecture Overview

### Data Flow
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│ Legend State │────▶│  IndexedDB  │
│     UI      │◀────│   Store      │◀────│   Cache     │
└─────────────┘     └──────────────┘     └─────────────┘
       ▲                    │                     ▲
       │                    ▼                     │
       │            ┌──────────────┐             │
       │            │   Sync       │             │
       │            │   Adapter    │             │
       │            └──────────────┘             │
       │                    │                     │
       │                    ▼                     │
       │            ┌──────────────┐             │
       └────────────│  WebSocket   │             │
                    │   Updates    │             │
                    └──────────────┘             │
                            ▲                     │
                            │                     │
                    ┌──────────────┐             │
                    │   Server     │─────────────┘
                    │   API        │
                    └──────────────┘
                            │
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │   + RLS      │
                    └──────────────┘
```

## Component Architecture

### Client Components

#### 1. Legend State Store Enhancement
```typescript
// vibestack-legend-central.ts
interface EnhancedEntityStore {
  // Existing
  records: Observable<Record<string, EntityRecord>>;
  loading: Observable<boolean>;
  error: Observable<string | null>;
  
  // New additions
  schema: Observable<UnifiedEntitySchema>;
  customFields: Observable<CustomField[]>;
  pendingChanges: Observable<FieldChange[]>;
  conflictQueue: Observable<Conflict[]>;
}
```

#### 2. Field Component Registry
```typescript
// field-registry.ts
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
  discussion_type_option: DiscussionTypeFieldComponent,
  user_reference: UserReferenceFieldComponent,
  entity_reference: EntityReferenceFieldComponent,
};

interface FieldComponentProps {
  field: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
  readonly?: boolean;
}
```

#### 3. Dynamic Form Generator
```typescript
// DynamicEntityForm.tsx
interface DynamicEntityFormProps {
  entityName: string;
  recordId?: string; // For editing
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

export function DynamicEntityForm({ 
  entityName, 
  recordId, 
  onSubmit, 
  onCancel 
}: DynamicEntityFormProps) {
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

### Server Components

#### 1. Enhanced Schema Endpoint
```typescript
// organization-schema.ts
interface EnhancedSchemaResponse {
  organizationId: string;
  entities: Record<string, UnifiedEntitySchema>;
  relationships: EntityRelationship[];
  version: string;
  lastModified: string;
}

router.get('/api/organizations/:orgId/schema', async (c) => {
  const { orgId } = c.req.param();
  
  // Get base schema
  const baseSchema = await getOrgSchema(orgId);
  
  // Enhance with field metadata
  const enhancedSchema = await enhanceSchemaWithMetadata(baseSchema);
  
  // Add runtime statistics
  const schemaWithStats = await addSchemaStatistics(enhancedSchema);
  
  return c.json(schemaWithStats);
});
```

#### 2. Field-Level Change Tracker
```typescript
// change-tracker.ts
export class FieldChangeTracker {
  private previousState: Map<string, any> = new Map();
  
  trackChanges(
    tableName: string,
    recordId: string,
    newData: any,
    oldData: any
  ): FieldChange[] {
    const changes: FieldChange[] = [];
    
    for (const field in newData) {
      if (newData[field] !== oldData[field]) {
        changes.push({
          field,
          oldValue: oldData[field],
          newValue: newData[field],
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return changes;
  }
  
  generateChangeNotification(
    changes: FieldChange[],
    context: ChangeContext
  ): TableChangeNotification {
    return {
      organizationId: context.orgId,
      table: context.tableName,
      operation: context.operation,
      recordId: context.recordId,
      changes: changes.reduce((acc, change) => ({
        ...acc,
        [change.field]: {
          old: change.oldValue,
          new: change.newValue
        }
      }), {}),
      timestamp: new Date().toISOString(),
      userId: context.userId
    };
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

### Field Usage Analytics
```sql
-- Track field usage for analytics
CREATE TABLE field_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  field_name VARCHAR(255) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ,
  fill_rate DECIMAL(5,2), -- Percentage of records with non-null value
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Materialized view for quick stats
CREATE MATERIALIZED VIEW entity_field_stats AS
SELECT 
  organization_id,
  entity_name,
  COUNT(DISTINCT field_name) as total_fields,
  AVG(fill_rate) as avg_fill_rate,
  SUM(usage_count) as total_usage
FROM field_usage_stats
GROUP BY organization_id, entity_name;
```

## WebSocket Protocol Enhancement

### Message Types
```typescript
enum WSMessageType {
  // Existing
  TABLE_CHANGE = 'table_change',
  SYNC_REQUEST = 'sync_request',
  
  // New
  FIELD_UPDATE = 'field_update',
  SCHEMA_CHANGE = 'schema_change',
  BULK_UPDATE = 'bulk_update',
  CONFLICT_DETECTED = 'conflict_detected'
}

interface FieldUpdateMessage {
  type: WSMessageType.FIELD_UPDATE;
  payload: {
    table: string;
    recordId: string;
    field: string;
    value: any;
    previousValue: any;
    timestamp: string;
    userId: string;
  };
}

interface SchemaChangeMessage {
  type: WSMessageType.SCHEMA_CHANGE;
  payload: {
    entity: string;
    changeType: 'add_field' | 'remove_field' | 'modify_field';
    field: FieldDefinition;
    migrationId: string;
  };
}
```

## Performance Optimizations

### 1. Batched Field Updates
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

### 2. Smart Caching Strategy
```typescript
interface CacheStrategy {
  // Cache frequently accessed fields in memory
  hotFields: Set<string>;
  
  // Prefetch related entities
  prefetchRelations: boolean;
  
  // TTL for cached data
  cacheTTL: number;
  
  // Maximum cache size
  maxCacheSize: number;
}

const defaultCacheStrategy: CacheStrategy = {
  hotFields: new Set(['id', 'name', 'status', 'updated_at']),
  prefetchRelations: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 100 * 1024 * 1024 // 100MB
};
```

## Migration Strategy

### Phase 1: Non-Breaking Changes
1. Add new schema endpoint alongside existing
2. Enhance Legend State store without breaking existing code
3. Add custom field components as opt-in feature

### Phase 2: Progressive Migration
1. Update components to use new schema format
2. Migrate one entity type at a time
3. Maintain backward compatibility layer

### Phase 3: Cleanup
1. Remove legacy schema endpoint
2. Delete unused store methods
3. Optimize bundle size

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

### E2E Tests
```typescript
test('Custom field CRUD operations', async ({ page }) => {
  // Navigate to entity page
  await page.goto('/entities/project');
  
  // Add custom field
  await page.click('[data-testid="add-field"]');
  await page.fill('[name="fieldName"]', 'budget');
  await page.selectOption('[name="fieldType"]', 'decimal');
  await page.click('[data-testid="save-field"]');
  
  // Verify field appears in form
  await page.click('[data-testid="add-record"]');
  await expect(page.locator('[name="budget"]')).toBeVisible();
});
```

## Monitoring & Observability

### Key Metrics
1. **Schema sync latency**: Time to propagate schema changes
2. **Field update latency**: Time for field changes to appear
3. **Conflict rate**: Percentage of updates with conflicts
4. **Cache hit rate**: Percentage of reads from cache
5. **Migration success rate**: Percentage of successful migrations

### Logging
```typescript
const logger = {
  schemaChange: (entity: string, change: any) => {
    console.log('[SCHEMA]', { entity, change, timestamp: Date.now() });
  },
  
  fieldUpdate: (record: string, field: string, latency: number) => {
    console.log('[FIELD_UPDATE]', { record, field, latency });
  },
  
  conflictDetected: (record: string, conflicts: any[]) => {
    console.warn('[CONFLICT]', { record, conflicts });
  }
};
```

## Security Considerations

### Field-Level Permissions
```typescript
interface FieldPermission {
  field: string;
  read: string[]; // Role names
  write: string[]; // Role names
}

function checkFieldPermission(
  field: string,
  operation: 'read' | 'write',
  userRole: string,
  permissions: FieldPermission[]
): boolean {
  const perm = permissions.find(p => p.field === field);
  if (!perm) return true; // No restriction
  
  const allowedRoles = perm[operation];
  return allowedRoles.includes(userRole);
}
```

### Data Validation
```typescript
interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
  validator?: (value: any) => boolean;
}

function validateField(
  value: any,
  rules: ValidationRule[]
): ValidationResult {
  for (const rule of rules) {
    if (!checkRule(value, rule)) {
      return { valid: false, error: rule.message };
    }
  }
  return { valid: true };
}
```
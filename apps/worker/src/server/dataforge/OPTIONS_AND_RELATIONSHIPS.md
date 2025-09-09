# DataForge Options and Relationship System

*Comprehensive guide to the DataForge options management and relationship handling system.*

## Overview

DataForge provides a sophisticated system for managing dropdown options and entity relationships with two complementary subsystems:

1. **Options System**: Manages dropdown values for UI components with system-wide and organization-specific options
2. **Relationship System**: Handles complex entity-to-entity relationships using per-organization relationship tables

## Options System Architecture

### Core Components

#### 1. System Options
Global options available to all organizations, defined at the archetype level.

**Database Tables:**
- `system_option_sets` - Define option sets by archetype and type
- `system_options` - Individual option values with metadata

```sql
-- Example: Task priority options
INSERT INTO system_option_sets (option_set_type, archetype, name) 
VALUES ('priority', 'task', 'Task Priority Levels');

INSERT INTO system_options (option_set_id, value, label, color, sort_order)
VALUES 
  (1, 'low', 'Low Priority', '#10B981', 1),
  (1, 'medium', 'Medium Priority', '#F59E0B', 2),
  (1, 'high', 'High Priority', '#EF4444', 3),
  (1, 'critical', 'Critical Priority', '#DC2626', 4);
```

#### 2. Custom Options
Organization-specific options that can be customized per organization.

**Database Tables:**
- `custom_option_sets` - Define organization-specific option sets
- `custom_options` - Individual option values for the organization

```sql
-- Example: Wide Corp departments
INSERT INTO custom_option_sets (org_id, name, description)
VALUES ('01920000-1000-7000-8000-000000000001', 'departments', 'Company Departments');

INSERT INTO custom_options (option_set_id, value, label, color, sort_order)
VALUES 
  (1, 'engineering', 'Engineering', '#3B82F6', 1),
  (1, 'marketing', 'Marketing', '#EC4899', 2),
  (1, 'sales', 'Sales', '#10B981', 3);
```

### Client-Side Integration

#### Legend State Options Manager

The `OptionsManager` provides reactive state management for both system and custom options:

```typescript
import { OptionsManager } from '@/legend-state/reference-system/options-manager';

// Get system options (cached and reactive)
const taskPriorityOptions$ = OptionsManager.getSystemOptions('priority', 'task');

// Get custom options for organization
const departmentOptions$ = OptionsManager.getCustomOptions('departments');

// Resolve option values to full objects
const priorityOption = OptionsManager.resolveSystemOption('priority', 'task', 'high');
// Returns: { value: 'high', label: 'High Priority', color: '#EF4444', ... }
```

#### API Endpoints

**System Options:**
```bash
GET /api/dataforge/system-options/:optionType/:archetype
# Example: GET /api/dataforge/system-options/priority/task
```

**Custom Options:**
```bash
GET /api/dataforge/orgs/:orgId/custom-options/:optionSetName
# Example: GET /api/dataforge/orgs/01920000.../custom-options/departments
```

### Common Option Types

#### Task Archetype
- `priority`: low, medium, high, critical
- `status`: todo, in_progress, done, cancelled, blocked
- `category`: feature, bug, improvement, task, epic

#### Project Archetype  
- `priority`: low, medium, high, critical
- `status`: planning, active, on_hold, completed, cancelled
- `category`: software, research, marketing, operational, strategic

#### Record Archetype
- `priority`: low, medium, high, critical
- `status`: draft, active, archived, deleted
- `category`: general, important, reference, temporary

## Relationship System Architecture

### Core Concepts

The relationship system transforms reference fields (`user_reference`, `entity_reference`) from archetype definitions into proper many-to-many relationships stored in per-organization relationship tables.

#### Key Benefits
- **No Foreign Key Columns**: Reference fields don't create table columns
- **Rich Metadata**: Relationships can store complex properties
- **Temporal Support**: Track relationship changes over time
- **Flexible Cardinality**: Support one-to-one, one-to-many, many-to-many
- **Organization Isolation**: Per-org relationship tables ensure data separation

### Database Schema

#### Per-Organization Relationship Tables
Each organization gets its own relationship table:

```sql
-- Example: org_01920000_1000_7000_8000_000000000001_relationships
CREATE TABLE org_xxx_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_type TEXT NOT NULL,        -- 'Task'
  source_entity_id UUID NOT NULL,          -- Task ID
  target_entity_type TEXT NOT NULL,        -- 'User' or 'Project'
  target_entity_id UUID NOT NULL,          -- User/Project ID
  relationship_type TEXT NOT NULL,         -- 'assigned_to', 'belongs_to'
  field_name TEXT NOT NULL,                -- Original field from archetype
  properties JSONB DEFAULT '{}',           -- Rich metadata
  valid_from TIMESTAMP DEFAULT now(),      -- Temporal support
  valid_until TIMESTAMP,                   -- NULL = currently active
  created_at TIMESTAMP DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP,
  updated_by UUID
);
```

#### Relationship Field Configuration
Stores metadata about relationship fields:

```sql
CREATE TABLE dataforge_relationship_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,              -- Source entity type
  field_name TEXT NOT NULL,               -- Original field name
  relationship_type TEXT NOT NULL,        -- Derived relationship type
  target_entity_type TEXT NOT NULL,       -- Target entity type
  cardinality TEXT NOT NULL,              -- Relationship cardinality
  display_format TEXT,                    -- How to display in UI
  ui_config JSONB DEFAULT '{}',           -- UI configuration
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP
);
```

### Reference Field Processing

#### 1. Field Detection and Transformation

When creating entities with reference fields, the `RelationshipFieldHandler` processes them:

```typescript
// Task archetype definition includes:
{
  assignee_id: 'user_reference',      // → assigned_to relationship
  parent_task_id: 'entity_reference', // → subtask_of relationship  
  project_id: 'entity_reference'      // → belongs_to relationship
}

// These fields are:
// 1. EXCLUDED from table creation (no columns)
// 2. CONVERTED to relationship metadata
// 3. STORED in relationship configuration table
```

#### 2. Relationship Type Inference

The system automatically infers relationship types from field names:

```typescript
const relationshipPatterns = {
  'assignee_id': 'assigned_to',
  'owner_id': 'owned_by',
  'parent_task_id': 'subtask_of',
  'parent_document_id': 'child_of',
  'project_id': 'belongs_to',
  'manager_id': 'managed_by'
  // ... and many more
};
```

#### 3. Target Entity Type Resolution

```typescript
const targetEntityPatterns = {
  'assignee_id': 'User',        // user_reference always → User
  'parent_task_id': 'Task',     // Inferred from field name
  'project_id': 'Project',      // Inferred from field name
  'invoice_id': 'Invoice'       // Inferred from field name
};
```

### Relationship Operations

#### Creating Relationships

When setting reference field values in entity records:

```typescript
// Creating a task with relationships
await entityManager.createRecord('Task', {
  title: 'Implement feature',
  assignee_id: 'user-123',      // Creates assigned_to relationship
  project_id: 'project-456'     // Creates belongs_to relationship
});

// This creates entries in org_xxx_relationships table:
// 1. Task → User (assigned_to)
// 2. Task → Project (belongs_to)
```

#### Querying Relationships

```typescript
// Get all relationships for a task
const relationships = await RelationshipFieldHandler.getRelationships(
  kysely, 
  orgId, 
  'Task', 
  'task-123'
);

// Get specific relationship type
const assignees = await RelationshipFieldHandler.getRelationships(
  kysely, 
  orgId, 
  'Task', 
  'task-123', 
  'assigned_to'
);
```

### Rich Relationship Properties

Relationships can store complex metadata:

```typescript
// Assigned relationship with effort allocation
{
  source_entity_type: 'Task',
  target_entity_type: 'User', 
  relationship_type: 'assigned_to',
  properties: {
    role: 'primary_assignee',
    effort_percentage: 60,
    start_date: '2024-09-01',
    specialization: 'frontend'
  }
}

// Project membership with role information
{
  source_entity_type: 'User',
  target_entity_type: 'Project',
  relationship_type: 'member_of', 
  properties: {
    role: 'tech_lead',
    joined_date: '2024-01-15',
    permissions: ['read', 'write', 'admin'],
    hourly_rate: 150.00
  }
}
```

### Cardinality Support

The system supports all relationship cardinalities:

#### Many-to-Many (Default)
```typescript
// Users can be assigned to multiple tasks
// Tasks can have multiple assignees
relationship_type: 'assigned_to',
cardinality: 'many-to-many'
```

#### Many-to-One  
```typescript
// Many tasks belong to one project
// One project has many tasks
relationship_type: 'belongs_to', 
cardinality: 'many-to-one'
```

#### One-to-Many
```typescript
// One user owns many tasks
// Each task has one owner
relationship_type: 'owned_by',
cardinality: 'one-to-many'
```

#### One-to-One
```typescript
// Each user has one profile
// Each profile belongs to one user  
relationship_type: 'has_profile',
cardinality: 'one-to-one'
```

## Integration Patterns

### Entity Creation with Options and Relationships

```typescript
// Create entity with both custom options and relationships
const result = await entityManager.createEntityFromArchetype({
  entityName: 'TeamTask',
  archetype: 'task',
  customFields: [
    // Custom options field
    { 
      name: 'department', 
      type: 'select',
      enum: ['engineering', 'marketing', 'sales'] // Links to custom options
    },
    // Regular custom field
    {
      name: 'story_points',
      type: 'integer', 
      defaultValue: 1
    }
  ]
  // Relationship fields from Task archetype are automatically processed:
  // - assignee_id: user_reference → assigned_to relationship
  // - project_id: entity_reference → belongs_to relationship
});
```

### UI Component Integration

```typescript
// React component using both systems
import { OptionsManager } from '@/legend-state/reference-system/options-manager';
import { observer } from '@legendapp/state/react';

const TaskForm = observer(() => {
  // Get reactive options
  const priorityOptions = OptionsManager.getSystemOptions('priority', 'task');
  const departmentOptions = OptionsManager.getCustomOptions('departments');
  
  return (
    <form>
      {/* System option dropdown */}
      <Select 
        label="Priority"
        options={priorityOptions.get()?.options || []}
        value={task.priority}
        onChange={(value) => task.priority.set(value)}
      />
      
      {/* Custom option dropdown */}
      <Select
        label="Department" 
        options={departmentOptions.get()?.options || []}
        value={task.department}
        onChange={(value) => task.department.set(value)}
      />
      
      {/* Relationship field (handled by VibeGrid) */}
      <RelationshipSelector
        entityType="Task"
        fieldName="assignee_id"
        relationshipType="assigned_to" 
        targetEntityType="User"
        value={task.assignee_id}
        onChange={(value) => task.assignee_id.set(value)}
      />
    </form>
  );
});
```

## Testing and Development

### Seeding Options Data

```typescript
// System options seeding
await kysely.insertInto('system_option_sets').values([
  { option_set_type: 'priority', archetype: 'task', name: 'Task Priorities' },
  { option_set_type: 'status', archetype: 'task', name: 'Task Statuses' },
  { option_set_type: 'category', archetype: 'task', name: 'Task Categories' }
]);

await kysely.insertInto('system_options').values([
  // Task priorities
  { option_set_id: 1, value: 'low', label: 'Low', color: '#10B981', sort_order: 1 },
  { option_set_id: 1, value: 'medium', label: 'Medium', color: '#F59E0B', sort_order: 2 },
  { option_set_id: 1, value: 'high', label: 'High', color: '#EF4444', sort_order: 3 },
  
  // Task statuses  
  { option_set_id: 2, value: 'todo', label: 'To Do', color: '#6B7280', sort_order: 1 },
  { option_set_id: 2, value: 'in_progress', label: 'In Progress', color: '#3B82F6', sort_order: 2 },
  { option_set_id: 2, value: 'done', label: 'Done', color: '#10B981', sort_order: 3 }
]);
```

### Testing Relationship Creation

```typescript
// Test relationship creation
const taskId = await entityManager.createRecord('Task', {
  title: 'Test task',
  assignee_id: 'user-123',  // Should create relationship
  project_id: 'project-456' // Should create relationship
});

// Verify relationships were created
const relationships = await RelationshipFieldHandler.getRelationships(
  kysely, orgId, 'Task', taskId
);

assert(relationships.length === 2);
assert(relationships.find(r => r.relationship_type === 'assigned_to'));
assert(relationships.find(r => r.relationship_type === 'belongs_to'));
```

## Best Practices

### 1. Option Set Naming
- **System Options**: Use descriptive type names (`priority`, `status`, `category`)
- **Custom Options**: Use business domain names (`departments`, `client_tiers`, `project_phases`)

### 2. Relationship Field Naming
- Follow conventions: `assignee_id`, `owner_id`, `parent_*_id`, `project_id`
- Use descriptive names that clearly indicate the target entity type
- Avoid generic names like `related_id` or `link_id`

### 3. Performance Considerations
- **Options**: Cached at client-side, minimal database load
- **Relationships**: Indexed properly, query by source/target efficiently
- **Temporal Data**: Use `valid_until IS NULL` for active relationships

### 4. Data Integrity
- **Options**: Use consistent value formats (lowercase, no spaces)
- **Relationships**: Always specify cardinality constraints
- **Field Names**: Maintain consistent naming across archetypes

## Migration and Evolution

### Adding New Option Types

```sql
-- 1. Add system option set
INSERT INTO system_option_sets (option_set_type, archetype, name)
VALUES ('complexity', 'task', 'Task Complexity Levels');

-- 2. Add options
INSERT INTO system_options (option_set_id, value, label, color, sort_order)
VALUES 
  (new_set_id, 'simple', 'Simple', '#10B981', 1),
  (new_set_id, 'moderate', 'Moderate', '#F59E0B', 2),
  (new_set_id, 'complex', 'Complex', '#EF4444', 3);
```

### Adding New Relationship Types

```typescript
// Update RelationshipFieldHandler patterns
private static inferRelationshipType(fieldName: string): string {
  const patterns = {
    // Existing patterns...
    'reviewer_id': 'reviewed_by',     // New pattern
    'approver_id': 'approved_by',     // New pattern  
    'mentor_id': 'mentored_by'        // New pattern
  };
  
  return patterns[fieldName] || 'relates_to';
}
```

## Troubleshooting

### Common Issues

#### 1. Options Not Loading
```typescript
// Check if option set exists
const optionSet = await kysely
  .selectFrom('system_option_sets')
  .where('option_set_type', '=', 'priority')
  .where('archetype', '=', 'task')
  .selectAll()
  .execute();

// Check Legend State cache
OptionsManager.clearCache(); // Clear and reload
```

#### 2. Relationships Not Created
```typescript
// Verify field is recognized as relationship field
const isRelationshipField = RelationshipFieldHandler.isRelationshipField('user_reference');

// Check if relationship table exists
const tableExists = await RelationshipFieldHandler.checkRelationshipTableExists(
  kysely, 
  `org_${orgId.replace(/-/g, '_')}_relationships`
);
```

#### 3. Performance Issues
- **Options**: Ensure proper indexing on `option_set_id` and `sort_order`
- **Relationships**: Index on `source_entity_type`, `source_entity_id`, `target_entity_type`
- **Temporal Queries**: Always filter by `valid_until IS NULL` for active relationships

### Debug Tools

```typescript
// Debug options loading
console.log('Options cache:', OptionsManager._store$.peek());
console.log('Option resolvers:', OptionsManager._resolvers$.peek());

// Debug relationships
const debug = await RelationshipFieldHandler.getRelationships(kysely, orgId, entityType, entityId);
console.log('All relationships:', debug);
```

## Future Enhancements

### Planned Features

1. **Conditional Options**: Options that change based on other field values
2. **Option Dependencies**: Hierarchical options (e.g., Country → State → City)
3. **Relationship Constraints**: Enforce cardinality and business rules
4. **Relationship History**: Full audit trail of relationship changes
5. **Bulk Relationship Operations**: Efficient mass relationship updates

### API Enhancements

1. **GraphQL Integration**: Native GraphQL support for relationship traversal
2. **Real-time Updates**: WebSocket notifications for option/relationship changes  
3. **Batch Operations**: Bulk create/update/delete for relationships
4. **Advanced Queries**: Complex relationship queries with filtering

This comprehensive system provides a solid foundation for managing both simple dropdown options and complex entity relationships in DataForge, with strong separation of concerns and excellent performance characteristics.
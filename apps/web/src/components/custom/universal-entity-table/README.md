# Universal Entity Table - Complete Editing Features

The Universal Entity Table now includes all the modular editing features from the original data-table implementation:

## 🎯 Complete Feature Set

✅ **Universal Reactive Data Pattern**: Route loader data + live queries  
✅ **Inline Editing**: Text, numbers, dates, booleans, select dropdowns  
✅ **Relationship Editing**: Single-select and multi-select foreign keys  
✅ **Bulk Actions**: Delete, quick edit, custom actions  
✅ **Bulk Editing**: Quick dropdown edit for multiple records  
✅ **New Record Creation**: Inline record creation with validation  
✅ **Optimistic Updates**: TanStack Query integration  
✅ **Content Width Constraints**: TasksEnhanced pattern  
✅ **State Persistence**: Across navigation  
✅ **Modular Architecture**: Reusable components  

## 📁 Modular Architecture

```
universal-entity-table/
├── index.tsx                          # Main exports
├── universal-entity-table.tsx         # Core orchestration
├── universal-entity-table-types.ts    # TypeScript interfaces
├── entity-table-columns.tsx           # Column utilities
├── entity-table-toolbar.tsx           # Search, filters, view options
├── entity-table-bulk-actions.tsx      # Bulk delete/custom actions
├── entity-table-bulk-editing.tsx      # Quick edit dropdowns
├── entity-table-editing.tsx           # Inline editing cells
└── entity-table-relationship-cells.tsx # Foreign key editing
```

## 🚀 Basic Usage

```tsx
import { UniversalEntityTable, createTaskColumns } from '@/components/custom/universal-entity-table'

// Basic data display
<UniversalEntityTable<Task>
  entityType="tasks"
  columns={createTaskColumns()}
  loaderData={loaderData.tasks}
  liveQueryBuilder={taskQueryBuilder}
/>
```

## ✏️ Full Editing Setup

```tsx
import { 
  UniversalEntityTable, 
  createTaskColumns,
  EditableTextCell,
  EditableSelectCell,
  EditableFilterableRelationshipCell
} from '@/components/custom/universal-entity-table'

// Create columns with editing capabilities
const editableTaskColumns = () => [
  createSelectionColumn<Task>(),
  createTextColumn<Task>('title', 'Title', { fontWeight: 'medium' }),
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue, row, column, table }) => (
      <EditableSelectCell
        getValue={getValue}
        row={row}
        column={column}
        table={table}
        options={[
          { label: 'Open', value: 'OPEN' },
          { label: 'In Progress', value: 'IN_PROGRESS' },
          { label: 'Completed', value: 'COMPLETED' }
        ]}
      />
    )
  },
  {
    accessorKey: 'projectId',
    header: 'Project',
    cell: ({ getValue, row, column, table }) => (
      <EditableFilterableRelationshipCell
        getValue={getValue}
        row={row}
        column={column}
        table={table}
        relationshipConfig={{
          fetchAll: () => ProjectService.findAll(),
          fetchOne: (id) => ProjectService.findById(id),
          getEntityId: (project) => project.id,
          getDisplayValue: (project) => project.name,
          emptyLabel: 'No Project'
        }}
      />
    )
  },
  createDateColumn<Task>('createdAt', 'Created')
]

// Full-featured table with all editing
<UniversalEntityTable<Task>
  entityType="tasks"
  columns={editableTaskColumns()}
  loaderData={loaderData.tasks}
  liveQueryBuilder={taskQueryBuilder}
  service={TaskService}
  enableBulkActions={true}
  enableInlineEdit={true}
  enableOptimisticUpdates={true}
  useContentWidth={true}
  title="Task Management"
  onEntityCreated={(task) => console.log('Created:', task)}
  onEntityUpdated={(task) => console.log('Updated:', task)}
  onEntityDeleted={(id) => console.log('Deleted:', id)}
/>
```

## 🔧 Service Layer Interface

Your service must implement these methods for full functionality:

```tsx
interface EntityService<T> {
  // CRUD Operations
  create: (data: Partial<T>) => Promise<T>
  update: (id: string, data: Partial<T>) => Promise<T>
  delete: (id: string) => Promise<void>
  
  // Bulk Operations (optional - fallback to individual calls)
  bulkUpdate?: (ids: string[], data: Partial<T>) => Promise<void>
  bulkDelete?: (ids: string[]) => Promise<void>
}
```

## 📝 Inline Editing Components

### Text Fields
```tsx
<EditableTextCell
  getValue={getValue}
  row={row}
  column={column}
  table={table}
  createMode={false}
  required={false}
  optimisticUpdates={true}
/>
```

### Select Dropdowns
```tsx
<EditableSelectCell
  options={[
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' }
  ]}
  // ... other props
/>
```

### Date Pickers
```tsx
<EditableDateCell
  // Uses calendar popup for date selection
  // ... props
/>
```

### Checkboxes
```tsx
<EditableCheckboxCell
  // For boolean values
  // ... props
/>
```

### Numbers
```tsx
<EditableNumberCell
  // Validates numeric input
  // ... props
/>
```

## 🔗 Relationship Editing

### Single-Select Foreign Keys
```tsx
<EditableFilterableRelationshipCell
  relationshipConfig={{
    fetchAll: () => UserService.findAll(),
    fetchOne: (id) => UserService.findById(id),
    getEntityId: (user) => user.id,
    getDisplayValue: (user) => `${user.firstName} ${user.lastName}`,
    emptyLabel: 'Unassigned'
  }}
  // ... other props
/>
```

### Multi-Select (Many-to-Many)
```tsx
<EditableMultiSelectRelationshipCell
  relationshipConfig={{
    fetchAll: () => TagService.findAll(),
    fetchOne: (id) => TagService.findById(id),
    getEntityId: (tag) => tag.id,
    getDisplayValue: (tag) => tag.name,
    emptyLabel: 'No Tags'
  }}
  // Returns array of IDs
/>
```

## 📦 Bulk Operations

### Quick Edit Toolbar
Automatically includes common bulk edit fields:
- Tasks: Status, Priority
- Projects: Status  
- Users: Active status

### Custom Bulk Actions
```tsx
const customBulkActions: BulkActionConfig<Task>[] = [
  {
    id: 'archive',
    label: 'Archive',
    icon: Archive,
    action: async (selectedIds, entities) => {
      await TaskService.bulkUpdate(selectedIds, { archived: true })
    },
    confirmMessage: 'Archive selected tasks?'
  }
]

<UniversalEntityTable
  // ... other props
  customActions={customBulkActions}
/>
```

## 🎨 Table Meta Configuration

The table requires meta configuration for editing:

```tsx
const table = useReactTable({
  // ... other config
  meta: {
    editableColumns: ['title', 'status', 'projectId'], // Which columns are editable
    onUpdate: async (rowId: string, columnId: string, value: any) => {
      // Handle individual cell updates
      await service.update(rowId, { [columnId]: value })
    }
  }
})
```

## 🎯 Universal Reactive Data Pattern

```tsx
// 1. Route loader provides instant data
export const loader = async () => {
  return {
    tasks: await TaskService.findAll()
  }
}

// 2. Component uses loader data immediately + live queries for updates
function TasksPage() {
  const loaderData = useLoaderData<typeof loader>()
  
  const taskQueryBuilder = (qb: SelectQueryBuilder<Task>) => 
    qb.orderBy('createdAt', 'DESC')
  
  return (
    <UniversalEntityTable<Task>
      loaderData={loaderData.tasks}    // Instant loading
      liveQueryBuilder={taskQueryBuilder} // Live updates
      // ... other props
    />
  )
}
```

## 🎁 Column Presets

Pre-built column configurations for common entities:

```tsx
import { createTaskColumns, createProjectColumns, createUserColumns } from './entity-column-presets'

// Ready-to-use column definitions with editing
<UniversalEntityTable columns={createTaskColumns()} />
<UniversalEntityTable columns={createProjectColumns()} />
<UniversalEntityTable columns={createUserColumns()} />
```

This architecture provides the complete editing functionality from the original data-table while maintaining modularity and universal entity support. 
# Enhanced Data Table Modernization Plan

## Overview
Transform `enhanced-data-table.tsx` into a comprehensive, enterprise-grade table component with Universal Reactive Data Pattern integration and React Suspense support. **TypeORM entity integration with explicit column definitions** - type safety without auto-generation complexity.

## Target Architecture: Flat File Structure
```
apps/web/src/components/enhanced-table/
├── enhanced-data-table.tsx              # Main Suspense wrapper
├── enhanced-data-table-internal.tsx     # Core implementation
├── enhanced-data-table-types.ts         # All TypeScript interfaces
├── enhanced-table-toolbar.ts            # All toolbar components
├── enhanced-table-cells.ts              # TypeORM-aware cell helpers
├── enhanced-table-bulk-actions.ts       # Bulk actions & editing
├── enhanced-table-width-constraints.ts  # Width calculation logic
├── enhanced-table-state.ts              # State management hooks
├── enhanced-table-optimistic.ts         # Optimistic update utilities
├── enhanced-table-error.ts              # Error handling & boundaries
└── enhanced-table-skeleton.ts           # Loading skeletons
```

---

## Phase 1: Core Infrastructure ⏳

### File Structure Setup
- [ ] Create `enhanced-data-table-types.ts` with all interfaces
- [ ] Create `enhanced-data-table-internal.tsx` skeleton
- [ ] Create `enhanced-table-width-constraints.ts` skeleton
- [ ] Create `enhanced-table-state.ts` skeleton
- [ ] Create `enhanced-table-optimistic.ts` skeleton
- [ ] Create `enhanced-table-error.ts` skeleton
- [ ] Create `enhanced-table-skeleton.ts` skeleton

### Suspense Integration
- [ ] Wrap current component with Suspense boundary in main file
- [ ] Implement `EnhancedDataTableSkeleton` component
- [ ] Add error boundary integration
- [ ] Test Suspense loading states

### Optimistic Updates Foundation
- [ ] Create `enhanced-table-optimistic.ts` with core utilities:
  - [ ] `useOptimisticEntity<T>` hook for entity updates
  - [ ] Optimistic action types (update, delete, create)
  - [ ] Rollback mechanisms for failed operations
  - [ ] Visual state indicators for pending operations
- [ ] Add optimistic update types to main types file
- [ ] Test basic optimistic update patterns
- [ ] Integrate with table meta for cell-level optimistic states

### Content Width Integration (TasksEnhanced Pattern)
- [ ] Import `useContentWidth` from layout store
- [ ] Port width constraint calculation logic from TasksEnhanced
- [ ] Implement the exact wrapper pattern:
  - [ ] Outer container: `w-full overflow-x-auto`
  - [ ] Inner sizing div: `inline-block align-middle` with calculated width
  - [ ] Table wrapper: `border rounded-md`
- [ ] Add debug info display (development only)
- [ ] Test width calculations with sidebar toggle

### Universal Reactive Data Pattern
- Router loaders provide instant entity data
- Live queries provide real-time entity updates
- Smart fallbacks ensure data availability
- Suspense handles loading states declaratively
- **Optimistic updates provide instant user feedback**

## Optimistic Update Utilities 🚀

### TanStack Query Built-in Optimistic Updates (`enhanced-table-optimistic.ts`)

**Note**: Domain services now use TanStack Query's built-in optimistic updates via `onMutate`, `onError`, and `onSettled`. This provides a cleaner, more reliable approach than React's `useOptimistic`.

```typescript
// Enhanced table integrates directly with TanStack Query mutations
export function useTableMutations<T extends { id: string }>(
  entityType: string,
  service: {
    update?: (id: string, data: Partial<T>) => Promise<T>,
    delete?: (id: string) => Promise<void>,
    create?: (data: Partial<T>) => Promise<T>
  }
) {
  // Get mutations from domain services (they already have optimistic updates built-in)
  const updateMutation = service.update ? useUpdateEntity(entityType) : null
  const deleteMutation = service.delete ? useDeleteEntity(entityType) : null
  const createMutation = service.create ? useCreateEntity(entityType) : null

  // Bulk operations using individual mutations
  const bulkUpdate = async (ids: string[], data: Partial<T>) => {
    if (!updateMutation) return
    
    // Each mutation has its own optimistic update built-in
    const promises = ids.map(id => updateMutation.mutateAsync({ id, data }))
    await Promise.allSettled(promises)
  }

  const bulkDelete = async (ids: string[]) => {
    if (!deleteMutation) return
    
    // Each mutation has its own optimistic update built-in
    const promises = ids.map(id => deleteMutation.mutateAsync(id))
    await Promise.allSettled(promises)
  }

  return {
    update: updateMutation,
    delete: deleteMutation,
    create: createMutation,
    bulkUpdate,
    bulkDelete,
    // Mutation states are available from individual mutations
    isUpdating: updateMutation?.isPending,
    isDeleting: deleteMutation?.isPending,
    isCreating: createMutation?.isPending,
  }
}

// Cell-level optimistic state indicator (reads from TanStack Query mutation state)
export function OptimisticStateIndicator({ 
  rowId,
  mutation,
  children 
}: {
  rowId: string
  mutation?: { isPending: boolean, variables?: any }
  children: React.ReactNode
}) {
  const isOptimistic = mutation?.isPending && 
    (mutation.variables?.id === rowId || mutation.variables?.some?.((v: any) => v.id === rowId))

  return (
    <div className={cn(
      "relative",
      isOptimistic && "opacity-70 pointer-events-none"
    )}>
      {children}
      {isOptimistic && (
        <div className="absolute inset-0 flex items-center justify-end pr-2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}

// Bulk operation state management
export function useBulkOperationState() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPerformingBulkOperation, setIsPerformingBulkOperation] = useState(false)

  const performBulkOperation = async (operation: () => Promise<void>) => {
    setIsPerformingBulkOperation(true)
    try {
      await operation()
      setSelectedIds([]) // Clear selection on success
    } catch (error) {
      console.error('Bulk operation failed:', error)
      throw error
    } finally {
      setIsPerformingBulkOperation(false)
    }
  }

  return {
    selectedIds,
    setSelectedIds,
    isPerformingBulkOperation,
    performBulkOperation,
  }
}

### Integration with Enhanced Data Table
```typescript
// In the main table component - simplified without useOptimistic
function EnhancedDataTable<T extends { id: string }>({
  loaderData,
  liveQueryBuilder,
  service,
  columns,
  ...props
}: EnhancedDataTableProps<T>) {
  // Get live data from Universal Reactive Data Pattern  
  const liveData = useSuspenseEntity(loaderData, liveQueryBuilder)
  
  // Use TanStack Query mutations (domain services handle optimistic updates)
  const mutations = useTableMutations(props.entityType, service)
  const bulkState = useBulkOperationState()

  // Table data comes directly from live queries + TanStack Query cache
  // (Domain service mutations automatically update the cache optimistically)
  const tableData = liveData

  // Pass mutation states to table meta for cell access
  const table = useReactTable({
    data: tableData,
    columns,
    meta: {
      mutations,
      bulkState,
      onUpdate: async (id: string, field: string, value: any) => {
        if (mutations.update) {
          await mutations.update.mutateAsync({ id, data: { [field]: value } })
        }
      },
      onDelete: async (id: string) => {
        if (mutations.delete) {
          await mutations.delete.mutateAsync(id)
        }
      },
    },
    // ... other table config
  })

  return (
    <div>
      {/* Bulk actions toolbar */}
      {bulkState.selectedIds.length > 0 && (
        <div className="flex gap-2 p-2 bg-muted">
          <Button
            variant="destructive"
            size="sm"
            disabled={bulkState.isPerformingBulkOperation}
            onClick={() => bulkState.performBulkOperation(async () => {
              await mutations.bulkDelete(bulkState.selectedIds)
            })}
          >
            Delete {bulkState.selectedIds.length} items
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={bulkState.isPerformingBulkOperation}
            onClick={() => bulkState.performBulkOperation(async () => {
              await mutations.bulkUpdate(bulkState.selectedIds, { status: 'completed' })
            })}
          >
            Mark {bulkState.selectedIds.length} as completed
          </Button>
        </div>
      )}
      
      {/* Table renders with live data + optimistic updates from TanStack Query */}
      <Table table={table} />
    </div>
  )
}
```

### Benefits of TanStack Query Optimistic Updates vs useOptimistic

✅ **Built-in Cache Management**
- Automatically updates all related cache keys
- Handles complex relationships between entities
- No manual state synchronization needed

✅ **Race Condition Prevention**
- `cancelQueries` prevents conflicting updates
- Atomic rollback on errors
- Consistent cache state

✅ **Type Safety**
- Full TypeScript support with proper context types
- Type-safe rollback mechanisms
- Inferred mutation variables

✅ **Error Handling**
- Automatic rollback via `onError`
- Context preservation for complex scenarios
- Integration with error boundaries

✅ **Performance**
- Only updates necessary cache entries
- Batched invalidations via `onSettled`
- Smart query deduplication

✅ **Integration with Live Queries**
- `onMutate`: Immediate optimistic update
- Live queries: Background sync for eventual consistency
- `onSettled`: Final cache refresh
- Perfect harmony between optimistic updates and real-time sync

---

## Phase 2: TypeORM Entity Integration ⏳

### Entity Type Safety
- [ ] Add generic `<T extends ObjectLiteral & { id: string }>` constraint
- [ ] Implement TypeORM entity type integration
- [ ] Add `ColumnDef<T, any>[]` with proper entity typing
- [ ] Test type safety with various entity types (Task, Project, User)
- [ ] Ensure IntelliSense works for entity properties

### Service Integration with Optimistic Updates
- [ ] Add TypeORM service integration:
  - [ ] `service.update: (id: string, data: Partial<T>) => Promise<T>`
  - [ ] `service.delete: (id: string) => Promise<void>`
  - [ ] `service.create: (data: Partial<T>) => Promise<T>`
- [ ] **Integrate `useOptimistic` for instant UI updates**:
  - [ ] Optimistic updates for inline edits
  - [ ] Optimistic updates for bulk actions
  - [ ] Optimistic updates for record creation
  - [ ] Rollback on service errors
- [ ] Test service integration with domain services
- [ ] Handle service errors gracefully with optimistic rollback

### State Management
- [ ] Create comprehensive `useEnhancedTableState` hook:
  - [ ] TanStack Table state (sorting, filtering, etc.)
  - [ ] Row selection state
  - [ ] Column visibility state
  - [ ] Pagination state
  - [ ] **Optimistic state management**
- [ ] Add state persistence (localStorage/sessionStorage)
- [ ] Implement column ordering & resizing
- [ ] Test state persistence across page reloads

### Error Handling
- [ ] Implement `EnhancedTableError` component
- [ ] Create `EnhancedTableErrorBoundary` class component
- [ ] Add retry logic and error displays
- [ ] **Add optimistic update error handling and rollback**
- [ ] Integrate with Suspense error boundaries
- [ ] Test error scenarios (network failures, data errors, optimistic rollbacks)

---

## Phase 3: Interactive Features ⏳

### Toolbar System
- [ ] Create `enhanced-table-toolbar.ts` with all components:
  - [ ] `EnhancedDataTableToolbar` (main toolbar)
  - [ ] `DataTableViewOptions` (column visibility)
  - [ ] `DataTableFacetedFilter` (advanced filtering)
  - [ ] `BulkActionsToolbar` (selection actions)
- [ ] Add text search functionality
- [ ] Test toolbar interactions

### Bulk Actions with Optimistic Updates
- [ ] Create `enhanced-table-bulk-actions.ts`:
  - [ ] Selection column generator
  - [ ] Bulk action handlers with TypeORM entity types
  - [ ] **Optimistic bulk operations (delete, update)**
  - [ ] Bulk edit dropdown with instant preview
  - [ ] Bulk delete confirmation with optimistic removal
- [ ] Implement row selection logic
- [ ] Add custom bulk actions support
- [ ] **Test optimistic bulk operations with rollback scenarios**

### TypeORM-Aware Cell Helpers
- [ ] Create `enhanced-table-cells.ts` with TypeORM-aware utilities:
  - [ ] Entity property formatting helpers
  - [ ] Date formatting for entity dates (createdAt, updatedAt)
  - [ ] Status badge helpers for enum properties
  - [ ] Relationship display helpers (foreign keys)
  - [ ] Basic truncation utilities
  - [ ] **Optimistic edit state indicators**
- [ ] Add cell styling utilities
- [ ] Test cell helpers with entity properties

---

## Phase 4: Advanced Features ⏳

### Inline Editing with Optimistic Updates
- [ ] Add inline editing support for entity properties
- [ ] **Implement `useOptimistic` for instant edit feedback**:
  - [ ] Show changes immediately while saving
  - [ ] Loading indicators for optimistic updates
  - [ ] Success/error states
  - [ ] Automatic rollback on errors
- [ ] Add validation integration (class-validator)
- [ ] Add keyboard navigation (Enter to save, Esc to cancel)
- [ ] Test inline editing with various entity types
- [ ] **Test optimistic update edge cases (network failures, conflicts)**

### Entity Validation
- [ ] Add class-validator integration for inline editing
- [ ] Implement field validation for entity properties
- [ ] Add validation error display
- [ ] **Validate optimistic updates before applying**
- [ ] Test validation with entity constraints

### Performance Optimization
- [ ] Add memoization for expensive calculations
- [ ] Optimize re-render patterns
- [ ] **Optimize optimistic update rendering**
- [ ] Add table width calculation caching
- [ ] Performance testing with large entity datasets

---

## Phase 5: Polish & Integration ⏳

### Loading States
- [ ] Complete `enhanced-table-skeleton.ts`:
  - [ ] Table skeleton with configurable rows/columns
  - [ ] Toolbar skeleton
  - [ ] Responsive skeleton variants
- [ ] Test loading states
- [ ] Ensure smooth transitions

### Documentation & Examples
- [ ] Add comprehensive TypeScript interfaces
- [ ] Create usage examples for common scenarios:
  - [ ] Basic table with explicit columns (Task entities)
  - [ ] Table with bulk actions (Project entities)
  - [ ] Table with inline editing (User entities)
  - [ ] Full-featured table with entity services
- [ ] Add troubleshooting guide
- [ ] Document entity integration patterns

### Testing & Validation
- [ ] Unit tests for all utilities
- [ ] Integration tests with real entity types
- [ ] Test Universal Reactive Data Pattern integration
- [ ] Test content width constraint behavior
- [ ] Test entity service integration
- [ ] Cross-browser testing

---

## Migration Strategy 📋

### From Enhanced Data Table (Current)
- [ ] Update import paths
- [ ] Add required `loaderData` prop
- [ ] Add required `columns` prop (explicit definitions with entity types)
- [ ] Add optional `liveQueryBuilder` prop
- [ ] Add entity service integration
- [ ] Update route with loader (if needed)
- [ ] Test migration with entity types

### From Data Table Entity
- [ ] Convert auto-generated columns to explicit column definitions
- [ ] Maintain entity type safety
- [ ] Add Universal Reactive Data Pattern props
- [ ] Simplify prop structure while keeping entity features
- [ ] Test feature parity with entity integration

---

## Key Integrations 🔌

### Route Loader Pattern
- [ ] Document route loader integration with entity services
- [ ] Add example route implementations with entity queries
- [ ] Test cache population with entity data
- [ ] Verify instant loading behavior

### Layout Store Integration
- [ ] Ensure `useContentWidth()` integration works
- [ ] Test sidebar state changes
- [ ] Verify responsive behavior
- [ ] Test on different screen sizes

### TypeORM Entity Integration
- [ ] Document explicit column patterns for entities
- [ ] Add examples for common entity property types
- [ ] Test with various entity relationships
- [ ] Verify service integration patterns

### Domain Service Integration
- [ ] Test with TaskService, ProjectService, UserService
- [ ] Verify query builder integration
- [ ] Test live query updates with entity changes
- [ ] Ensure proper error handling

---

## Success Criteria ✅

### Functionality
- [ ] Clean explicit column API with entity type safety
- [ ] Universal Reactive Data Pattern integration
- [ ] Content width constraints working (like TasksEnhanced)
- [ ] Suspense integration complete
- [ ] TypeORM entity integration complete
- [ ] Error boundaries functional

### Performance
- [ ] Instant loading with route loaders
- [ ] Real-time updates with live queries
- [ ] Efficient width calculations
- [ ] Minimal re-renders
- [ ] Smooth animations

### Developer Experience
- [ ] Clean, intuitive API with explicit columns
- [ ] Full TypeScript support with entity types
- [ ] IntelliSense for entity properties
- [ ] Good error messages
- [ ] Clear documentation

### User Experience
- [ ] No loading spinners on initial load
- [ ] Smooth horizontal scrolling when needed
- [ ] Responsive design
- [ ] Accessible interactions
- [ ] Consistent with design system

---

## TypeORM Entity Integration Example 📝

### Entity-Typed Explicit Columns with Optimistic Updates
```typescript
// Type-safe explicit columns for Task entity
const taskColumns: ColumnDef<Task, any>[] = [
  {
    accessorKey: 'title',        // TypeScript knows this exists on Task
    header: 'Title',
    size: 200,
    minSize: 150,
    maxSize: 400,
    cell: ({ getValue, row, table }) => {
      const updateMutation = table.options.meta?.mutations?.update
      const isOptimistic = updateMutation?.isPending && updateMutation?.variables?.id === row.id
      
      return (
        <div className={cn(
          "font-medium truncate",
          isOptimistic && "opacity-70" // Show optimistic state
        )}>
          {getValue() as string}
          {isOptimistic && <Loader2 className="ml-2 h-3 w-3 animate-spin inline" />}
        </div>
      )
    },
  },
  {
    accessorKey: 'status',       // TypeScript knows this is TaskStatus enum
    header: 'Status',
    size: 120,
    minSize: 100,
    maxSize: 150,
    cell: ({ getValue, row, table }) => {
      const updateMutation = table.options.meta?.mutations?.update
      const isOptimistic = updateMutation?.isPending && 
        updateMutation?.variables?.id === row.id &&
        'status' in (updateMutation?.variables?.data || {})
      
      return (
        <div className={cn(isOptimistic && "opacity-70")}>
          <StatusBadge status={getValue() as TaskStatus} />
          {isOptimistic && <Loader2 className="ml-2 h-3 w-3 animate-spin inline" />}
        </div>
      )
    },
  },
  {
    accessorKey: 'createdAt',    // TypeScript knows this is Date
    header: 'Created',
    size: 120,
    cell: ({ getValue }) => (
      <DateCell date={getValue() as Date} />
    ),
  },
  // ... more explicit columns with optimistic state support
]

// Usage with full entity integration and TanStack Query optimistic updates
function TasksTable() {
  const loaderData = useLoaderData({ from: '/_authenticated/tasks/' })
  const liveQueryBuilder = useMemo(/* ... */)
  
  // Get domain service mutations (they have built-in optimistic updates)
  const updateTaskMutation = TaskService.hooks.useUpdateTask()
  const deleteTaskMutation = TaskService.hooks.useDeleteTask()
  const createTaskMutation = TaskService.hooks.useCreateTask()

  // Helper functions for table interactions
  const handleUpdate = async (id: string, data: Partial<Task>) => {
    // Domain service mutation handles optimistic updates automatically
    await updateTaskMutation.mutateAsync({ id, data })
  }

  const handleBulkDelete = async (ids: string[]) => {
    // Each mutation handles its own optimistic update
    const promises = ids.map(id => deleteTaskMutation.mutateAsync(id))
    await Promise.allSettled(promises)
  }

  const handleCreate = async (data: Partial<Task>) => {
    // Create mutation with built-in optimistic update
    return await createTaskMutation.mutateAsync(data)
  }

  return (
    <EnhancedDataTable<Task>         // Entity type parameter
      tableId="tasks-table"
      title="Tasks"
      columns={taskColumns}          // Type-safe explicit columns with optimistic states
      loaderData={loaderData.tasks}  // Router loader data
      liveQueryBuilder={liveQueryBuilder} // SelectQueryBuilder<Task>
      useContentWidth={true}
      enableBulkActions={true}
      service={{
        update: handleUpdate,        // TanStack Query mutations with optimistic updates
        delete: (id) => handleBulkDelete([id]), // TanStack Query mutations with optimistic updates
        create: handleCreate,        // TanStack Query mutations with optimistic updates
      }}
      tableMeta={{
        mutations: {
          update: updateTaskMutation,
          delete: deleteTaskMutation, 
          create: createTaskMutation,
        }
      }}
    />
  )
}
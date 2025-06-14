// Universal Entity Table with Relationship Cache Support
export { UniversalEntityTable } from './universal-entity-table'
export type { UniversalEntityTableProps } from './universal-entity-table-types'

// Context System
export { TableProvider, useTableContext } from './entity-table-context'
export type { TableContextValue } from './entity-table-context'

// Column utilities
export {
  createSelectionColumn,
  createIdColumn,
  createDateColumn,
  createTextColumn,
  createEntityTableColumns
} from './entity-table-columns'

// Modular components
export { EntityTableToolbar } from './entity-table-toolbar'
export { EntityTableBulkActions } from './entity-table-bulk-actions'
export type { BulkActionConfig } from './entity-table-bulk-actions'

// Regular Editing components (with preloaded relationship cache support)

// Enhanced Relationship components (with preloaded cache support)
export {
  EditableFilterableRelationshipCell,
  EditableMultiSelectRelationshipCell
} from './entity-table-relationship-cells'
export type { RelationshipConfig } from './entity-table-relationship-cells'

// Bulk editing
export {
  EntityTableBulkEditToolbar,
  createBulkEditFields
} from './entity-table-bulk-editing'
export type { BulkEditField } from './entity-table-bulk-editing'

// Operations service - extracted from main component for better separation of concerns
export {
  useEntityOperations
} from './entity-table-operations'
export type { 
  EntityService,
  EntityOperationsCallbacks,
  EntityBulkActionsProps,
  EntityBulkEditProps
} from './entity-table-operations'

// Legacy exports for backward compatibility
// export { UniversalEntityTable as UniversalEntityTableR19 } from './universal-entity-table-r19'

// Preloaded relationship cache features
export const RELATIONSHIP_CACHE_FEATURES = {
  preloadedData: 'Route loaders populate relationship cache for instant dropdowns',
  liveQueries: 'Real-time updates keep relationship data fresh',
  universalPattern: 'Implements Universal Reactive Data Pattern for relationships',
  noQueryOnOpen: 'Zero database queries when opening dropdowns',
  smartFallback: 'Graceful degradation to legacy fetch when no preloaded data'
} as const

// Optional: Export sub-components for customization
export { createTaskColumns, createProjectColumns, createUserColumns } from './entity-column-presets'

/**
 * Universal Reactive Data Pattern Implementation:
 * 
 * ✅ MODULAR ARCHITECTURE:
 * - UniversalEntityTable (clean display component)
 * - useEntityOperations (extracted business logic service)
 * - EntityTableBulkActions/BulkEditToolbar (self-sufficient UI modules)
 * - EditableFilterableRelationshipCell (direct cache access)
 * - Universal Reactive Data Pattern with TanStack Query integration
 * 
 * 📋 SEPARATION OF CONCERNS:
 * 1. Display Logic: UniversalEntityTable (presentation only)
 * 2. Business Logic: useEntityOperations (operations service)
 * 3. UI Modules: Bulk actions/editing (self-contained)
 * 4. Data Access: Direct cache access via service keys
 * 
 * 🚀 ARCHITECTURE BENEFITS:
 * - Zero prop drilling (modules handle their own operations)
 * - Zero hardcoded entity types (dynamic service integration)
 * - Zero infinite rendering (proper separation of concerns)
 * - Clean, testable, maintainable modular components
 * - Real-time sync via Global Live Query Manager
 */ 
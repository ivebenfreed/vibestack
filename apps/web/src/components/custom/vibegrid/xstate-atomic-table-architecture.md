# XState Store Integration: Connecting Entity Atoms to Table Architecture

## Core Concept: Entity-Driven Table with Atomic Subscriptions

Rather than creating a separate table store, we connect directly to your existing entity atoms (projects, tasks, etc.) and create a lightweight table coordination layer that subscribes to entity changes with surgical precision using shallow equality.

```typescript
import { createStore } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// =====================================================
// 1. EXISTING ENTITY ATOM INTEGRATION
// =====================================================

// Your existing entity stores (assume these already exist)
interface TaskEntity {
  id: string;
  name: string;
  status: 'todo' | 'in-progress' | 'done';
  assignee: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectEntity {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  ownerId: string;
  createdAt: Date;
}

// Your existing entity stores that get updated via sync events
const taskStore = createStore(
  { tasks: new Map<string, TaskEntity>() },
  {
    // These events come from your sync system
    hydrateTask: (context, { task }: { task: TaskEntity }) => ({
      ...context,
      tasks: new Map(context.tasks.set(task.id, task))
    }),
    updateTask: (context, { taskId, changes }: { taskId: string; changes: Partial<TaskEntity> }) => {
      const existing = context.tasks.get(taskId);
      if (!existing) return context;
      
      return {
        ...context,
        tasks: new Map(context.tasks.set(taskId, { ...existing, ...changes, updatedAt: new Date() }))
      };
    },
    deleteTask: (context, { taskId }: { taskId: string }) => {
      const newTasks = new Map(context.tasks);
      newTasks.delete(taskId);
      return { ...context, tasks: newTasks };
    }
  }
);

const projectStore = createStore(
  { projects: new Map<string, ProjectEntity>() },
  {
    hydrateProject: (context, { project }: { project: ProjectEntity }) => ({
      ...context,
      projects: new Map(context.projects.set(project.id, project))
    }),
    updateProject: (context, { projectId, changes }: { projectId: string; changes: Partial<ProjectEntity> }) => {
      const existing = context.projects.get(projectId);
      if (!existing) return context;
      
      return {
        ...context,
        projects: new Map(context.projects.set(projectId, { ...existing, ...changes }))
      };
    }
  }
);

// =====================================================
// 2. TABLE COORDINATION LAYER (NOT DATA STORE)
// =====================================================

# XState v5 + Entity Atoms: Perfect Integration Architecture

## Core Concept: XState Machines + Entity Store Subscriptions

The XState v5 machine handles all table coordination, UI state, and business logic, while subscribing to your existing entity atoms (tasks, projects, etc.) for data. This creates a clean separation: entities for data, XState for coordination and behavior.

```typescript
import { setup, assign, fromPromise, sendTo } from 'xstate';
import { useSelector } from '@xstate/store/react';
import { useMachine } from '@xstate/react';

// =====================================================
// 1. ENTITY STORES (Your Existing Architecture)
// =====================================================

// Your existing entity stores remain unchanged
const taskStore = createStore(
  { tasks: new Map<string, TaskEntity>() },
  {
    hydrateTask: (context, { task }) => ({
      ...context,
      tasks: new Map(context.tasks.set(task.id, task))
    }),
    updateTask: (context, { taskId, changes }) => {
      const existing = context.tasks.get(taskId);
      if (!existing) return context;
      return {
        ...context,
        tasks: new Map(context.tasks.set(taskId, { ...existing, ...changes, updatedAt: new Date() }))
      };
    }
  }
);

// =====================================================
// 2. XSTATE V5 TABLE MACHINE WITH ENTITY INTEGRATION
// =====================================================

interface TableContext {
  // Entity configuration
  entityType: 'task' | 'project' | 'user';
  entityStore: any; // Reference to the entity store
  
  // Table view state
  visibleEntityIds: string[];
  columns: Column[];
  
  // Selection state
  selectedCells: Set<string>;
  selectedRows: Set<string>;
  activeCell: { entityId: string; field: string } | null;
  
  // Edit state
  editingCell: { entityId: string; field: string } | null;
  editValue: any;
  
  // Optimistic operations
  optimisticOperations: Map<string, {
    entityId: string;
    field: string;
    originalValue: any;
    newValue: any;
    timestamp: number;
  }>;
  
  // View configuration
  groupBy: string[];
  sortBy: { field: string; direction: 'asc' | 'desc' }[];
  filters: Map<string, any>;
  viewport: { start: number; end: number };
  
  // Table metadata
  version: number;
  isLoading: boolean;
  error: string | null;
}

type TableEvents = 
  // Entity configuration
  | { type: 'SET_ENTITY_TYPE'; entityType: 'task' | 'project' | 'user'; entityStore: any }
  | { type: 'SET_VISIBLE_ENTITIES'; entityIds: string[] }
  
  // Selection events
  | { type: 'SELECT_CELL'; entityId: string; field: string; extend?: boolean }
  | { type: 'SELECT_ROW'; entityId: string; extend?: boolean }
  | { type: 'SELECT_RANGE'; start: { entityId: string; field: string }; end: { entityId: string; field: string } }
  | { type: 'CLEAR_SELECTION' }
  
  // Edit events
  | { type: 'START_EDIT'; entityId: string; field: string }
  | { type: 'UPDATE_EDIT_VALUE'; value: any }
  | { type: 'COMMIT_EDIT' }
  | { type: 'CANCEL_EDIT' }
  
  // Optimistic operations
  | { type: 'APPLY_OPTIMISTIC'; entityId: string; field: string; value: any; operationId: string }
  | { type: 'CONFIRM_OPTIMISTIC'; operationId: string }
  | { type: 'ROLLBACK_OPTIMISTIC'; operationId: string }
  
  // Bulk operations
  | { type: 'BULK_UPDATE'; updates: Array<{ entityId: string; changes: Record<string, any> }> }
  
  // View operations
  | { type: 'SET_SORT'; sortBy: { field: string; direction: 'asc' | 'desc' }[] }
  | { type: 'SET_FILTERS'; filters: Map<string, any> }
  | { type: 'SET_VIEWPORT'; start: number; end: number }
  
  // Entity sync events (from your existing sync system)
  | { type: 'ENTITY_UPDATED'; entityId: string; changes: any }
  | { type: 'ENTITY_CREATED'; entity: any }
  | { type: 'ENTITY_DELETED'; entityId: string };

const entityTableMachine = setup({
  types: {
    context: {} as TableContext,
    events: {} as TableEvents
  },
  actors: {
    updateEntity: fromPromise(async ({ input }: { 
      input: { entityType: string; entityId: string; field: string; value: any } 
    }) => {
      const { entityType, entityId, field, value } = input;
      return await updateEntityOnServer(entityType, entityId, { [field]: value });
    }),
    
    bulkUpdateEntities: fromPromise(async ({ input }: {
      input: { entityType: string; updates: Array<{ entityId: string; changes: any }> }
    }) => {
      const { entityType, updates } = input;
      return await bulkUpdateEntitiesOnServer(entityType, updates);
    })
  },
  actions: {
    // Selection actions
    selectCell: assign({
      selectedCells: ({ context, event }) => {
        if (event.type !== 'SELECT_CELL') return context.selectedCells;
        
        const cellKey = `${event.entityId}:${event.field}`;
        const newSelection = new Set(context.selectedCells);
        
        if (event.extend) {
          if (newSelection.has(cellKey)) {
            newSelection.delete(cellKey);
          } else {
            newSelection.add(cellKey);
          }
        } else {
          newSelection.clear();
          newSelection.add(cellKey);
        }
        
        return newSelection;
      },
      activeCell: ({ event }) => 
        event.type === 'SELECT_CELL' ? { entityId: event.entityId, field: event.field } : null,
      version: ({ context }) => context.version + 1
    }),
    
    selectRow: assign({
      selectedRows: ({ context, event }) => {
        if (event.type !== 'SELECT_ROW') return context.selectedRows;
        
        const newSelection = new Set(context.selectedRows);
        
        if (event.extend) {
          if (newSelection.has(event.entityId)) {
            newSelection.delete(event.entityId);
          } else {
            newSelection.add(event.entityId);
          }
        } else {
          newSelection.clear();
          newSelection.add(event.entityId);
        }
        
        return newSelection;
      },
      version: ({ context }) => context.version + 1
    }),
    
    selectRange: assign({
      selectedCells: ({ context, event }) => {
        if (event.type !== 'SELECT_RANGE') return context.selectedCells;
        
        // Calculate rectangular selection
        const newSelection = calculateCellRange(event.start, event.end, context.visibleEntityIds, context.columns);
        return newSelection;
      },
      version: ({ context }) => context.version + 1
    }),
    
    clearSelection: assign({
      selectedCells: new Set(),
      selectedRows: new Set(),
      activeCell: null,
      version: ({ context }) => context.version + 1
    }),
    
    // Edit actions
    startEdit: assign({
      editingCell: ({ event }) => 
        event.type === 'START_EDIT' ? { entityId: event.entityId, field: event.field } : null,
      editValue: ({ context, event }) => {
        if (event.type !== 'START_EDIT') return context.editValue;
        
        // Get current value from entity store or optimistic operation
        const optimisticOp = Array.from(context.optimisticOperations.values())
          .find(op => op.entityId === event.entityId && op.field === event.field);
        
        if (optimisticOp) {
          return optimisticOp.newValue;
        }
        
        // Get from entity store
        const entityMap = context.entityStore.getSnapshot()[context.entityType + 's'];
        const entity = entityMap.get(event.entityId);
        return entity?.[event.field];
      },
      version: ({ context }) => context.version + 1
    }),
    
    updateEditValue: assign({
      editValue: ({ event }) => event.type === 'UPDATE_EDIT_VALUE' ? event.value : undefined,
      version: ({ context }) => context.version + 1
    }),
    
    cancelEdit: assign({
      editingCell: null,
      editValue: undefined,
      version: ({ context }) => context.version + 1
    }),
    
    // Optimistic operation actions
    applyOptimistic: assign({
      optimisticOperations: ({ context, event }) => {
        if (event.type !== 'APPLY_OPTIMISTIC') return context.optimisticOperations;
        
        // Get original value from entity store
        const entityMap = context.entityStore.getSnapshot()[context.entityType + 's'];
        const entity = entityMap.get(event.entityId);
        const originalValue = entity?.[event.field];
        
        return new Map(context.optimisticOperations.set(event.operationId, {
          entityId: event.entityId,
          field: event.field,
          originalValue,
          newValue: event.value,
          timestamp: Date.now()
        }));
      },
      version: ({ context }) => context.version + 1
    }),
    
    confirmOptimistic: assign({
      optimisticOperations: ({ context, event }) => {
        if (event.type !== 'CONFIRM_OPTIMISTIC') return context.optimisticOperations;
        
        const newOps = new Map(context.optimisticOperations);
        newOps.delete(event.operationId);
        return newOps;
      },
      version: ({ context }) => context.version + 1
    }),
    
    rollbackOptimistic: assign({
      optimisticOperations: ({ context, event }) => {
        if (event.type !== 'ROLLBACK_OPTIMISTIC') return context.optimisticOperations;
        
        const newOps = new Map(context.optimisticOperations);
        newOps.delete(event.operationId);
        return newOps;
      },
      version: ({ context }) => context.version + 1
    }),
    
    // View actions
    setSort: assign({
      sortBy: ({ event }) => event.type === 'SET_SORT' ? event.sortBy : [],
      version: ({ context }) => context.version + 1
    }),
    
    setFilters: assign({
      filters: ({ event }) => event.type === 'SET_FILTERS' ? event.filters : new Map(),
      version: ({ context }) => context.version + 1
    }),
    
    setViewport: assign({
      viewport: ({ event }) => 
        event.type === 'SET_VIEWPORT' ? { start: event.start, end: event.end } : { start: 0, end: 50 },
      version: ({ context }) => context.version + 1
    }),
    
    // Entity sync actions (triggered by your existing sync events)
    handleEntityUpdate: assign({
      version: ({ context }) => context.version + 1
      // Entity data is handled by your entity store, we just bump version to trigger re-renders
    })
  },
  guards: {
    canEdit: ({ context, event }) => {
      if (event.type !== 'START_EDIT') return false;
      
      // Check if field is editable
      const column = context.columns.find(col => col.field === event.field);
      return column?.editable !== false;
    },
    
    hasSelection: ({ context }) => 
      context.selectedCells.size > 0 || context.selectedRows.size > 0,
    
    isEditing: ({ context }) => context.editingCell !== null
  }
}).createMachine({
  id: 'entityTable',
  initial: 'idle',
  context: {
    entityType: 'task',
    entityStore: null,
    visibleEntityIds: [],
    columns: [],
    selectedCells: new Set(),
    selectedRows: new Set(),
    activeCell: null,
    editingCell: null,
    editValue: undefined,
    optimisticOperations: new Map(),
    groupBy: [],
    sortBy: [],
    filters: new Map(),
    viewport: { start: 0, end: 50 },
    version: 0,
    isLoading: false,
    error: null
  },
  states: {
    idle: {
      on: {
        SET_ENTITY_TYPE: {
          actions: assign({
            entityType: ({ event }) => event.entityType,
            entityStore: ({ event }) => event.entityStore,
            selectedCells: new Set(),
            selectedRows: new Set(),
            editingCell: null,
            optimisticOperations: new Map(),
            version: ({ context }) => context.version + 1
          })
        },
        
        SET_VISIBLE_ENTITIES: {
          actions: assign({
            visibleEntityIds: ({ event }) => event.entityIds,
            version: ({ context }) => context.version + 1
          })
        },
        
        SELECT_CELL: { actions: 'selectCell' },
        SELECT_ROW: { actions: 'selectRow' },
        SELECT_RANGE: { actions: 'selectRange' },
        CLEAR_SELECTION: { actions: 'clearSelection' },
        
        START_EDIT: {
          guard: 'canEdit',
          target: 'editing',
          actions: 'startEdit'
        },
        
        SET_SORT: { actions: 'setSort' },
        SET_FILTERS: { actions: 'setFilters' },
        SET_VIEWPORT: { actions: 'setViewport' },
        
        // Entity sync events
        ENTITY_UPDATED: { actions: 'handleEntityUpdate' },
        ENTITY_CREATED: { actions: 'handleEntityUpdate' },
        ENTITY_DELETED: { actions: 'handleEntityUpdate' },
        
        BULK_UPDATE: { target: 'bulkUpdating' }
      }
    },
    
    editing: {
      on: {
        UPDATE_EDIT_VALUE: { actions: 'updateEditValue' },
        
        COMMIT_EDIT: {
          target: 'optimisticUpdate',
          actions: assign({
            editingCell: null,
            editValue: undefined
          })
        },
        
        CANCEL_EDIT: {
          target: 'idle',
          actions: 'cancelEdit'
        }
      }
    },
    
    optimisticUpdate: {
      entry: [
        // Apply optimistic operation
        ({ context }) => {
          if (context.editingCell) {
            const operationId = crypto.randomUUID();
            
            // Apply optimistic update
            context.optimisticOperations.set(operationId, {
              entityId: context.editingCell.entityId,
              field: context.editingCell.field,
              originalValue: getCurrentEntityValue(context, context.editingCell.entityId, context.editingCell.field),
              newValue: context.editValue,
              timestamp: Date.now()
            });
            
            context.version += 1;
          }
        }
      ],
      
      invoke: {
        src: 'updateEntity',
        input: ({ context }) => ({
          entityType: context.entityType,
          entityId: context.editingCell!.entityId,
          field: context.editingCell!.field,
          value: context.editValue
        }),
        onDone: {
          target: 'idle',
          actions: [
            // Confirm optimistic operation
            ({ context, event }) => {
              // Your sync system will update the entity store
              // We just need to remove the optimistic operation
              const operations = Array.from(context.optimisticOperations.entries());
              const [operationId] = operations[operations.length - 1] || [];
              if (operationId) {
                context.optimisticOperations.delete(operationId);
                context.version += 1;
              }
            }
          ]
        },
        onError: {
          target: 'idle',
          actions: [
            // Rollback optimistic operation
            ({ context }) => {
              const operations = Array.from(context.optimisticOperations.entries());
              const [operationId] = operations[operations.length - 1] || [];
              if (operationId) {
                context.optimisticOperations.delete(operationId);
                context.version += 1;
              }
            },
            assign({
              error: ({ event }) => event.error.message
            })
          ]
        }
      }
    },
    
    bulkUpdating: {
      invoke: {
        src: 'bulkUpdateEntities',
        input: ({ context, event }) => ({
          entityType: context.entityType,
          updates: event.type === 'BULK_UPDATE' ? event.updates : []
        }),
        onDone: {
          target: 'idle',
          actions: assign({
            selectedCells: new Set(),
            selectedRows: new Set(),
            version: ({ context }) => context.version + 1
          })
        },
        onError: {
          target: 'idle',
          actions: assign({
            error: ({ event }) => event.error.message
          })
        }
      }
    }
  }
});

// =====================================================
// 3. ENTITY-AWARE SELECTORS FOR REACT COMPONENTS
// =====================================================

// Selectors that combine XState machine state with entity store data
const createEntityTableSelectors = () => ({
  // Get entity with optimistic overlays applied
  getEntityWithOptimistic: (entityId: string) => (tableState: any, entityStoreState: any) => {
    const entityMap = entityStoreState[tableState.context.entityType + 's'];
    const baseEntity = entityMap?.get(entityId);
    if (!baseEntity) return null;
    
    // Apply optimistic operations
    let entityWithOptimistic = { ...baseEntity };
    tableState.context.optimisticOperations.forEach((operation) => {
      if (operation.entityId === entityId) {
        entityWithOptimistic[operation.field] = operation.newValue;
      }
    });
    
    return entityWithOptimistic;
  },
  
  // Get specific field value with optimistic overlay
  getEntityField: (entityId: string, field: string) => (tableState: any, entityStoreState: any) => {
    const entityMap = entityStoreState[tableState.context.entityType + 's'];
    const baseEntity = entityMap?.get(entityId);
    if (!baseEntity) return undefined;
    
    // Check for optimistic override
    const optimisticOp = Array.from(tableState.context.optimisticOperations.values())
      .find(op => op.entityId === entityId && op.field === field);
    
    return optimisticOp ? optimisticOp.newValue : baseEntity[field];
  },
  
  // Selection state
  isCellSelected: (cellKey: string) => (tableState: any) => {
    return tableState.context.selectedCells.has(cellKey);
  },
  
  isRowSelected: (entityId: string) => (tableState: any) => {
    return tableState.context.selectedRows.has(entityId);
  },
  
  // Edit state
  isEditing: (entityId: string, field: string) => (tableState: any) => {
    return tableState.context.editingCell?.entityId === entityId && 
           tableState.context.editingCell?.field === field;
  },
  
  // Optimistic state
  hasOptimisticOperation: (entityId: string, field: string) => (tableState: any) => {
    return Array.from(tableState.context.optimisticOperations.values())
      .some(op => op.entityId === entityId && op.field === field);
  }
});

// =====================================================
// 4. ATOMIC ROW COMPONENT WITH XSTATE + ENTITY INTEGRATION
// =====================================================

import { memo, useCallback } from 'react';

const EntityTableRow = memo(({ 
  entityId, 
  columns,
  tableActor,
  entityStore 
}: {
  entityId: string;
  columns: Column[];
  tableActor: any;
  entityStore: any;
}) => {
  // Subscribe to XState machine state
  const tableState = useSelector(tableActor, state => state);
  
  // Subscribe to specific entity from entity store - SHALLOW EQUALITY
  const entity = useSelector(entityStore, state => {
    const entityMap = state[tableState.context.entityType + 's'] as Map<string, any>;
    return entityMap.get(entityId);
  });
  
  // Get optimistic overlays for this entity
  const optimisticOverlays = useMemo(() => {
    const overlays = new Map<string, any>();
    tableState.context.optimisticOperations.forEach((operation) => {
      if (operation.entityId === entityId) {
        overlays.set(operation.field, operation.newValue);
      }
    });
    return overlays;
  }, [tableState.context.optimisticOperations, entityId]);
  
  // Selection state
  const isRowSelected = tableState.context.selectedRows.has(entityId);
  
  if (!entity) return null;
  
  console.log(`Rendering ${tableState.context.entityType} row ${entityId} - XState version: ${tableState.context.version}`);
  
  return (
    <tr className={`table-row ${isRowSelected ? 'selected' : ''}`}>
      {columns.map(column => (
        <EntityTableCell
          key={`${entityId}-${column.field}`}
          entityId={entityId}
          field={column.field}
          entity={entity}
          optimisticValue={optimisticOverlays.get(column.field)}
          tableActor={tableActor}
        />
      ))}
    </tr>
  );
});

const EntityTableCell = memo(({
  entityId,
  field,
  entity,
  optimisticValue,
  tableActor
}: {
  entityId: string;
  field: string;
  entity: any;
  optimisticValue?: any;
  tableActor: any;
}) => {
  // Subscribe to cell-specific state from XState machine
  const cellKey = `${entityId}:${field}`;
  const isCellSelected = useSelector(tableActor, state => 
    state.context.selectedCells.has(cellKey)
  );
  
  const isEditing = useSelector(tableActor, state => 
    state.context.editingCell?.entityId === entityId && 
    state.context.editingCell?.field === field
  );
  
  const editValue = useSelector(tableActor, state => 
    isEditing ? state.context.editValue : undefined
  );
  
  // Display value priority: editValue > optimisticValue > entity value
  const displayValue = editValue !== undefined ? editValue :
                      optimisticValue !== undefined ? optimisticValue : 
                      entity[field];
  
  const hasOptimistic = optimisticValue !== undefined;
  
  console.log(`Rendering cell ${entityId}:${field} - value: ${displayValue}`);
  
  const handleClick = useCallback(() => {
    tableActor.send({ type: 'SELECT_CELL', entityId, field });
  }, [entityId, field, tableActor]);
  
  const handleDoubleClick = useCallback(() => {
    tableActor.send({ type: 'START_EDIT', entityId, field });
  }, [entityId, field, tableActor]);
  
  const handleEditChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    tableActor.send({ type: 'UPDATE_EDIT_VALUE', value: e.target.value });
  }, [tableActor]);
  
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      tableActor.send({ type: 'COMMIT_EDIT' });
    } else if (e.key === 'Escape') {
      tableActor.send({ type: 'CANCEL_EDIT' });
    }
  }, [tableActor]);
  
  return (
    <td 
      className={`
        table-cell 
        ${isCellSelected ? 'selected' : ''} 
        ${isEditing ? 'editing' : ''}
        ${hasOptimistic ? 'optimistic' : ''}
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {hasOptimistic && <span className="optimistic-indicator">⏳</span>}
      
      {isEditing ? (
        <input
          type="text"
          value={String(displayValue)}
          onChange={handleEditChange}
          onKeyDown={handleEditKeyDown}
          onBlur={() => tableActor.send({ type: 'CANCEL_EDIT' })}
          autoFocus
        />
      ) : (
        String(displayValue)
      )}
    </td>
  );
});

// =====================================================
// 5. MAIN TABLE COMPONENT WITH XSTATE + ENTITY INTEGRATION
// =====================================================

const EntityDataTable = ({ 
  entityType, 
  columns, 
  initialEntityIds = [] 
}: {
  entityType: 'task' | 'project' | 'user';
  columns: Column[];
  initialEntityIds?: string[];
}) => {
  // Get the appropriate entity store
  const entityStore = entityType === 'task' ? taskStore : 
                     entityType === 'project' ? projectStore : 
                     userStore;
  
  // Initialize XState machine
  const [tableState, tableSend] = useMachine(entityTableMachine);
  
  // Initialize table with entity configuration
  useEffect(() => {
    tableSend({ type: 'SET_ENTITY_TYPE', entityType, entityStore });
    tableSend({ type: 'SET_VISIBLE_ENTITIES', entityIds: initialEntityIds });
  }, [entityType, entityStore, initialEntityIds, tableSend]);
  
  // Listen to your existing sync events and forward to XState machine
  useEffect(() => {
    const unsubscribe = subscribToSyncEvents((event) => {
      switch (event.type) {
        case 'TASK_UPDATED':
          // Update entity store (your existing code)
          taskStore.send({
            type: 'updateTask',
            taskId: event.payload.id,
            changes: event.payload.changes
          });
          // Notify XState machine
          tableSend({ type: 'ENTITY_UPDATED', entityId: event.payload.id, changes: event.payload.changes });
          break;
          
        case 'TASK_CREATED':
          taskStore.send({
            type: 'hydrateTask',
            task: event.payload.task
          });
          tableSend({ type: 'ENTITY_CREATED', entity: event.payload.task });
          break;
          
        // Handle other entity types...
      }
    });
    
    return unsubscribe;
  }, [tableSend]);
  
  // Handle bulk operations
  const handleBulkUpdate = useCallback((updates: Array<{ entityId: string; changes: any }>) => {
    tableSend({ type: 'BULK_UPDATE', updates });
  }, [tableSend]);
  
  return (
    <div className="entity-data-table">
      <div className="table-toolbar">
        <span>Editing {entityType}s</span>
        {tableState.matches('optimisticUpdate') && <span className="loading">Saving...</span>}
        {tableState.matches('bulkUpdating') && <span className="loading">Bulk updating...</span>}
        
        <button 
          onClick={() => {
            const selectedRows = Array.from(tableState.context.selectedRows);
            if (selectedRows.length > 0) {
              handleBulkUpdate(
                selectedRows.map(entityId => ({
                  entityId,
                  changes: { status: 'completed' }
                }))
              );
            }
          }}
          disabled={tableState.context.selectedRows.size === 0}
        >
          Mark Selected Complete
        </button>
      </div>
      
      <div className="table-viewport">
        <table>
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column.field}>{column.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableState.context.visibleEntityIds.map(entityId => (
              <EntityTableRow
                key={entityId}
                entityId={entityId}
                columns={columns}
                tableActor={tableState}
                entityStore={entityStore}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="table-status">
        {tableState.context.selectedRows.size > 0 && (
          <span>{tableState.context.selectedRows.size} rows selected</span>
        )}
        {tableState.context.optimisticOperations.size > 0 && (
          <span>{tableState.context.optimisticOperations.size} pending operations</span>
        )}
        {tableState.context.error && (
          <span className="error">Error: {tableState.context.error}</span>
        )}
      </div>
    </div>
  );
};

// =====================================================
// 6. USAGE EXAMPLES
// =====================================================

// Task table
const TaskTable = () => (
  <EntityDataTable
    entityType="task"
    columns={[
      { field: 'name', name: 'Task Name', editable: true },
      { field: 'status', name: 'Status', editable: true },
      { field: 'assignee', name: 'Assignee', editable: true },
      { field: 'projectId', name: 'Project', editable: false }
    ]}
    initialEntityIds={['task-1', 'task-2', 'task-3']}
  />
);

// Project table  
const ProjectTable = () => (
  <EntityDataTable
    entityType="project"
    columns={[
      { field: 'name', name: 'Project Name', editable: true },
      { field: 'description', name: 'Description', editable: true },
      { field: 'status', name: 'Status', editable: true },
      { field: 'ownerId', name: 'Owner', editable: false }
    ]}
    initialEntityIds={['proj-1', 'proj-2']}
  />
);

// Helper functions
function calculateCellRange(
  start: { entityId: string; field: string },
  end: { entityId: string; field: string },
  visibleEntityIds: string[],
  columns: Column[]
): Set<string> {
  const selection = new Set<string>();
  
  const startRowIndex = visibleEntityIds.indexOf(start.entityId);
  const endRowIndex = visibleEntityIds.indexOf(end.entityId);
  const startColIndex = columns.findIndex(col => col.field === start.field);
  const endColIndex = columns.findIndex(col => col.field === end.field);
  
  const minRow = Math.min(startRowIndex, endRowIndex);
  const maxRow = Math.max(startRowIndex, endRowIndex);
  const minCol = Math.min(startColIndex, endColIndex);
  const maxCol = Math.max(startColIndex, endColIndex);
  
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const entityId = visibleEntityIds[row];
      const field = columns[col].field;
      selection.add(`${entityId}:${field}`);
    }
  }
  
  return selection;
}

function getCurrentEntityValue(context: TableContext, entityId: string, field: string): any {
  const entityMap = context.entityStore.getSnapshot()[context.entityType + 's'];
  const entity = entityMap.get(entityId);
  return entity?.[field];
}
```

## Perfect Integration Architecture

### **1. XState Machine = Coordination & Business Logic**
- Handles all table UI state (selection, editing, view config)  
- Manages optimistic operations lifecycle
- Coordinates bulk operations and complex workflows
- Provides state machine benefits (guards, actions, predictable state transitions)

### **2. Entity Stores = Data Layer**
- Your existing entity atoms remain unchanged
- Sync events continue to work exactly as before
- No data duplication in XState machine
- Shallow equality subscriptions for surgical re-renders

### **3. React Components = Presentation**
- Subscribe to both XState machine state AND entity store data
- Optimistic overlays applied in render layer
- Each cell only re-renders when its specific data changes

### **4. Benefits of This Architecture**
```
✅ XState handles coordination, not data storage
✅ Entity stores handle data, not UI state  
✅ Perfect separation of concerns
✅ Your existing sync system works unchanged
✅ Optimistic operations are lightweight and coordinated
✅ All XState v5 benefits (guards, actions, parallel states, etc.)
✅ Surgical re-renders with shallow equality
✅ No architectural rewrites needed
```

This gives you the best of both worlds: XState's powerful coordination capabilities with your existing entity store architecture!
  // UI-only state - no entity data duplication
  {
    // Table view configuration
    entityType: 'task' as 'task' | 'project' | 'user',
    visibleEntityIds: [] as string[],
    columns: [] as Column[],
    
    // Selection state (independent of entity data)
    selectedCells: new Set<string>(),
    selectedRows: new Set<string>(),
    
    // Edit state
    editingCell: null as { entityId: string; field: string } | null,
    
    // View state
    groupBy: [] as string[],
    sortBy: [] as { field: string; direction: 'asc' | 'desc' }[],
    filters: new Map<string, any>(),
    
    // Optimistic operations tracking
    optimisticOperations: new Map<string, {
      entityId: string;
      field: string;
      originalValue: any;
      newValue: any;
      timestamp: number;
    }>(),
    
    // Virtual scrolling state
    viewport: { start: 0, end: 50 },
    
    // Table metadata
    version: 0
  },
  
  {
    // Table coordination operations (UI state only)
    setEntityType: (context, { entityType }: { entityType: 'task' | 'project' | 'user' }) => ({
      ...context,
      entityType,
      selectedCells: new Set(),
      selectedRows: new Set(),
      editingCell: null,
      version: context.version + 1
    }),
    
    setVisibleEntities: (context, { entityIds }: { entityIds: string[] }) => ({
      ...context,
      visibleEntityIds: entityIds,
      version: context.version + 1
    }),
    
    // Selection operations
    toggleCellSelection: (context, { cellKey }: { cellKey: string }) => {
      const newSelection = new Set(context.selectedCells);
      if (newSelection.has(cellKey)) {
        newSelection.delete(cellKey);
      } else {
        newSelection.add(cellKey);
      }
      
      return {
        ...context,
        selectedCells: newSelection,
        version: context.version + 1
      };
    },
    
    toggleRowSelection: (context, { entityId }: { entityId: string }) => {
      const newSelection = new Set(context.selectedRows);
      if (newSelection.has(entityId)) {
        newSelection.delete(entityId);
      } else {
        newSelection.add(entityId);
      }
      
      return {
        ...context,
        selectedRows: newSelection,
        version: context.version + 1
      };
    },
    
    // Edit operations
    startEdit: (context, { entityId, field }: { entityId: string; field: string }) => ({
      ...context,
      editingCell: { entityId, field },
      version: context.version + 1
    }),
    
    endEdit: (context) => ({
      ...context,
      editingCell: null,
      version: context.version + 1
    }),
    
    // Optimistic operation tracking
    addOptimisticOperation: (context, { 
      operationId, 
      entityId, 
      field, 
      originalValue, 
      newValue 
    }: { 
      operationId: string;
      entityId: string; 
      field: string; 
      originalValue: any; 
      newValue: any; 
    }) => ({
      ...context,
      optimisticOperations: new Map(context.optimisticOperations.set(operationId, {
        entityId,
        field,
        originalValue,
        newValue,
        timestamp: Date.now()
      })),
      version: context.version + 1
    }),
    
    removeOptimisticOperation: (context, { operationId }: { operationId: string }) => {
      const newOps = new Map(context.optimisticOperations);
      newOps.delete(operationId);
      return {
        ...context,
        optimisticOperations: newOps,
        version: context.version + 1
      };
    },
    
    // View operations
    setSort: (context, { sortBy }: { sortBy: { field: string; direction: 'asc' | 'desc' }[] }) => ({
      ...context,
      sortBy,
      version: context.version + 1
    }),
    
    setFilters: (context, { filters }: { filters: Map<string, any> }) => ({
      ...context,
      filters,
      version: context.version + 1
    }),
    
    setViewport: (context, { start, end }: { start: number; end: number }) => ({
      ...context,
      viewport: { start, end },
      version: context.version + 1
    })
  }
);

// =====================================================
// 3. ENTITY-AWARE SELECTORS WITH SHALLOW EQUALITY
// =====================================================

// Selectors that combine entity data with table coordination
const createEntityTableSelectors = (entityStore: any) => ({
  // Get entity with optimistic overlays
  getEntityWithOptimistic: (entityId: string) => (tableState: any, entityState: any) => {
    const baseEntity = entityState[tableState.entityType + 's']?.get(entityId);
    if (!baseEntity) return null;
    
    // Apply optimistic operations
    let entityWithOptimistic = { ...baseEntity };
    tableState.optimisticOperations.forEach((operation) => {
      if (operation.entityId === entityId) {
        entityWithOptimistic[operation.field] = operation.newValue;
      }
    });
    
    return entityWithOptimistic;
  },
  
  // Get specific field value with optimistic overlay
  getEntityField: (entityId: string, field: string) => (tableState: any, entityState: any) => {
    const baseEntity = entityState[tableState.entityType + 's']?.get(entityId);
    if (!baseEntity) return undefined;
    
    // Check for optimistic override
    const optimisticOp = Array.from(tableState.optimisticOperations.values())
      .find(op => op.entityId === entityId && op.field === field);
    
    return optimisticOp ? optimisticOp.newValue : baseEntity[field];
  },
  
  // Get visible entities (filtered, sorted, paginated)
  getVisibleEntities: () => (tableState: any, entityState: any) => {
    const entities = entityState[tableState.entityType + 's'];
    if (!entities) return [];
    
    return tableState.visibleEntityIds
      .map((id: string) => {
        const entity = entities.get(id);
        if (!entity) return null;
        
        // Apply optimistic operations
        let entityWithOptimistic = { ...entity };
        tableState.optimisticOperations.forEach((operation) => {
          if (operation.entityId === id) {
            entityWithOptimistic[operation.field] = operation.newValue;
          }
        });
        
        return entityWithOptimistic;
      })
      .filter(Boolean);
  },
  
  // Selection state
  isCellSelected: (cellKey: string) => (tableState: any) => {
    return tableState.selectedCells.has(cellKey);
  },
  
  isRowSelected: (entityId: string) => (tableState: any) => {
    return tableState.selectedRows.has(entityId);
  },
  
  // Edit state
  isEditing: (entityId: string, field: string) => (tableState: any) => {
    return tableState.editingCell?.entityId === entityId && 
           tableState.editingCell?.field === field;
  },
  
  // Optimistic state
  hasOptimisticOperation: (entityId: string, field: string) => (tableState: any) => {
    return Array.from(tableState.optimisticOperations.values())
      .some(op => op.entityId === entityId && op.field === field);
  }
});

// =====================================================
// 4. ATOMIC ROW COMPONENT CONNECTED TO ENTITIES
// =====================================================

// Row component that subscribes to both entity data and table coordination
const EntityTableRow = memo(({ 
  entityId, 
  entityType,
  columns,
  onCellClick,
  onCellEdit 
}: {
  entityId: string;
  entityType: 'task' | 'project' | 'user';
  columns: Column[];
  onCellClick: (entityId: string, field: string) => void;
  onCellEdit: (entityId: string, field: string, value: any) => void;
}) => {
  // Get the appropriate entity store based on type
  const entityStore = entityType === 'task' ? taskStore : 
                     entityType === 'project' ? projectStore : 
                     userStore; // assume userStore exists
  
  // Subscribe to table coordination state
  const tableState = useSelector(tableCoordinationStore, state => state);
  
  // Subscribe to specific entity - SHALLOW EQUALITY here is key
  const entity = useSelector(entityStore, state => {
    const entityMap = state[entityType + 's'] as Map<string, any>;
    return entityMap.get(entityId);
  });
  
  // Get optimistic overlays for this entity
  const optimisticOverlays = useMemo(() => {
    const overlays = new Map<string, any>();
    tableState.optimisticOperations.forEach((operation, operationId) => {
      if (operation.entityId === entityId) {
        overlays.set(operation.field, operation.newValue);
      }
    });
    return overlays;
  }, [tableState.optimisticOperations, entityId]);
  
  // Selection state for this row
  const isRowSelected = tableState.selectedRows.has(entityId);
  
  if (!entity) return null;
  
  console.log(`Rendering ${entityType} row ${entityId} - only when entity or table state changes`);
  
  return (
    <tr className={`table-row ${isRowSelected ? 'selected' : ''}`}>
      {columns.map(column => (
        <EntityTableCell
          key={`${entityId}-${column.field}`}
          entityId={entityId}
          field={column.field}
          entity={entity}
          optimisticValue={optimisticOverlays.get(column.field)}
          onCellClick={onCellClick}
          onCellEdit={onCellEdit}
        />
      ))}
    </tr>
  );
});

// Atomic cell component
const EntityTableCell = memo(({
  entityId,
  field,
  entity,
  optimisticValue,
  onCellClick,
  onCellEdit
}: {
  entityId: string;
  field: string;
  entity: any;
  optimisticValue?: any;
  onCellClick: (entityId: string, field: string) => void;
  onCellEdit: (entityId: string, field: string, value: any) => void;
}) => {
  // Table coordination state for this specific cell
  const cellKey = `${entityId}:${field}`;
  const isCellSelected = useSelector(
    tableCoordinationStore, 
    state => state.selectedCells.has(cellKey)
  );
  
  const isEditing = useSelector(
    tableCoordinationStore,
    state => state.editingCell?.entityId === entityId && state.editingCell?.field === field
  );
  
  // Display value: optimistic takes precedence over entity value
  const displayValue = optimisticValue !== undefined ? optimisticValue : entity[field];
  const hasOptimistic = optimisticValue !== undefined;
  
  console.log(`Rendering cell ${entityId}:${field} - value: ${displayValue}, optimistic: ${hasOptimistic}`);
  
  const handleClick = useCallback(() => {
    onCellClick(entityId, field);
  }, [entityId, field, onCellClick]);
  
  const handleEdit = useCallback((newValue: any) => {
    onCellEdit(entityId, field, newValue);
  }, [entityId, field, onCellEdit]);
  
  return (
    <td 
      className={`
        table-cell 
        ${isCellSelected ? 'selected' : ''} 
        ${isEditing ? 'editing' : ''}
        ${hasOptimistic ? 'optimistic' : ''}
      `}
      onClick={handleClick}
      onDoubleClick={() => {
        const newValue = prompt('New value:', String(displayValue));
        if (newValue !== null) {
          handleEdit(newValue);
        }
      }}
    >
      {hasOptimistic && <span className="optimistic-indicator">⏳</span>}
      {String(displayValue)}
    </td>
  );
});

// =====================================================
// 5. OPTIMISTIC OPERATIONS WITH ENTITY SYNC
// =====================================================

import { useActionState } from 'react';

const useEntityTableOperations = (entityType: 'task' | 'project' | 'user') => {
  // Get the appropriate entity store
  const entityStore = entityType === 'task' ? taskStore : 
                     entityType === 'project' ? projectStore : 
                     userStore;
  
  // React 19 action for optimistic entity updates
  const [, updateEntityAction, isPending] = useActionState(
    async (prevState, { entityId, field, value }: { 
      entityId: string; 
      field: string; 
      value: any 
    }) => {
      const operationId = crypto.randomUUID();
      
      // 1. Get current value for rollback
      const currentEntity = entityStore.getSnapshot()[entityType + 's'].get(entityId);
      const originalValue = currentEntity?.[field];
      
      // 2. Add optimistic operation to table coordination
      tableCoordinationStore.send({
        type: 'addOptimisticOperation',
        operationId,
        entityId,
        field,
        originalValue,
        newValue: value
      });
      
      try {
        // 3. Update server
        const result = await updateEntityOnServer(entityType, entityId, { [field]: value });
        
        // 4. Update entity store with server result (this triggers your sync system)
        entityStore.send({
          type: `update${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`,
          [`${entityType}Id`]: entityId,
          changes: result.data
        });
        
        // 5. Remove optimistic operation (entity store now has real data)
        tableCoordinationStore.send({
          type: 'removeOptimisticOperation',
          operationId
        });
        
        return { success: true, data: result };
      } catch (error) {
        // 6. Rollback - remove optimistic operation, entity store remains unchanged
        tableCoordinationStore.send({
          type: 'removeOptimisticOperation',
          operationId
        });
        
        throw error;
      }
    },
    null
  );
  
  // Bulk operations
  const [, bulkUpdateAction] = useActionState(
    async (prevState, { updates }: { updates: Array<{entityId: string; changes: Record<string, any>}> }) => {
      const operationIds: string[] = [];
      
      // Create optimistic operations for all updates
      updates.forEach(({ entityId, changes }) => {
        Object.entries(changes).forEach(([field, value]) => {
          const operationId = crypto.randomUUID();
          operationIds.push(operationId);
          
          const currentEntity = entityStore.getSnapshot()[entityType + 's'].get(entityId);
          const originalValue = currentEntity?.[field];
          
          tableCoordinationStore.send({
            type: 'addOptimisticOperation',
            operationId,
            entityId,
            field,
            originalValue,
            newValue: value
          });
        });
      });
      
      try {
        const results = await bulkUpdateEntitiesOnServer(entityType, updates);
        
        // Update entity store with results
        results.forEach((result: any) => {
          entityStore.send({
            type: `update${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`,
            [`${entityType}Id`]: result.id,
            changes: result.data
          });
        });
        
        // Remove all optimistic operations
        operationIds.forEach(operationId => {
          tableCoordinationStore.send({
            type: 'removeOptimisticOperation',
            operationId
          });
        });
        
        return { success: true, data: results };
      } catch (error) {
        // Rollback all optimistic operations
        operationIds.forEach(operationId => {
          tableCoordinationStore.send({
            type: 'removeOptimisticOperation',
            operationId
          });
        });
        
        throw error;
      }
    },
    null
  );
  
  return {
    updateEntityAction,
    bulkUpdateAction,
    isPending
  };
};

// =====================================================
// 6. SYNC EVENT INTEGRATION
// =====================================================

// Listen to your existing sync events and update entities
const useSyncEventIntegration = () => {
  useEffect(() => {
    // Listen to your sync events (WebSocket, SSE, polling, etc.)
    const unsubscribeSync = subscribToSyncEvents((event) => {
      switch (event.type) {
        case 'TASK_UPDATED':
          taskStore.send({
            type: 'updateTask',
            taskId: event.payload.id,
            changes: event.payload.changes
          });
          break;
          
        case 'TASK_CREATED':
          taskStore.send({
            type: 'hydrateTask',
            task: event.payload.task
          });
          break;
          
        case 'PROJECT_UPDATED':
          projectStore.send({
            type: 'updateProject',
            projectId: event.payload.id,
            changes: event.payload.changes
          });
          break;
          
        // Handle other entity types...
      }
    });
    
    return unsubscribeSync;
  }, []);
};

// =====================================================
// 7. MAIN TABLE COMPONENT WITH ENTITY INTEGRATION
// =====================================================

const EntityDataTable = ({ 
  entityType, 
  columns, 
  initialEntityIds = [] 
}: {
  entityType: 'task' | 'project' | 'user';
  columns: Column[];
  initialEntityIds?: string[];
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Set up sync event integration
  useSyncEventIntegration();
  
  // Initialize table coordination
  useEffect(() => {
    tableCoordinationStore.send({ type: 'setEntityType', entityType });
    tableCoordinationStore.send({ type: 'setVisibleEntities', entityIds: initialEntityIds });
  }, [entityType, initialEntityIds]);
  
  // Get table coordination state
  const tableState = useSelector(tableCoordinationStore, state => state);
  
  // Get entity operations
  const { updateEntityAction, bulkUpdateAction, isPending } = useEntityTableOperations(entityType);
  
  // Handle cell interactions
  const handleCellClick = useCallback((entityId: string, field: string) => {
    const cellKey = `${entityId}:${field}`;
    tableCoordinationStore.send({ type: 'toggleCellSelection', cellKey });
  }, []);
  
  const handleCellEdit = useCallback((entityId: string, field: string, value: any) => {
    updateEntityAction({ entityId, field, value });
  }, [updateEntityAction]);
  
  const handleRowClick = useCallback((entityId: string) => {
    tableCoordinationStore.send({ type: 'toggleRowSelection', entityId });
  }, []);
  
  return (
    <div className="entity-data-table">
      <div className="table-toolbar">
        <span>Editing {entityType}s</span>
        {isPending && <span className="loading">Saving...</span>}
        <button onClick={() => {
          const selectedRows = Array.from(tableState.selectedRows);
          if (selectedRows.length > 0) {
            bulkUpdateAction({
              updates: selectedRows.map(entityId => ({
                entityId,
                changes: { status: 'completed' }
              }))
            });
          }
        }}>
          Mark Selected Complete
        </button>
      </div>
      
      <div ref={containerRef} className="table-viewport">
        <table>
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column.field}>{column.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableState.visibleEntityIds.map(entityId => (
              <EntityTableRow
                key={entityId}
                entityId={entityId}
                entityType={entityType}
                columns={columns}
                onCellClick={handleCellClick}
                onCellEdit={handleCellEdit}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="table-status">
        {tableState.selectedRows.size > 0 && (
          <span>{tableState.selectedRows.size} rows selected</span>
        )}
        {tableState.optimisticOperations.size > 0 && (
          <span>{tableState.optimisticOperations.size} pending operations</span>
        )}
      </div>
    </div>
  );
};

// =====================================================
// 8. USAGE EXAMPLES
// =====================================================

// Task table
const TaskTable = () => (
  <EntityDataTable
    entityType="task"
    columns={[
      { field: 'name', name: 'Task Name' },
      { field: 'status', name: 'Status' },
      { field: 'assignee', name: 'Assignee' },
      { field: 'projectId', name: 'Project' }
    ]}
    initialEntityIds={['task-1', 'task-2', 'task-3']}
  />
);

// Project table
const ProjectTable = () => (
  <EntityDataTable
    entityType="project"
    columns={[
      { field: 'name', name: 'Project Name' },
      { field: 'description', name: 'Description' },
      { field: 'status', name: 'Status' },
      { field: 'ownerId', name: 'Owner' }
    ]}
    initialEntityIds={['proj-1', 'proj-2']}
  />
);
```

## Key Integration Benefits

### **1. No Data Duplication**
- Table coordination layer only manages UI state
- Entity data remains in your existing stores
- Sync events update entities directly
- Optimistic operations are lightweight overlays

### **2. Surgical Re-renders with Shallow Equality**
- Each cell only re-renders when its specific entity field changes
- Table UI state changes don't trigger entity re-renders
- Optimistic operations are isolated to affected cells only

### **3. Perfect Integration with Your Sync System**
- Existing entity stores continue to work unchanged
- Sync events (WebSocket, etc.) update entities as before
- Table automatically reflects entity changes via subscriptions

### **4. Optimistic Operations Flow**
```
1. User edits cell → Optimistic overlay in table coordination
2. Server request sent → Entity store unchanged
3. Server responds → Entity store updated via your sync system
4. Optimistic overlay removed → Cell shows real entity data
5. If error → Optimistic overlay removed, entity unchanged
```

### **5. Memory Efficiency**
- No duplication of entity data in table
- Optimistic operations are small, temporary overlays
- Virtual scrolling works with entity IDs, not full objects

This approach lets you keep your existing entity architecture while adding the high-performance table capabilities we discussed. The table becomes a view layer over your entities rather than a separate data store.

// =====================================================
// 2. ATOMIC SELECTORS WITH SHALLOW EQUALITY
// =====================================================

// Granular selectors that only trigger when specific atoms change
const tableSelectors = {
  // Row-specific selector - only re-renders when this specific row changes
  getRowAtom: (rowId: string) => (state: typeof tableStore.getSnapshot) => {
    return state.rows.get(rowId);
  },
  
  // Cell-specific selector - even more granular
  getCellValue: (rowId: string, columnId: string) => (state: typeof tableStore.getSnapshot) => {
    const row = state.rows.get(rowId);
    return row?.data[columnId];
  },
  
  // Cell metadata selector
  getCellMetadata: (rowId: string) => (state: typeof tableStore.getSnapshot) => {
    const row = state.rows.get(rowId);
    return row?.metadata;
  },
  
  // Selection state for specific cell
  isCellSelected: (cellKey: string) => (state: typeof tableStore.getSnapshot) => {
    return state.selectedCells.has(cellKey);
  },
  
  // Visible rows - only updates when visibility changes
  getVisibleRows: () => (state: typeof tableStore.getSnapshot) => {
    return state.visibleRowIds.map(id => state.rows.get(id)).filter(Boolean);
  },
  
  // Optimistic operation status
  getOptimisticStatus: (operationId: string) => (state: typeof tableStore.getSnapshot) => {
    return state.optimisticOperations.get(operationId);
  },
  
  // Dirty rows - for batch operations
  getDirtyRows: () => (state: typeof tableStore.getSnapshot) => {
    return Array.from(state.rows.values()).filter(row => row.metadata.isDirty);
  },
  
  // Editing state
  getEditingState: () => (state: typeof tableStore.getSnapshot) => {
    return state.editingCell;
  }
};

// =====================================================
// 3. ATOMIC ROW COMPONENT WITH SHALLOW EQUALITY
// =====================================================

import { useSelector } from '@xstate/store/react';
import { memo } from 'react';

// Atomic row component - only re-renders when its specific data changes
const AtomicTableRow = memo(({ 
  rowId, 
  columns, 
  onCellClick, 
  onCellEdit 
}: {
  rowId: string;
  columns: Column[];
  onCellClick: (rowId: string, columnId: string) => void;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
}) => {
  // Shallow equality - only re-renders when this specific row atom changes
  const rowAtom = useSelector(tableStore, tableSelectors.getRowAtom(rowId));
  
  // Early return if row doesn't exist
  if (!rowAtom) return null;
  
  console.log(`Rendering row ${rowId} - version ${rowAtom.metadata.version}`);
  
  return (
    <tr className={`
      table-row 
      ${rowAtom.metadata.isSelected ? 'selected' : ''} 
      ${rowAtom.metadata.isOptimistic ? 'optimistic' : ''}
      ${rowAtom.metadata.isDirty ? 'dirty' : ''}
    `}>
      {columns.map(column => (
        <AtomicTableCell
          key={`${rowId}-${column.id}`}
          rowId={rowId}
          columnId={column.id}
          onCellClick={onCellClick}
          onCellEdit={onCellEdit}
        />
      ))}
    </tr>
  );
});

// Even more granular - atomic cell component
const AtomicTableCell = memo(({
  rowId,
  columnId,
  onCellClick,
  onCellEdit
}: {
  rowId: string;
  columnId: string;
  onCellClick: (rowId: string, columnId: string) => void;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
}) => {
  // Only subscribes to this specific cell value
  const cellValue = useSelector(tableStore, tableSelectors.getCellValue(rowId, columnId));
  const cellMetadata = useSelector(tableStore, tableSelectors.getCellMetadata(rowId));
  const isSelected = useSelector(tableStore, tableSelectors.isCellSelected(`${rowId}:${columnId}`));
  
  console.log(`Rendering cell ${rowId}:${columnId} - value: ${cellValue}`);
  
  const handleClick = useCallback(() => {
    onCellClick(rowId, columnId);
  }, [rowId, columnId, onCellClick]);
  
  const handleEdit = useCallback((newValue: any) => {
    onCellEdit(rowId, columnId, newValue);
  }, [rowId, columnId, onCellEdit]);
  
  return (
    <td 
      className={`
        table-cell 
        ${isSelected ? 'selected' : ''} 
        ${cellMetadata?.isEditing ? 'editing' : ''}
        ${cellMetadata?.isOptimistic ? 'optimistic' : ''}
      `}
      onClick={handleClick}
      onDoubleClick={() => handleEdit(prompt('New value:', cellValue) || cellValue)}
    >
      {cellMetadata?.isOptimistic && <span className="optimistic-indicator">⏳</span>}
      {cellValue}
    </td>
  );
});

// =====================================================
// 4. HYBRID RENDERER INTEGRATION
// =====================================================

// Enhanced renderer that works with atomic updates
class AtomicTableRenderer {
  private container: HTMLElement;
  private store: typeof tableStore;
  private subscriptions: Map<string, () => void> = new Map();
  private virtualScroller: VirtualScroller;
  
  constructor(container: HTMLElement, store: typeof tableStore) {
    this.container = container;
    this.store = store;
    this.virtualScroller = new VirtualScroller(container);
    this.setupAtomicSubscriptions();
  }
  
  setupAtomicSubscriptions() {
    // Subscribe to table-level changes
    const unsubscribeTable = this.store.subscribe((state) => {
      // Only re-render if table structure changed
      this.updateTableStructure(state);
    });
    
    this.subscriptions.set('table', unsubscribeTable);
  }
  
  // Subscribe to specific row atoms for targeted updates
  subscribeToRow(rowId: string) {
    if (this.subscriptions.has(rowId)) return;
    
    const unsubscribe = this.store.subscribe((state) => {
      const rowAtom = state.rows.get(rowId);
      if (rowAtom) {
        this.updateRowElement(rowId, rowAtom);
      }
    });
    
    this.subscriptions.set(rowId, unsubscribe);
  }
  
  unsubscribeFromRow(rowId: string) {
    const unsubscribe = this.subscriptions.get(rowId);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(rowId);
    }
  }
  
  // Atomic row updates - only update what changed
  updateRowElement(rowId: string, rowAtom: RowAtom) {
    const rowElement = this.container.querySelector(`[data-row-id="${rowId}"]`);
    if (!rowElement) return;
    
    // Update classes based on metadata
    rowElement.className = this.computeRowClasses(rowAtom.metadata);
    
    // Update individual cells
    Object.entries(rowAtom.data).forEach(([columnId, value]) => {
      const cellElement = rowElement.querySelector(`[data-cell="${rowId}:${columnId}"]`);
      if (cellElement && cellElement.textContent !== String(value)) {
        cellElement.textContent = String(value);
        
        // Add optimistic styling
        if (rowAtom.metadata.isOptimistic) {
          cellElement.classList.add('optimistic');
          setTimeout(() => cellElement.classList.remove('optimistic'), 2000);
        }
      }
    });
  }
  
  // Virtual scrolling integration with atomic subscriptions
  updateVisibleRows(visibleRowIds: string[]) {
    const currentVisible = new Set(this.subscriptions.keys());
    const newVisible = new Set(visibleRowIds);
    
    // Unsubscribe from rows no longer visible
    currentVisible.forEach(rowId => {
      if (rowId !== 'table' && !newVisible.has(rowId)) {
        this.unsubscribeFromRow(rowId);
      }
    });
    
    // Subscribe to newly visible rows
    newVisible.forEach(rowId => {
      if (!currentVisible.has(rowId)) {
        this.subscribeToRow(rowId);
      }
    });
  }
  
  computeRowClasses(metadata: RowAtom['metadata']): string {
    return [
      'table-row',
      metadata.isSelected && 'selected',
      metadata.isEditing && 'editing',
      metadata.isDirty && 'dirty',
      metadata.isOptimistic && 'optimistic'
    ].filter(Boolean).join(' ');
  }
  
  destroy() {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions.clear();
  }
}

// =====================================================
// 5. REACT 19 INTEGRATION WITH ATOMIC PATTERNS
// =====================================================

import { useActionState, useOptimistic } from 'react';

// Atomic operations with React 19 Actions
const useAtomicTableOperations = () => {
  // React 19 action for optimistic updates
  const [, updateCellAction, isPending] = useActionState(
    async (prevState, { rowId, columnId, value }: { 
      rowId: string; 
      columnId: string; 
      value: any 
    }) => {
      const operationId = crypto.randomUUID();
      
      // 1. Immediate optimistic update to atom
      tableStore.send({
        type: 'updateRowOptimistic',
        rowId,
        changes: { [columnId]: value },
        operationId
      });
      
      try {
        // 2. Server update
        const result = await updateCellOnServer(rowId, columnId, value);
        
        // 3. Confirm optimistic update
        tableStore.send({
          type: 'confirmOptimistic',
          operationId
        });
        
        return { success: true, data: result };
      } catch (error) {
        // 4. Rollback optimistic update
        tableStore.send({
          type: 'rollbackOptimistic',
          operationId
        });
        
        throw error;
      }
    },
    null
  );
  
  // Bulk operations
  const [, bulkUpdateAction] = useActionState(
    async (prevState, { updates }: { updates: Array<{rowId: string; changes: any}> }) => {
      const operationIds = updates.map(() => crypto.randomUUID());
      
      // Optimistic bulk update
      updates.forEach(({ rowId, changes }, index) => {
        tableStore.send({
          type: 'updateRowOptimistic',
          rowId,
          changes,
          operationId: operationIds[index]
        });
      });
      
      try {
        const results = await bulkUpdateOnServer(updates);
        
        // Confirm all operations
        operationIds.forEach(operationId => {
          tableStore.send({ type: 'confirmOptimistic', operationId });
        });
        
        return { success: true, data: results };
      } catch (error) {
        // Rollback all operations
        operationIds.forEach(operationId => {
          tableStore.send({ type: 'rollbackOptimistic', operationId });
        });
        
        throw error;
      }
    },
    null
  );
  
  return {
    updateCellAction,
    bulkUpdateAction,
    isPending
  };
};

// Main table component with atomic architecture
const AtomicDataTable = ({ columns, initialData }: {
  columns: Column[];
  initialData: any[];
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AtomicTableRenderer>();
  
  // Initialize store with data
  useEffect(() => {
    const rowAtoms = new Map(
      initialData.map(row => [
        row.id,
        {
          id: row.id,
          data: row,
          metadata: {
            version: 0,
            isSelected: false,
            isEditing: false,
            isDirty: false,
            isOptimistic: false,
            lastModified: Date.now()
          }
        } as RowAtom
      ])
    );
    
    tableStore.send({
      type: 'bulkUpdateRows',
      updates: initialData.map(row => ({ rowId: row.id, changes: row }))
    });
  }, [initialData]);
  
  // Initialize atomic renderer
  useEffect(() => {
    if (containerRef.current && !rendererRef.current) {
      rendererRef.current = new AtomicTableRenderer(containerRef.current, tableStore);
    }
    
    return () => {
      rendererRef.current?.destroy();
    };
  }, []);
  
  // Atomic operations
  const { updateCellAction, bulkUpdateAction, isPending } = useAtomicTableOperations();
  
  // Subscribe to visible rows for virtual scrolling
  const visibleRowIds = useSelector(tableStore, tableSelectors.getVisible
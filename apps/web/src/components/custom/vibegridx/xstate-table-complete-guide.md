# XState 5 Complete Data Table Implementation Guide
## Building Notion/ClickUp-Level Performance and Features

### Table of Contents
1. [Core Architecture](#core-architecture)
2. [State Management Patterns](#state-management-patterns)
3. [Feature-by-Feature Implementation](#feature-by-feature-implementation)
4. [Performance Optimization](#performance-optimization)
5. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
6. [Complete Examples](#complete-examples)

---

## Core Architecture

### Hybrid Actor Hierarchy

```typescript
// Global singleton for truly shared resources
GlobalTableRegistry
├── SharedServices (clipboard, undo, settings)
├── TableInstances (per-table spawning)
│   ├── DataManager (CRUD operations)
│   ├── ViewCoordinator (layout, grouping, sorting)
│   ├── SelectionCoordinator (multi-cell selection)
│   ├── EditCoordinator (inline editing, formulas)
│   ├── FilterEngine (advanced filtering)
│   ├── DragCoordinator (all drag operations)
│   └── RowActors (virtualized per visible row)
└── CrossTableServices (drag between tables)
```

### Core Principles

1. **Actor per Concern, Not per Component**: Each business logic domain gets its own actor
2. **Selective Coordination**: Only coordinate when necessary, maintain isolation otherwise  
3. **Virtual Everything**: Only spawn actors for visible/active elements
4. **Event-Driven Communication**: Loose coupling through well-typed events
5. **Optimistic Updates**: Immediate UI feedback with server reconciliation

---

## State Management Patterns

### 1. Base Table Machine Setup

```typescript
import { setup, assign, spawn, sendTo, raise } from 'xstate';

// Core types for the entire table system
interface TableContext {
  id: string;
  rows: Map<string, TableRow>;
  columns: Column[];
  visibleRowIds: string[];
  actors: {
    dataManager: any;
    viewCoordinator: any;
    selectionCoordinator: any;
    editCoordinator: any;
    filterEngine: any;
    dragCoordinator: any;
    rowActors: Map<string, any>;
  };
  settings: TableSettings;
}

interface TableRow {
  id: string;
  data: Record<string, any>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: number;
    isNew?: boolean;
    isDirty?: boolean;
  };
}

// Base table machine that orchestrates all features
const tableBaseMachine = setup({
  types: {
    context: {} as TableContext,
    events: {} as TableEvents
  },
  actors: {
    dataManager,
    viewCoordinator, 
    selectionCoordinator,
    editCoordinator,
    filterEngine,
    dragCoordinator,
    rowActor
  }
}).createMachine({
  id: 'table',
  initial: 'initializing',
  context: ({ input }) => ({
    id: input.id,
    rows: new Map(input.data?.map(row => [row.id, row]) || []),
    columns: input.columns || [],
    visibleRowIds: [],
    actors: {
      dataManager: null,
      viewCoordinator: null,
      selectionCoordinator: null,
      editCoordinator: null,
      filterEngine: null,
      dragCoordinator: null,
      rowActors: new Map()
    },
    settings: input.settings || defaultSettings
  }),
  states: {
    initializing: {
      entry: [
        // Spawn feature actors
        assign({
          actors: ({ spawn, context }) => ({
            dataManager: spawn('dataManager', { input: { tableId: context.id } }),
            viewCoordinator: spawn('viewCoordinator', { input: { columns: context.columns } }),
            selectionCoordinator: spawn('selectionCoordinator'),
            editCoordinator: spawn('editCoordinator'),
            filterEngine: spawn('filterEngine'),
            dragCoordinator: spawn('dragCoordinator'),
            rowActors: new Map()
          })
        })
      ],
      always: 'ready'
    },
    ready: {
      type: 'parallel',
      states: {
        dataOperations: {
          // Forward data events to data manager
          on: {
            'data.*': {
              actions: sendTo(({ context }) => context.actors.dataManager, ({ event }) => event)
            }
          }
        },
        viewOperations: {
          // Forward view events to view coordinator
          on: {
            'view.*': {
              actions: sendTo(({ context }) => context.actors.viewCoordinator, ({ event }) => event)
            }
          }
        },
        selectionOperations: {
          // Forward selection events
          on: {
            'selection.*': {
              actions: sendTo(({ context }) => context.actors.selectionCoordinator, ({ event }) => event)
            }
          }
        }
      }
    }
  }
});
```

### 2. Event Architecture

```typescript
// Namespaced, strongly-typed events
type TableEvents = 
  // Data events
  | { type: 'data.row.create'; row: Partial<TableRow> }
  | { type: 'data.row.update'; rowId: string; changes: Partial<TableRow> }
  | { type: 'data.row.delete'; rowId: string }
  | { type: 'data.bulk.update'; updates: BulkUpdate[] }
  
  // View events
  | { type: 'view.group.set'; groupBy: string[] }
  | { type: 'view.sort.set'; sortBy: SortConfig[] }
  | { type: 'view.filter.set'; filters: FilterConfig[] }
  | { type: 'view.columns.hide'; columnIds: string[] }
  | { type: 'view.columns.reorder'; newOrder: string[] }
  
  // Selection events
  | { type: 'selection.cell.select'; rowId: string; columnId: string }
  | { type: 'selection.range.select'; start: CellRef; end: CellRef }
  | { type: 'selection.row.select'; rowId: string; extend?: boolean }
  | { type: 'selection.column.select'; columnId: string; extend?: boolean }
  | { type: 'selection.all.select' }
  | { type: 'selection.clear' }
  
  // Edit events
  | { type: 'edit.cell.start'; rowId: string; columnId: string }
  | { type: 'edit.cell.commit'; value: any }
  | { type: 'edit.cell.cancel' }
  | { type: 'edit.row.create'; insertAfter?: string }
  
  // Keyboard events
  | { type: 'keyboard.arrow'; direction: 'up' | 'down' | 'left' | 'right'; extend?: boolean }
  | { type: 'keyboard.copy' }
  | { type: 'keyboard.paste' }
  | { type: 'keyboard.delete' }
  | { type: 'keyboard.enter'; shift?: boolean }
  
  // Drag events
  | { type: 'drag.row.start'; rowId: string }
  | { type: 'drag.row.over'; targetRowId: string; position: 'above' | 'below' }
  | { type: 'drag.row.drop' }
  | { type: 'drag.fill.start'; cellRef: CellRef }
  | { type: 'drag.fill.extend'; endRef: CellRef }
  | { type: 'drag.fill.apply' };

// Event creators with validation
const createTableEvent = <T extends TableEvents['type']>(
  type: T,
  payload: Extract<TableEvents, { type: T }> extends { type: T } & infer P ? P : never
): Extract<TableEvents, { type: T }> => {
  return { type, ...payload } as Extract<TableEvents, { type: T }>;
};
```

---

## Feature-by-Feature Implementation

### 1. Group By Status

**Pattern**: Computation Actor with Caching

```typescript
const viewCoordinator = setup({
  types: {
    context: {} as {
      groupBy: string[];
      groupTree: GroupNode[];
      collapsedGroups: Set<string>;
      groupCache: Map<string, GroupNode[]>;
      sortWithinGroups: SortConfig[];
    }
  }
}).createMachine({
  id: 'viewCoordinator',
  initial: 'ungrouped',
  context: {
    groupBy: [],
    groupTree: [],
    collapsedGroups: new Set(),
    groupCache: new Map(),
    sortWithinGroups: []
  },
  states: {
    ungrouped: {
      on: {
        'view.group.set': {
          target: 'computing',
          actions: assign({
            groupBy: ({ event }) => event.groupBy
          })
        }
      }
    },
    computing: {
      invoke: {
        src: 'computeGroupTree',
        input: ({ context, event }) => ({
          rows: Array.from(context.rows.values()),
          groupBy: context.groupBy,
          sortBy: context.sortWithinGroups
        }),
        onDone: {
          target: 'grouped',
          actions: assign({
            groupTree: ({ event }) => event.output.tree,
            groupCache: ({ context, event }) => {
              const cache = new Map(context.groupCache);
              cache.set(JSON.stringify(context.groupBy), event.output.tree);
              return cache;
            }
          })
        }
      }
    },
    grouped: {
      on: {
        'view.group.toggle': {
          actions: assign({
            collapsedGroups: ({ context, event }) => {
              const collapsed = new Set(context.collapsedGroups);
              if (collapsed.has(event.groupId)) {
                collapsed.delete(event.groupId);
              } else {
                collapsed.add(event.groupId);
              }
              return collapsed;
            }
          })
        },
        'view.group.set': {
          target: 'computing',
          actions: assign({
            groupBy: ({ event }) => event.groupBy
          })
        },
        'data.row.update': {
          // Check if update affects grouping
          target: 'computing',
          guard: ({ context, event }) => {
            return context.groupBy.some(field => 
              Object.keys(event.changes).includes(field)
            );
          }
        }
      }
    }
  }
});

// Efficient group computation
const computeGroupTree = async ({ input }) => {
  const { rows, groupBy, sortBy } = input;
  
  if (groupBy.length === 0) {
    return { tree: [{ id: 'root', children: rows, level: 0 }] };
  }
  
  // Multi-level grouping with sorting
  const tree = buildGroupTree(rows, groupBy, sortBy);
  return { tree };
};

function buildGroupTree(rows: TableRow[], groupBy: string[], sortBy: SortConfig[], level = 0): GroupNode[] {
  if (level >= groupBy.length) {
    return rows.sort((a, b) => applySorting(a, b, sortBy));
  }
  
  const field = groupBy[level];
  const groups = new Map<any, TableRow[]>();
  
  // Group by current field
  rows.forEach(row => {
    const value = row.data[field];
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value)!.push(row);
  });
  
  // Recursively build sub-groups
  return Array.from(groups.entries()).map(([value, groupRows]) => ({
    id: `${field}-${value}-${level}`,
    field,
    value,
    level,
    rowCount: groupRows.length,
    children: buildGroupTree(groupRows, groupBy, sortBy, level + 1),
    summary: calculateGroupSummary(groupRows)
  }));
}
```

**React Integration**:
```typescript
const GroupedTable = memo(() => {
  const viewActor = useSelector(tableService, state => state.context.actors.viewCoordinator);
  const groupTree = useSelector(viewActor, state => state.context.groupTree);
  const collapsedGroups = useSelector(viewActor, state => state.context.collapsedGroups);
  
  const renderGroupNode = useCallback((node: GroupNode, depth = 0) => {
    if (node.children.length === 0) return null;
    
    const isCollapsed = collapsedGroups.has(node.id);
    
    return (
      <div key={node.id} style={{ paddingLeft: depth * 20 }}>
        <div 
          className="group-header"
          onClick={() => send({ type: 'view.group.toggle', groupId: node.id })}
        >
          <span>{isCollapsed ? '▶' : '▼'}</span>
          <span>{node.field}: {node.value}</span>
          <span>({node.rowCount} rows)</span>
        </div>
        {!isCollapsed && (
          <div className="group-content">
            {node.level < groupBy.length - 1 ? (
              // Render sub-groups
              node.children.map(child => renderGroupNode(child, depth + 1))
            ) : (
              // Render rows
              <RowList rows={node.children} />
            )}
          </div>
        )}
      </div>
    );
  }, [collapsedGroups, send]);
  
  return (
    <div className="grouped-table">
      {groupTree.map(node => renderGroupNode(node))}
    </div>
  );
});
```

### 2. Inline New Row

**Pattern**: Optimistic Row Creation with Validation

```typescript
const editCoordinator = setup({
  types: {
    context: {} as {
      newRowTemplate: Partial<TableRow>;
      activeNewRow: string | null;
      editingCells: Map<string, EditingState>;
      validationErrors: Map<string, ValidationError>;
    }
  }
}).createMachine({
  id: 'editCoordinator',
  initial: 'idle',
  context: {
    newRowTemplate: {},
    activeNewRow: null,
    editingCells: new Map(),
    validationErrors: new Map()
  },
  states: {
    idle: {
      on: {
        'edit.row.create': {
          target: 'creatingRow',
          actions: assign({
            activeNewRow: ({ event }) => generateNewRowId(),
            newRowTemplate: ({ context, event }) => ({
              ...context.newRowTemplate,
              ...getDefaultRowData(event.insertAfter)
            })
          })
        }
      }
    },
    creatingRow: {
      entry: [
        // Spawn temporary row actor for new row
        ({ context, spawn }) => {
          const rowActor = spawn('rowActor', {
            input: {
              id: context.activeNewRow,
              data: context.newRowTemplate,
              isNew: true
            },
            systemId: `new-row-${context.activeNewRow}`
          });
          context.actors.rowActors.set(context.activeNewRow, rowActor);
        },
        // Auto-focus first editable cell
        raise({ type: 'edit.cell.start', rowId: context.activeNewRow, columnId: getFirstEditableColumn() })
      ],
      on: {
        'edit.cell.commit': [
          {
            // If committing the last required field, save the row
            guard: 'allRequiredFieldsComplete',
            target: 'saving',
            actions: 'collectNewRowData'
          },
          {
            // Otherwise, continue editing
            actions: 'updateNewRowField'
          }
        ],
        'edit.row.cancel': {
          target: 'idle',
          actions: [
            'cleanupNewRow',
            assign({
              activeNewRow: null,
              newRowTemplate: {}
            })
          ]
        },
        'keyboard.tab': {
          actions: 'moveToNextEditableCell'
        },
        'keyboard.enter': [
          {
            guard: 'allRequiredFieldsComplete',
            target: 'saving'
          },
          {
            actions: 'moveToNextEditableCell'
          }
        ]
      }
    },
    saving: {
      invoke: {
        src: 'saveNewRow',
        input: ({ context }) => ({
          rowData: context.newRowTemplate,
          insertAfter: context.insertAfter
        }),
        onDone: {
          target: 'idle',
          actions: [
            // Update row actor with server response
            ({ context, event }) => {
              const rowActor = context.actors.rowActors.get(context.activeNewRow);
              if (rowActor) {
                rowActor.send({ 
                  type: 'CONFIRM_CREATION', 
                  serverData: event.output 
                });
              }
            },
            // Send to data manager
            sendTo(({ context }) => context.actors.dataManager, ({ event }) => ({
              type: 'ROW_CREATED',
              row: event.output
            })),
            assign({
              activeNewRow: null,
              newRowTemplate: {}
            })
          ]
        },
        onError: {
          target: 'creatingRow',
          actions: assign({
            validationErrors: ({ event }) => new Map([
              ['server', { message: event.error.message }]
            ])
          })
        }
      }
    }
  }
});

// Enhanced row actor for new row handling
const rowActor = setup({
  types: {
    context: {} as {
      id: string;
      data: Record<string, any>;
      isNew: boolean;
      isDirty: boolean;
      optimisticChanges: Record<string, any>;
      validationErrors: Map<string, string>;
    }
  }
}).createMachine({
  id: 'row',
  initial: ({ input }) => input.isNew ? 'new' : 'idle',
  context: ({ input }) => ({
    id: input.id,
    data: input.data,
    isNew: input.isNew || false,
    isDirty: false,
    optimisticChanges: {},
    validationErrors: new Map()
  }),
  states: {
    new: {
      on: {
        UPDATE_FIELD: {
          actions: [
            assign({
              optimisticChanges: ({ context, event }) => ({
                ...context.optimisticChanges,
                [event.field]: event.value
              }),
              isDirty: true
            }),
            // Send validation request
            raise(({ event }) => ({ type: 'VALIDATE_FIELD', field: event.field }))
          ]
        },
        CONFIRM_CREATION: {
          target: 'idle',
          actions: assign({
            data: ({ event }) => event.serverData,
            isNew: false,
            isDirty: false,
            optimisticChanges: {}
          })
        }
      }
    },
    idle: {
      // Regular row behavior
    }
  }
});
```

### 3. Drag to Reorder

**Pattern**: Drag Coordinator with Preview and Constraints

```typescript
const dragCoordinator = setup({
  types: {
    context: {} as {
      dragContext: 'row' | 'column' | 'group' | null;
      draggedItem: DraggedItem | null;
      dropTarget: DropTarget | null;
      dragPreview: DragPreview | null;
      constraints: DragConstraints;
      isActive: boolean;
    }
  }
}).createMachine({
  id: 'dragCoordinator',
  initial: 'idle',
  context: {
    dragContext: null,
    draggedItem: null,
    dropTarget: null,
    dragPreview: null,
    constraints: {},
    isActive: false
  },
  states: {
    idle: {
      on: {
        'drag.row.start': {
          target: 'draggingRow',
          actions: assign({
            dragContext: 'row',
            draggedItem: ({ event }) => ({
              type: 'row',
              id: event.rowId,
              data: event.rowData
            }),
            isActive: true
          })
        },
        'drag.column.start': {
          target: 'draggingColumn',
          actions: assign({
            dragContext: 'column',
            draggedItem: ({ event }) => ({
              type: 'column',
              id: event.columnId
            }),
            isActive: true
          })
        }
      }
    },
    draggingRow: {
      on: {
        'drag.over': {
          actions: assign({
            dropTarget: ({ event }) => ({
              type: 'row',
              id: event.targetRowId,
              position: event.position,
              valid: validateRowDrop(event)
            }),
            dragPreview: ({ event }) => generateRowDropPreview(event)
          })
        },
        'drag.drop': [
          {
            guard: 'isValidRowDrop',
            target: 'idle',
            actions: [
              // Apply the reorder
              sendTo(({ context }) => context.actors.dataManager, ({ context, event }) => ({
                type: 'REORDER_ROWS',
                draggedRowId: context.draggedItem.id,
                targetRowId: context.dropTarget.id,
                position: context.dropTarget.position
              })),
              'clearDragState'
            ]
          },
          {
            target: 'idle',
            actions: 'clearDragState'
          }
        ],
        'drag.cancel': {
          target: 'idle',
          actions: 'clearDragState'
        }
      }
    },
    draggingColumn: {
      on: {
        'drag.over': {
          actions: assign({
            dropTarget: ({ event }) => ({
              type: 'column',
              id: event.targetColumnId,
              position: event.position,
              valid: validateColumnDrop(event)
            })
          })
        },
        'drag.drop': [
          {
            guard: 'isValidColumnDrop',
            target: 'idle',
            actions: [
              sendTo(({ context }) => context.actors.viewCoordinator, ({ context }) => ({
                type: 'REORDER_COLUMNS',
                draggedColumnId: context.draggedItem.id,
                targetColumnId: context.dropTarget.id,
                position: context.dropTarget.position
              })),
              'clearDragState'
            ]
          }
        ]
      }
    }
  }
});

// React integration with HTML5 drag and drop
const DraggableRow = memo(({ rowId, rowActor, dragCoordinator }) => {
  const rowData = useSelector(rowActor, state => state.context.data);
  const isDragging = useSelector(dragCoordinator, state => 
    state.context.draggedItem?.id === rowId
  );
  
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', rowId);
    
    dragCoordinator.send({
      type: 'drag.row.start',
      rowId,
      rowData
    });
  }, [rowId, rowData]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const position = y < rect.height / 2 ? 'above' : 'below';
    
    dragCoordinator.send({
      type: 'drag.over',
      targetRowId: rowId,
      position
    });
  }, [rowId]);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCoordinator.send({ type: 'drag.drop' });
  }, []);
  
  return (
    <tr
      draggable
      className={`row ${isDragging ? 'dragging' : ''}`}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <td className="drag-handle">⋮⋮</td>
      {/* Row cells */}
    </tr>
  );
});
```

### 4. Advanced Filtering

**Pattern**: Filter Engine with Query Builder

```typescript
const filterEngine = setup({
  types: {
    context: {} as {
      filters: FilterExpression[];
      filterMode: 'AND' | 'OR';
      quickFilter: string;
      customFilters: Map<string, CustomFilter>;
      filterCache: Map<string, Set<string>>; // Cache for expensive filters
      visibleRows: Set<string>;
      filterStats: FilterStats;
    }
  }
}).createMachine({
  id: 'filterEngine',
  initial: 'idle',
  context: {
    filters: [],
    filterMode: 'AND',
    quickFilter: '',
    customFilters: new Map(),
    filterCache: new Map(),
    visibleRows: new Set(),
    filterStats: { total: 0, visible: 0, filtered: 0 }
  },
  states: {
    idle: {
      on: {
        'filter.add': {
          target: 'filtering',
          actions: assign({
            filters: ({ context, event }) => [...context.filters, event.filter]
          })
        },
        'filter.update': {
          target: 'filtering',
          actions: assign({
            filters: ({ context, event }) => 
              context.filters.map(f => 
                f.id === event.filterId ? { ...f, ...event.updates } : f
              )
          })
        },
        'filter.remove': {
          target: 'filtering',
          actions: assign({
            filters: ({ context, event }) => 
              context.filters.filter(f => f.id !== event.filterId)
          })
        },
        'filter.quick': {
          target: 'debouncing',
          actions: assign({
            quickFilter: ({ event }) => event.query
          })
        }
      }
    },
    debouncing: {
      after: {
        300: 'filtering'
      },
      on: {
        'filter.quick': {
          target: 'debouncing',
          actions: assign({
            quickFilter: ({ event }) => event.query
          })
        }
      }
    },
    filtering: {
      invoke: {
        src: 'applyFilters',
        input: ({ context }) => ({
          filters: context.filters,
          mode: context.filterMode,
          quickFilter: context.quickFilter,
          rows: context.allRows
        }),
        onDone: {
          target: 'idle',
          actions: assign({
            visibleRows: ({ event }) => new Set(event.output.visibleRowIds),
            filterStats: ({ event }) => event.output.stats,
            filterCache: ({ context, event }) => {
              const cache = new Map(context.filterCache);
              // Cache expensive filter results
              event.output.cacheEntries.forEach(([key, value]) => {
                cache.set(key, value);
              });
              return cache;
            }
          })
        }
      }
    }
  }
});

// Advanced filter types
interface FilterExpression {
  id: string;
  column: string;
  operator: FilterOperator;
  value: any;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'select';
  caseSensitive?: boolean;
  negate?: boolean;
}

type FilterOperator = 
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'greater_than' | 'less_than' | 'between'
  | 'is_empty' | 'is_not_empty'
  | 'in' | 'not_in'
  | 'regex'
  | 'custom';

// Filter application with caching
const applyFilters = async ({ input }) => {
  const { filters, mode, quickFilter, rows } = input;
  
  let visibleRowIds = new Set(rows.map(r => r.id));
  const cacheEntries = [];
  
  // Apply quick filter first (most common)
  if (quickFilter) {
    const quickFilterKey = `quick:${quickFilter}`;
    let quickResults = filterCache.get(quickFilterKey);
    
    if (!quickResults) {
      quickResults = new Set(
        rows
          .filter(row => 
            Object.values(row.data).some(value => 
              String(value).toLowerCase().includes(quickFilter.toLowerCase())
            )
          )
          .map(row => row.id)
      );
      cacheEntries.push([quickFilterKey, quickResults]);
    }
    
    visibleRowIds = new Set([...visibleRowIds].filter(id => quickResults.has(id)));
  }
  
  // Apply column filters
  for (const filter of filters) {
    const filterKey = `${filter.column}:${filter.operator}:${JSON.stringify(filter.value)}`;
    let filterResults = filterCache.get(filterKey);
    
    if (!filterResults) {
      filterResults = new Set();
      
      for (const row of rows) {
        const cellValue = row.data[filter.column];
        const matches = evaluateFilter(cellValue, filter);
        
        if (matches !== filter.negate) {
          filterResults.add(row.id);
        }
      }
      
      cacheEntries.push([filterKey, filterResults]);
    }
    
    if (mode === 'AND') {
      visibleRowIds = new Set([...visibleRowIds].filter(id => filterResults.has(id)));
    } else {
      // OR mode - union of results
      visibleRowIds = new Set([...visibleRowIds, ...filterResults]);
    }
  }
  
  return {
    visibleRowIds: Array.from(visibleRowIds),
    stats: {
      total: rows.length,
      visible: visibleRowIds.size,
      filtered: rows.length - visibleRowIds.size
    },
    cacheEntries
  };
};

function evaluateFilter(value: any, filter: FilterExpression): boolean {
  switch (filter.operator) {
    case 'equals':
      return filter.caseSensitive 
        ? value === filter.value
        : String(value).toLowerCase() === String(filter.value).toLowerCase();
    
    case 'contains':
      return filter.caseSensitive
        ? String(value).includes(String(filter.value))
        : String(value).toLowerCase().includes(String(filter.value).toLowerCase());
    
    case 'greater_than':
      return Number(value) > Number(filter.value);
    
    case 'between':
      const num = Number(value);
      return num >= filter.value[0] && num <= filter.value[1];
    
    case 'regex':
      const regex = new RegExp(filter.value, filter.caseSensitive ? '' : 'i');
      return regex.test(String(value));
    
    case 'is_empty':
      return value == null || value === '';
    
    case 'in':
      return Array.isArray(filter.value) && filter.value.includes(value);
    
    default:
      return true;
  }
}
```

### 5. Spreadsheet-Style Selection

**Pattern**: Selection Coordinator with Keyboard Navigation

```typescript
const selectionCoordinator = setup({
  types: {
    context: {} as {
      selectedCells: Set<string>; // "rowId:columnId"
      activeCell: CellRef | null;
      selectionRanges: SelectionRange[];
      selectionMode: 'single' | 'range' | 'column' | 'row';
      anchor: CellRef | null; // For range selection
      clipboard: ClipboardData | null;
      fillHandle: FillHandle | null;
    }
  }
}).createMachine({
  id: 'selectionCoordinator',
  initial: 'idle',
  context: {
    selectedCells: new Set(),
    activeCell: null,
    selectionRanges: [],
    selectionMode: 'single',
    anchor: null,
    clipboard: null,
    fillHandle: null
  },
  states: {
    idle: {
      on: {
        'selection.cell.click': {
          actions: assign({
            activeCell: ({ event }) => ({ rowId: event.rowId, columnId: event.columnId }),
            selectedCells: ({ event, context }) => {
              const cellKey = `${event.rowId}:${event.columnId}`;
              
              if (event.ctrlKey) {
                // Multi-select
                const cells = new Set(context.selectedCells);
                if (cells.has(cellKey)) {
                  cells.delete(cellKey);
                } else {
                  cells.add(cellKey);
                }
                return cells;
              } else if (event.shiftKey && context.anchor) {
                // Range select
                return calculateRangeSelection(context.anchor, { 
                  rowId: event.rowId, 
                  columnId: event.columnId 
                });
              } else {
                // Single select
                return new Set([cellKey]);
              }
            }),
            anchor: ({ event, context }) => 
              event.shiftKey && context.anchor ? context.anchor : { 
                rowId: event.rowId, 
                columnId: event.columnId 
              }
          })
        },
        
        'keyboard.arrow': {
          actions: assign({
            activeCell: ({ context, event }) => {
              if (!context.activeCell) return null;
              
              const newCell = moveCell(context.activeCell, event.direction);
              
              if (event.extend) {
                // Extend selection
                const anchor = context.anchor || context.activeCell;
                context.selectedCells = calculateRangeSelection(anchor, newCell);
              } else {
                // Move selection
                context.selectedCells = new Set([`${newCell.rowId}:${newCell.columnId}`]);
                context.anchor = newCell;
              }
              
              return newCell;
            })
          })
        },
        
        'keyboard.copy': {
          actions: assign({
            clipboard: ({ context }) => ({
              cells: Array.from(context.selectedCells),
              data: extractCellData(context.selectedCells),
              mode: 'copy',
              timestamp: Date.now()
            })
          })
        },
        
        'keyboard.paste': {
          actions: [
            // Apply clipboard data to selected cells
            ({ context }) => {
              if (context.clipboard && context.activeCell) {
                applyClipboardData(context.clipboard, context.activeCell);
              }
            }
          ]
        },
        
        'selection.fill.start': {
          target: 'filling',
          actions: assign({
            fillHandle: ({ event }) => ({
              source: event.cellRef,
              value: event.value,
              direction: null,
              targetCells: new Set()
            })
          })
        }
      }
    },
    
    filling: {
      on: {
        'selection.fill.extend': {
          actions: assign({
            fillHandle: ({ context, event }) => ({
              ...context.fillHandle,
              direction: calculateFillDirection(context.fillHandle.source, event.targetRef),
              targetCells: calculateFillRange(context.fillHandle.source, event.targetRef)
            })
          })
        },
        
        'selection.fill.apply': {
          target: 'idle',
          actions: [
            // Apply fill operation
            ({ context }) => {
              if (context.fillHandle) {
                applyFillOperation(context.fillHandle);
              }
            },
            assign({
              fillHandle: null
            })
          ]
        },
        
        'selection.fill.cancel': {
          target: 'idle',
          actions: assign({
            fillHandle: null
          })
        }
      }
    }
  }
});

// Helper functions for selection calculations
function calculateRangeSelection(start: CellRef, end: CellRef): Set<string> {
  const selection = new Set<string>();
  
  const startRow = getRowIndex(start.rowId);
  const endRow = getRowIndex(end.rowId);
  const startCol = getColumnIndex(start.columnId);
  const endCol = getColumnIndex(end.columnId);
  
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const rowId = getRowIdByIndex(row);
      const columnId = getColumnIdByIndex(col);
      selection.add(`${rowId}:${columnId}`);
    }
  }
  
  return selection;
}

function moveCell(current: CellRef, direction: 'up' | 'down' | 'left' | 'right'): CellRef {
  const currentRow = getRowIndex(current.rowId);
  const currentCol = getColumnIndex(current.columnId);
  
  switch (direction) {
    case 'up':
      return {
        rowId: getRowIdByIndex(Math.max(0, currentRow - 1)),
        columnId: current.columnId
      };
    case 'down':
      return {
        rowId: getRowIdByIndex(currentRow + 1),
        columnId: current.columnId
      };
    case 'left':
      return {
        rowId: current.rowId,
        columnId: getColumnIdByIndex(Math.max(0, currentCol - 1))
      };
    case 'right':
      return {
        rowId: current.rowId,
        columnId: getColumnIdByIndex(currentCol + 1)
      };
    default:
      return current;
  }
}

// Fill operation with pattern detection
function applyFillOperation(fillHandle: FillHandle) {
  const { source, value, targetCells } = fillHandle;
  const pattern = detectFillPattern(value);
  
  let index = 0;
  targetCells.forEach(cellKey => {
    const [rowId, columnId] = cellKey.split(':');
    const newValue = generateFillValue(pattern, index++);
    
    // Send update to appropriate row actor
    const rowActor = getRowActor(rowId);
    if (rowActor) {
      rowActor.send({
        type: 'UPDATE_FIELD',
        field: columnId,
        value: newValue
      });
    }
  });
}

function detectFillPattern(value: any): FillPattern {
  if (typeof value === 'number') {
    return { type: 'numeric', start: value, increment: 1 };
  }
  
  if (typeof value === 'string') {
    // Date pattern
    const dateMatch = value.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return { type: 'date', start: new Date(dateMatch[1]), increment: 'day' };
    }
    
    // Number in string pattern
    const numberMatch = value.match(/(.*)(\d+)(.*)/);
    if (numberMatch) {
      return { 
        type: 'string_with_number', 
        prefix: numberMatch[1], 
        start: parseInt(numberMatch[2]), 
        suffix: numberMatch[3] 
      };
    }
  }
  
  return { type: 'static', value };
}
```

### 6. Copy/Paste with Formatting

**Pattern**: Clipboard Manager with Format Preservation

```typescript
const clipboardManager = setup({
  types: {
    context: {} as {
      clipboard: ClipboardData | null;
      pasteMode: 'values' | 'formulas' | 'formats' | 'all';
      history: ClipboardEntry[];
    }
  }
}).createMachine({
  id: 'clipboardManager',
  initial: 'empty',
  context: {
    clipboard: null,
    pasteMode: 'all',
    history: []
  },
  states: {
    empty: {
      on: {
        COPY: {
          target: 'hasData',
          actions: assign({
            clipboard: ({ event }) => ({
              type: 'copy',
              cells: event.selectedCells,
              data: extractClipboardData(event.selectedCells),
              timestamp: Date.now(),
              source: 'internal'
            }),
            history: ({ context, event }) => [
              ...context.history.slice(-9), // Keep last 10
              extractClipboardData(event.selectedCells)
            ]
          })
        },
        CUT: {
          target: 'hasData',
          actions: assign({
            clipboard: ({ event }) => ({
              type: 'cut',
              cells: event.selectedCells,
              data: extractClipboardData(event.selectedCells),
              timestamp: Date.now(),
              source: 'internal'
            })
          })
        },
        EXTERNAL_PASTE: {
          target: 'hasData',
          actions: assign({
            clipboard: ({ event }) => ({
              type: 'copy',
              cells: [],
              data: parseExternalClipboard(event.clipboardData),
              timestamp: Date.now(),
              source: 'external'
            })
          })
        }
      }
    },
    hasData: {
      on: {
        PASTE: {
          actions: [
            // Apply clipboard data with current paste mode
            ({ context, event }) => {
              if (context.clipboard) {
                applyClipboardData(
                  context.clipboard.data,
                  event.targetCells,
                  context.pasteMode
                );
              }
            },
            // If it was a cut operation, clear source cells
            ({ context }) => {
              if (context.clipboard?.type === 'cut') {
                clearCells(context.clipboard.cells);
              }
            }
          ]
        },
        SET_PASTE_MODE: {
          actions: assign({
            pasteMode: ({ event }) => event.mode
          })
        },
        COPY: {
          actions: assign({
            clipboard: ({ event }) => ({
              type: 'copy',
              cells: event.selectedCells,
              data: extractClipboardData(event.selectedCells),
              timestamp: Date.now(),
              source: 'internal'
            })
          })
        }
      }
    }
  }
});

interface ClipboardData {
  type: 'copy' | 'cut';
  cells: string[];
  data: CellData[][];
  timestamp: number;
  source: 'internal' | 'external';
}

interface CellData {
  value: any;
  formula?: string;
  format?: CellFormat;
  validation?: ValidationRule;
}

function extractClipboardData(selectedCells: Set<string>): CellData[][] {
  // Convert selection to 2D array maintaining structure
  const cellMatrix = convertSelectionToMatrix(selectedCells);
  
  return cellMatrix.map(row => 
    row.map(cellKey => {
      if (!cellKey) return { value: '' };
      
      const [rowId, columnId] = cellKey.split(':');
      const rowActor = getRowActor(rowId);
      const cellValue = rowActor?.getSnapshot().context.data[columnId];
      
      return {
        value: cellValue,
        formula: getFormulaForCell(rowId, columnId),
        format: getCellFormat(rowId, columnId),
        validation: getCellValidation(rowId, columnId)
      };
    })
  );
}

function applyClipboardData(
  data: CellData[][],
  targetCells: Set<string>,
  mode: 'values' | 'formulas' | 'formats' | 'all'
) {
  const targetMatrix = convertSelectionToMatrix(targetCells);
  
  // Apply data in a tiled pattern if target is larger than source
  for (let targetRow = 0; targetRow < targetMatrix.length; targetRow++) {
    for (let targetCol = 0; targetCol < targetMatrix[targetRow].length; targetCol++) {
      const targetCellKey = targetMatrix[targetRow][targetCol];
      if (!targetCellKey) continue;
      
      const sourceRow = targetRow % data.length;
      const sourceCol = targetCol % data[0].length;
      const sourceData = data[sourceRow][sourceCol];
      
      const [rowId, columnId] = targetCellKey.split(':');
      const rowActor = getRowActor(rowId);
      
      if (rowActor && sourceData) {
        // Apply based on paste mode
        const updates: any = {};
        
        if (mode === 'values' || mode === 'all') {
          updates[columnId] = sourceData.value;
        }
        
        if (mode === 'formulas' || mode === 'all') {
          if (sourceData.formula) {
            // Adjust formula references for new position
            const adjustedFormula = adjustFormulaReferences(
              sourceData.formula,
              sourceRow, sourceCol,
              targetRow, targetCol
            );
            updates[`${columnId}_formula`] = adjustedFormula;
          }
        }
        
        if (mode === 'formats' || mode === 'all') {
          if (sourceData.format) {
            updates[`${columnId}_format`] = sourceData.format;
          }
        }
        
        rowActor.send({ type: 'BULK_UPDATE', updates });
      }
    }
  }
}

// External clipboard integration
function parseExternalClipboard(clipboardData: string): CellData[][] {
  // Parse TSV format (common from Excel, Google Sheets)
  const rows = clipboardData.split('\n').filter(row => row.trim());
  
  return rows.map(row => {
    const cells = row.split('\t');
    return cells.map(cell => ({
      value: parseClipboardValue(cell),
      format: detectValueFormat(cell)
    }));
  });
}

function parseClipboardValue(cell: string): any {
  // Detect and parse different data types
  if (cell === '') return '';
  
  // Number detection
  const numberMatch = cell.match(/^-?\d+\.?\d*$/);
  if (numberMatch) return parseFloat(cell);
  
  // Date detection
  const dateMatch = cell.match(/^\d{4}-\d{2}-\d{2}/);
  if (dateMatch) return new Date(cell);
  
  // Boolean detection
  if (cell.toLowerCase() === 'true') return true;
  if (cell.toLowerCase() === 'false') return false;
  
  // Default to string
  return cell;
}
```

### 7. Formula System

**Pattern**: Formula Engine with Dependency Tracking

```typescript
const formulaEngine = setup({
  types: {
    context: {} as {
      formulas: Map<string, FormulaDefinition>; // cellRef -> formula
      dependencies: Map<string, Set<string>>; // cellRef -> dependent cells
      reverseDependencies: Map<string, Set<string>>; // cellRef -> cells this depends on
      calculationQueue: string[];
      computedValues: Map<string, any>;
      errors: Map<string, FormulaError>;
      isCalculating: boolean;
      functions: Map<string, FormulaFunction>;
    }
  }
}).createMachine({
  id: 'formulaEngine',
  initial: 'ready',
  context: {
    formulas: new Map(),
    dependencies: new Map(),
    reverseDependencies: new Map(),
    calculationQueue: [],
    computedValues: new Map(),
    errors: new Map(),
    isCalculating: false,
    functions: new Map(DEFAULT_FUNCTIONS)
  },
  states: {
    ready: {
      on: {
        SET_FORMULA: {
          actions: [
            assign({
              formulas: ({ context, event }) => {
                const formulas = new Map(context.formulas);
                formulas.set(event.cellRef, {
                  expression: event.formula,
                  ast: parseFormula(event.formula),
                  timestamp: Date.now()
                });
                return formulas;
              }
            }),
            'updateDependencies',
            raise({ type: 'CALCULATE' })
          ]
        },
        
        CELL_VALUE_CHANGED: {
          actions: [
            'queueDependentCalculations',
            raise({ type: 'CALCULATE' })
          ]
        },
        
        CALCULATE: {
          target: 'calculating',
          guard: ({ context }) => !context.isCalculating && context.calculationQueue.length > 0
        }
      }
    },
    
    calculating: {
      entry: assign({ isCalculating: true }),
      invoke: {
        src: 'calculateFormulas',
        input: ({ context }) => ({
          queue: context.calculationQueue,
          formulas: context.formulas,
          dependencies: context.dependencies,
          currentValues: context.computedValues
        }),
        onDone: {
          target: 'ready',
          actions: [
            assign({
              computedValues: ({ event }) => new Map([
                ...context.computedValues,
                ...event.output.values
              ]),
              errors: ({ event }) => new Map(event.output.errors),
              calculationQueue: [],
              isCalculating: false
            }),
            // Notify affected row actors of new values
            ({ event }) => {
              event.output.values.forEach((value, cellRef) => {
                const [rowId, columnId] = cellRef.split(':');
                const rowActor = getRowActor(rowId);
                if (rowActor) {
                  rowActor.send({
                    type: 'FORMULA_RESULT',
                    field: columnId,
                    value,
                    computed: true
                  });
                }
              });
            }
          ]
        },
        onError: {
          target: 'ready',
          actions: assign({
            isCalculating: false,
            errors: ({ event }) => new Map([
              ['calculation', { message: event.error.message, type: 'system' }]
            ])
          })
        }
      }
    }
  }
});

// Formula parsing and evaluation
interface FormulaDefinition {
  expression: string;
  ast: FormulaAST;
  timestamp: number;
}

interface FormulaAST {
  type: 'function' | 'reference' | 'literal' | 'binary' | 'unary';
  value?: any;
  name?: string;
  args?: FormulaAST[];
  left?: FormulaAST;
  right?: FormulaAST;
  operator?: string;
  references?: string[];
}

const calculateFormulas = async ({ input }) => {
  const { queue, formulas, dependencies } = input;
  const values = new Map();
  const errors = [];
  
  // Topological sort to ensure dependencies are calculated first
  const sortedQueue = topologicalSort(queue, dependencies);
  
  for (const cellRef of sortedQueue) {
    try {
      const formula = formulas.get(cellRef);
      if (formula) {
        const result = await evaluateFormula(formula.ast, cellRef, values);
        values.set(cellRef, result);
      }
    } catch (error) {
      errors.push([cellRef, { message: error.message, type: 'evaluation' }]);
    }
  }
  
  return { values, errors };
};

async function evaluateFormula(ast: FormulaAST, currentCell: string, computedValues: Map<string, any>): Promise<any> {
  switch (ast.type) {
    case 'literal':
      return ast.value;
      
    case 'reference':
      const refValue = computedValues.get(ast.value) ?? getCellValue(ast.value);
      return refValue;
      
    case 'function':
      const func = FORMULA_FUNCTIONS.get(ast.name);
      if (!func) throw new Error(`Unknown function: ${ast.name}`);
      
      const args = await Promise.all(
        ast.args.map(arg => evaluateFormula(arg, currentCell, computedValues))
      );
      
      return func.execute(args, currentCell);
      
    case 'binary':
      const left = await evaluateFormula(ast.left, currentCell, computedValues);
      const right = await evaluateFormula(ast.right, currentCell, computedValues);
      
      switch (ast.operator) {
        case '+': return Number(left) + Number(right);
        case '-': return Number(left) - Number(right);
        case '*': return Number(left) * Number(right);
        case '/': return Number(left) / Number(right);
        case '=': return left === right;
        case '>': return left > right;
        case '<': return left < right;
        default: throw new Error(`Unknown operator: ${ast.operator}`);
      }
      
    default:
      throw new Error(`Unknown AST node type: ${ast.type}`);
  }
}

// Built-in formula functions
const FORMULA_FUNCTIONS = new Map([
  ['SUM', {
    execute: (args: any[]) => {
      return args.flat().reduce((sum, val) => sum + Number(val || 0), 0);
    },
    signature: '(...numbers) => number'
  }],
  
  ['AVERAGE', {
    execute: (args: any[]) => {
      const numbers = args.flat().filter(n => typeof n === 'number');
      return numbers.length > 0 ? numbers.reduce((a, b) => a + b) / numbers.length : 0;
    },
    signature: '(...numbers) => number'
  }],
  
  ['COUNT', {
    execute: (args: any[]) => {
      return args.flat().filter(val => val != null && val !== '').length;
    },
    signature: '(...values) => number'
  }],
  
  ['IF', {
    execute: (args: any[]) => {
      const [condition, trueValue, falseValue] = args;
      return condition ? trueValue : falseValue;
    },
    signature: '(condition, trueValue, falseValue) => any'
  }],
  
  ['CONCATENATE', {
    execute: (args: any[]) => {
      return args.map(String).join('');
    },
    signature: '(...values) => string'
  }],
  
  ['LOOKUP', {
    execute: (args: any[], currentCell: string) => {
      const [searchValue, searchRange, resultRange] = args;
      // Implementation for range lookup
      return performLookup(searchValue, searchRange, resultRange);
    },
    signature: '(searchValue, searchRange, resultRange) => any'
  }]
]);

// Dependency tracking
function updateDependencies(cellRef: string, formula: FormulaDefinition) {
  const references = extractReferences(formula.ast);
  
  // Clear old dependencies
  const oldDeps = reverseDependencies.get(cellRef) || new Set();
  oldDeps.forEach(dep => {
    const dependents = dependencies.get(dep) || new Set();
    dependents.delete(cellRef);
    if (dependents.size === 0) {
      dependencies.delete(dep);
    }
  });
  
  // Set new dependencies
  reverseDependencies.set(cellRef, new Set(references));
  references.forEach(ref => {
    if (!dependencies.has(ref)) {
      dependencies.set(ref, new Set());
    }
    dependencies.get(ref).add(cellRef);
  });
}

function extractReferences(ast: FormulaAST): string[] {
  const references = [];
  
  function traverse(node: FormulaAST) {
    if (node.type === 'reference') {
      references.push(node.value);
    } else if (node.args) {
      node.args.forEach(traverse);
    } else if (node.left) {
      traverse(node.left);
    }
    if (node.right) {
      traverse(node.right);
    }
  }
  
  traverse(ast);
  return references;
}
```

---

## Performance Optimization Patterns

### 1. Virtual Scrolling with Actor Management

```typescript
const virtualScrollManager = setup({
  types: {
    context: {} as {
      viewport: ViewportInfo;
      bufferSize: number;
      itemHeight: number;
      activeActors: Map<string, any>;
      renderQueue: string[];
      scrollDirection: 'up' | 'down' | 'none';
    }
  }
}).createMachine({
  id: 'virtualScrollManager',
  initial: 'ready',
  context: {
    viewport: { start: 0, end: 50, height: 600, scrollTop: 0 },
    bufferSize: 10,
    itemHeight: 40,
    activeActors: new Map(),
    renderQueue: [],
    scrollDirection: 'none'
  },
  states: {
    ready: {
      on: {
        SCROLL: {
          target: 'updating',
          actions: assign({
            viewport: ({ event }) => calculateViewport(event),
            scrollDirection: ({ context, event }) => 
              event.scrollTop > context.viewport.scrollTop ? 'down' : 'up'
          })
        }
      }
    },
    updating: {
      entry: [
        'cleanupInvisibleActors',
        'queueVisibleActors'
      ],
      invoke: {
        src: 'processRenderQueue',
        onDone: {
          target: 'ready',
          actions: assign({
            activeActors: ({ event }) => event.output.actors,
            renderQueue: []
          })
        }
      }
    }
  }
});

const processRenderQueue = async ({ input }) => {
  const { queue, existingActors, spawn } = input;
  const actors = new Map(existingActors);
  
  // Process in batches to avoid blocking
  const batchSize = 10;
  for (let i = 0; i < queue.length; i += batchSize) {
    const batch = queue.slice(i, i + batchSize);
    
    await new Promise(resolve => {
      requestIdleCallback(() => {
        batch.forEach(rowId => {
          if (!actors.has(rowId)) {
            const actor = spawn('rowActor', {
              input: { id: rowId, data: getRowData(rowId) },
              systemId: `row-${rowId}`
            });
            actors.set(rowId, actor);
          }
        });
        resolve(void 0);
      });
    });
  }
  
  return { actors };
};
```

### 2. Memoized Selectors

```typescript
// Create memoized selectors for expensive computations
const createTableSelectors = () => {
  const getVisibleRows = createSelector(
    [(state) => state.context.rows, (state) => state.context.visibleRowIds],
    (allRows, visibleIds) => {
      return visibleIds.map(id => allRows.get(id)).filter(Boolean);
    }
  );
  
  const getGroupedRows = createSelector(
    [getVisibleRows, (state) => state.context.groupBy],
    (rows, groupBy) => {
      if (groupBy.length === 0) return [{ id: 'root', rows }];
      return computeGrouping(rows, groupBy); // Expensive operation
    }
  );
  
  const getSelectedRowData = createSelector(
    [(state) => state.context.rows, (state) => state.context.selectedRows],
    (allRows, selectedIds) => {
      return selectedIds.map(id => allRows.get(id)).filter(Boolean);
    }
  );
  
  return { getVisibleRows, getGroupedRows, getSelectedRowData };
};

// Usage in components
const TableComponent = memo(() => {
  const selectors = useMemo(() => createTableSelectors(), []);
  
  const visibleRows = useSelector(tableService, selectors.getVisibleRows);
  const groupedRows = useSelector(tableService, selectors.getGroupedRows);
  
  // Component only re-renders when these specific derived values change
  return (
    <div>
      {groupedRows.map(group => (
        <GroupComponent key={group.id} group={group} />
      ))}
    </div>
  );
});
```

### 3. Batch Updates

```typescript
const batchUpdateManager = setup({
  types: {
    context: {} as {
      pendingUpdates: Map<string, PendingUpdate>;
      batchTimeout: number;
      maxBatchSize: number;
    }
  }
}).createMachine({
  id: 'batchUpdateManager',
  initial: 'collecting',
  context: {
    pendingUpdates: new Map(),
    batchTimeout: 16, // ~60fps
    maxBatchSize: 100
  },
  states: {
    collecting: {
      on: {
        ADD_UPDATE: {
          actions: assign({
            pendingUpdates: ({ context, event }) => {
              const updates = new Map(context.pendingUpdates);
              updates.set(event.key, {
                ...updates.get(event.key),
                ...event.update,
                timestamp: Date.now()
              });
              return updates;
            }
          }),
          target: 'collecting' // Re-enter to reset timer
        }
      },
      after: {
        BATCH_TIMEOUT: [
          {
            guard: ({ context }) => context.pendingUpdates.size > 0,
            target: 'processing'
          }
        ]
      }
    },
    processing: {
      invoke: {
        src: 'processBatchUpdates',
        input: ({ context }) => ({ updates: context.pendingUpdates }),
        onDone: {
          target: 'collecting',
          actions: assign({
            pendingUpdates: new Map()
          })
        }
      }
    }
  }
});
```

### 4. Optimistic Updates with Rollback

```typescript
const optimisticUpdatePattern = {
  // Enhanced row actor with optimistic updates
  rowActor: setup({
    types: {
      context: {} as {
        id: string;
        data: Record<string, any>;
        optimisticData: Record<string, any>;
        pendingOperations: Map<string, PendingOperation>;
        rollbackStack: RollbackEntry[];
        version: number;
      }
    }
  }).createMachine({
    id: 'optimisticRow',
    initial: 'idle',
    context: ({ input }) => ({
      id: input.id,
      data: input.data,
      optimisticData: {},
      pendingOperations: new Map(),
      rollbackStack: [],
      version: 0
    }),
    states: {
      idle: {
        on: {
          OPTIMISTIC_UPDATE: {
            actions: [
              assign({
                optimisticData: ({ context, event }) => ({
                  ...context.optimisticData,
                  [event.field]: event.value
                }),
                pendingOperations: ({ context, event }) => {
                  const ops = new Map(context.pendingOperations);
                  ops.set(event.operationId, {
                    type: 'update',
                    field: event.field,
                    newValue: event.value,
                    oldValue: context.data[event.field],
                    timestamp: Date.now()
                  });
                  return ops;
                },
                version: ({ context }) => context.version + 1
              }),
              // Send to server
              ({ event }) => {
                persistUpdate(event.operationId, event.field, event.value);
              }
            ]
          },
          CONFIRM_UPDATE: {
            actions: assign({
              data: ({ context, event }) => ({
                ...context.data,
                [event.field]: event.value
              }),
              optimisticData: ({ context, event }) => {
                const { [event.field]: removed, ...rest } = context.optimisticData;
                return rest;
              },
              pendingOperations: ({ context, event }) => {
                const ops = new Map(context.pendingOperations);
                ops.delete(event.operationId);
                return ops;
              }
            })
          },
          ROLLBACK_UPDATE: {
            actions: assign({
              optimisticData: ({ context, event }) => {
                const { [event.field]: removed, ...rest } = context.optimisticData;
                return rest;
              },
              pendingOperations: ({ context, event }) => {
                const ops = new Map(context.pendingOperations);
                ops.delete(event.operationId);
                return ops;
              },
              rollbackStack: ({ context, event }) => [
                ...context.rollbackStack,
                {
                  operationId: event.operationId,
                  reason: event.error.message,
                  timestamp: Date.now()
                }
              ]
            })
          }
        }
      }
    }
  })
};
```

---

## Anti-Patterns to Avoid

### 1. ❌ Putting UI State in Actors

**Wrong:**
```typescript
// DON'T: Store UI-specific state in business logic actors
const badRowActor = setup({
  context: {
    data: {},
    isHovered: false,        // ❌ UI state
    isHighlighted: false,    // ❌ UI state
    cellWidths: {},         // ❌ Layout state
    showTooltip: false      // ❌ UI state
  }
});
```

**Right:**
```typescript
// DO: Keep business logic separate from UI state
const goodRowActor = setup({
  context: {
    data: {},
    isSelected: false,      // ✅ Business state
    isDirty: false,         // ✅ Business state
    validationErrors: new Map() // ✅ Business state
  }
});

// UI state stays in React
const RowComponent = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  // ...
};
```

### 2. ❌ Subscribing to Entire State

**Wrong:**
```typescript
// DON'T: Subscribe to entire actor state
const TableComponent = () => {
  const entireState = useSelector(tableActor, state => state); // ❌ Re-renders on any change
  
  return (
    <div>
      {entireState.context.rows.map(row => <Row key={row.id} />)}
    </div>
  );
};
```

**Right:**
```typescript
// DO: Use granular selectors
const TableComponent = () => {
  const visibleRowIds = useSelector(tableActor, state => state.context.visibleRowIds);
  const rowActors = useSelector(tableActor, state => state.context.rowActors);
  
  return (
    <div>
      {visibleRowIds.map(rowId => (
        <Row key={rowId} actor={rowActors.get(rowId)} />
      ))}
    </div>
  );
};
```

### 3. ❌ Creating Actors in Render

**Wrong:**
```typescript
// DON'T: Create actors during render
const TableRow = ({ rowData }) => {
  const rowActor = useMemo(() => 
    createActor(rowMachine).start(), // ❌ Creates new actor on every render
    []
  );
  
  return <tr>...</tr>;
};
```

**Right:**
```typescript
// DO: Manage actors at the appropriate level
const TableContainer = () => {
  const [state, send] = useMachine(tableMachine);
  
  // Actors are spawned and managed by parent machine
  useEffect(() => {
    data.forEach(row => {
      send({ type: 'SPAWN_ROW', rowId: row.id, data: row });
    });
  }, [data]);
  
  return (
    <table>
      {state.context.rowActors.map(([id, actor]) => (
        <TableRow key={id} actor={actor} />
      ))}
    </table>
  );
};
```

### 4. ❌ Deep Nesting in Context

**Wrong:**
```typescript
// DON'T: Create deeply nested context objects
const badTableContext = {
  data: {
    rows: {
      byId: {},
      selected: {
        primary: [],
        secondary: {
          highlighted: {
            cells: {
              individual: [],
              ranges: []
            }
          }
        }
      }
    }
  }
}; // ❌ Hard to update immutably
```

**Right:**
```typescript
// DO: Keep context flat and use Maps/Sets
const goodTableContext = {
  rows: new Map(),              // ✅ Efficient lookups
  selectedRows: new Set(),      // ✅ Efficient set operations
  selectedCells: new Set(),     // ✅ Simple structure
  highlightedCells: new Set()   // ✅ Easy to update
};
```

### 5. ❌ Synchronous Heavy Operations

**Wrong:**
```typescript
// DON'T: Perform heavy computations in actions
const badMachine = setup({
  actions: {
    computeGrouping: ({ context }) => {
      // ❌ Blocks the UI thread
      const result = heavyGroupingOperation(context.rows);
      context.groupedData = result;
    }
  }
});
```

**Right:**
```typescript
// DO: Use async actors for heavy operations
const goodMachine = setup({
  actors: {
    computeGrouping: fromPromise(async ({ input }) => {
      // ✅ Non-blocking operation
      return await heavyGroupingOperation(input.rows);
    })
  }
}).createMachine({
  states: {
    computing: {
      invoke: {
        src: 'computeGrouping',
        input: ({ context }) => ({ rows: context.rows }),
        onDone: {
          actions: assign({
            groupedData: ({ event }) => event.output
          })
        }
      }
    }
  }
});
```

### 6. ❌ Direct DOM Manipulation

**Wrong:**
```typescript
// DON'T: Manipulate DOM directly from actors
const badCellActor = setup({
  actions: {
    highlight: () => {
      // ❌ Direct DOM manipulation
      document.getElementById('cell-123').classList.add('highlighted');
    }
  }
});
```

**Right:**
```typescript
// DO: Let React handle DOM updates
const goodCellActor = setup({
  actions: {
    setHighlighted: assign({
      isHighlighted: true  // ✅ State change only
    })
  }
});

const CellComponent = ({ actor }) => {
  const isHighlighted = useSelector(actor, state => state.context.isHighlighted);
  
  return (
    <td className={isHighlighted ? 'highlighted' : ''}>
      {/* ✅ React handles DOM updates */}
    </td>
  );
};
```

---

## Complete Examples

### Example 1: Full Table Implementation

```typescript
// Main table hook that orchestrates everything
export function useDataTable(config: TableConfig) {
  const [state, send] = useMachine(tableBaseMachine, {
    input: {
      id: config.id,
      data: config.initialData,
      columns: config.columns,
      settings: config.settings
    }
  });
  
  // Memoized selectors for performance
  const selectors = useMemo(() => ({
    visibleRows: (state) => {
      const visibleIds = state.context.visibleRowIds;
      return visibleIds.map(id => state.context.rows.get(id)).filter(Boolean);
    },
    
    selectedCellData: (state) => {
      const selectedCells = state.context.actors.selectionCoordinator
        ?.getSnapshot().context.selectedCells || new Set();
      
      return Array.from(selectedCells).map(cellKey => {
        const [rowId, columnId] = cellKey.split(':');
        const row = state.context.rows.get(rowId);
        return row ? { rowId, columnId, value: row.data[columnId] } : null;
      }).filter(Boolean);
    },
    
    groupedData: (state) => {
      return state.context.actors.viewCoordinator
        ?.getSnapshot().context.groupTree || [];
    }
  }), []);
  
  // Action creators
  const actions = useMemo(() => ({
    // Data actions
    addRow: (row: Partial<TableRow>) => 
      send({ type: 'data.row.create', row }),
    
    updateRow: (rowId: string, changes: Partial<TableRow>) => 
      send({ type: 'data.row.update', rowId, changes }),
    
    deleteRow: (rowId: string) => 
      send({ type: 'data.row.delete', rowId }),
    
    // Selection actions
    selectCell: (rowId: string, columnId: string, extend = false) => 
      send({ type: 'selection.cell.select', rowId, columnId, extend }),
    
    selectRange: (start: CellRef, end: CellRef) => 
      send({ type: 'selection.range.select', start, end }),
    
    clearSelection: () => 
      send({ type: 'selection.clear' }),
    
    // View actions
    groupBy: (fields: string[]) => 
      send({ type: 'view.group.set', groupBy: fields }),
    
    sortBy: (sortConfig: SortConfig[]) => 
      send({ type: 'view.sort.set', sortBy: sortConfig }),
    
    filter: (filters: FilterConfig[]) => 
      send({ type: 'view.filter.set', filters }),
    
    // Edit actions
    startEdit: (rowId: string, columnId: string) => 
      send({ type: 'edit.cell.start', rowId, columnId }),
    
    commitEdit: (value: any) => 
      send({ type: 'edit.cell.commit', value }),
    
    // Keyboard actions
    handleKeyboard: (key: string, modifiers: KeyboardModifiers) => {
      const events = mapKeyboardToEvents(key, modifiers);
      events.forEach(event => send(event));
    },
    
    // Clipboard actions
    copy: () => send({ type: 'keyboard.copy' }),
    paste: () => send({ type: 'keyboard.paste' }),
    
    // Drag actions
    startRowDrag: (rowId: string) => 
      send({ type: 'drag.row.start', rowId }),
    
    startFillDrag: (cellRef: CellRef, value: any) => 
      send({ type: 'drag.fill.start', cellRef, value })
  }), [send]);
  
  // Derived state using selectors
  const derivedState = useMemo(() => ({
    visibleRows: selectors.visibleRows(state),
    selectedCells: selectors.selectedCellData(state),
    groupedData: selectors.groupedData(state),
    
    // Status flags
    isLoading: state.matches('initializing'),
    hasSelection: selectors.selectedCellData(state).length > 0,
    canUndo: state.context.actors.dataManager?.getSnapshot().context.undoStack.length > 0,
    canRedo: state.context.actors.dataManager?.getSnapshot().context.redoStack.length > 0
  }), [state, selectors]);
  
  return {
    state: derivedState,
    actions,
    actors: {
      table: state,
      dataManager: state.context.actors.dataManager,
      selectionCoordinator: state.context.actors.selectionCoordinator,
      viewCoordinator: state.context.actors.viewCoordinator
    }
  };
}

// Main table component
export const DataTable = memo(({ config }: { config: TableConfig }) => {
  const table = useDataTable(config);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Keyboard event handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for handled keys
      const handledKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Delete'];
      if (handledKeys.includes(e.key)) {
        e.preventDefault();
        table.actions.handleKeyboard(e.key, {
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          alt: e.altKey
        });
      }
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [table.actions]);
  
  // Clipboard integration
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const clipboardData = e.clipboardData?.getData('text/plain') || '';
      table.actions.handleClipboard('paste', clipboardData);
    };
    
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [table.actions]);
  
  return (
    <div 
      ref={containerRef}
      className="data-table-container"
      tabIndex={0}
    >
      <TableToolbar 
        hasSelection={table.state.hasSelection}
        canUndo={table.state.canUndo}
        canRedo={table.state.canRedo}
        onAddRow={() => table.actions.addRow({})}
        onDeleteSelected={() => table.actions.deleteSelected()}
        onGroupBy={(field) => table.actions.groupBy([field])}
      />
      
      <div className="table-viewport">
        {table.state.isLoading ? (
          <LoadingIndicator />
        ) : (
          <VirtualizedTable
            groupedData={table.state.groupedData}
            columns={config.columns}
            onCellClick={table.actions.selectCell}
            onCellDoubleClick={table.actions.startEdit}
            onRowDragStart={table.actions.startRowDrag}
          />
        )}
      </div>
      
      <TableFooter 
        stats={table.state.stats}
        selectedCount={table.state.selectedCells.length}
      />
    </div>
  );
});

// Virtualized table renderer
const VirtualizedTable = memo(({ 
  groupedData, 
  columns, 
  onCellClick, 
  onCellDoubleClick,
  onRowDragStart 
}: VirtualizedTableProps) => {
  const [viewport, setViewport] = useState({ start: 0, end: 50 });
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const handleScroll = useCallback((e: React.UIEvent) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const itemHeight = 40;
    const containerHeight = container.clientHeight;
    
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      groupedData.length,
      start + Math.ceil(containerHeight / itemHeight) + 10
    );
    
    setViewport({ start, end });
  }, [groupedData.length]);
  
  const visibleGroups = groupedData.slice(viewport.start, viewport.end);
  
  return (
    <div 
      ref={scrollRef}
      className="virtualized-table"
      onScroll={handleScroll}
      style={{ height: 400, overflow: 'auto' }}
    >
      <div style={{ height: groupedData.length * 40 }}>
        <div style={{ transform: `translateY(${viewport.start * 40}px)` }}>
          <table>
            <thead>
              <tr>
                {columns.map(col => (
                  <TableHeader 
                    key={col.id} 
                    column={col}
                    onSort={(direction) => handleSort(col.id, direction)}
                    onFilter={(filter) => handleFilter(col.id, filter)}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map(group => (
                <GroupedRows
                  key={group.id}
                  group={group}
                  columns={columns}
                  onCellClick={onCellClick}
                  onCellDoubleClick={onCellDoubleClick}
                  onRowDragStart={onRowDragStart}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

// Example usage
const App = () => {
  const tableConfig: TableConfig = {
    id: 'main-table',
    columns: [
      { id: 'name', name: 'Name', type: 'text', editable: true },
      { id: 'status', name: 'Status', type: 'select', options: ['todo', 'in-progress', 'done'] },
      { id: 'priority', name: 'Priority', type: 'number', editable: true },
      { id: 'assignee', name: 'Assignee', type: 'text' },
      { id: 'created', name: 'Created', type: 'date' }
    ],
    initialData: [
      { id: '1', name: 'Task 1', status: 'todo', priority: 1, assignee: 'John', created: new Date() },
      { id: '2', name: 'Task 2', status: 'in-progress', priority: 2, assignee: 'Jane', created: new Date() }
    ],
    settings: {
      enableVirtualScrolling: true,
      enableGrouping: true,
      enableFiltering: true,
      enableFormulas: true,
      pageSize: 50
    }
  };
  
  return (
    <div className="app">
      <DataTable config={tableConfig} />
    </div>
  );
};
```

### Example 2: Advanced Feature Integration

```typescript
// Advanced table with all features enabled
const AdvancedTableExample = () => {
  const table = useDataTable({
    id: 'advanced-table',
    columns: ADVANCED_COLUMNS,
    initialData: SAMPLE_DATA,
    settings: {
      enableVirtualScrolling: true,
      enableGrouping: true,
      enableFiltering: true,
      enableFormulas: true,
      enableCollaboration: true,
      enableAuditTrail: true
    }
  });
  
  // Custom keyboard shortcuts
  useKeyboardShortcuts({
    'Ctrl+G': () => table.actions.groupBy(['status']),
    'Ctrl+F': () => table.actions.showFilterDialog(),
    'Ctrl+Shift+A': () => table.actions.selectAll(),
    'Delete': () => table.actions.deleteSelected(),
    'F2': () => table.actions.editActiveCell(),
    'Escape': () => table.actions.clearSelection()
  });
  
  // Auto-save functionality
  useAutoSave(table.state.rows, {
    interval: 30000, // 30 seconds
    onSave: (rows) => saveToServer(rows)
  });
  
  // Collaboration features
  useCollaboration(table.actors.table, {
    onUserJoined: (user) => showNotification(`${user.name} joined`),
    onUserLeft: (user) => showNotification(`${user.name} left`),
    onCursorMove: (user, cellRef) => updateUserCursor(user, cellRef)
  });
  
  return (
    <div className="advanced-table-container">
      <TableRibbon 
        onExport={() => exportTable(table.state.visibleRows)}
        onImport={(data) => table.actions.importData(data)}
        onPrint={() => printTable(table.state.visibleRows)}
      />
      
      <DataTable config={table.config} />
      
      <StatusBar 
        stats={table.state.stats}
        activeUsers={table.state.activeUsers}
        lastSaved={table.state.lastSaved}
      />
    </div>
  );
};
```

---

## Summary

This comprehensive guide demonstrates how to build a production-ready data table with XState 5 that matches the functionality of tools like Notion and ClickUp. The key principles are:

1. **Actor-based Architecture**: Each business concern gets its own actor for isolation and maintainability
2. **Selective Coordination**: Only coordinate state when necessary, maintaining independence otherwise
3. **Performance First**: Virtual scrolling, memoized selectors, and optimistic updates for smooth UX
4. **Type Safety**: Strong typing throughout prevents runtime errors
5. **React Integration**: Minimal React layer focused on presentation and user interaction

The patterns shown here provide:
- **Scalability**: Handles thousands of rows without performance degradation
- **Maintainability**: Clear separation of concerns and predictable state transitions
- **Testability**: Each actor can be tested in isolation
- **Extensibility**: New features can be added without affecting existing functionality
- **Performance**: Optimized rendering and state management for smooth user experience

By following these patterns and avoiding the anti-patterns, you can build a data table component that provides excellent performance and user experience while remaining maintainable and extensible.
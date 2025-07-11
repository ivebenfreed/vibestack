import { setup, assign, fromPromise, sendParent } from 'xstate';
import type { 
  ViewContext, 
  GroupNode, 
  SortConfig, 
  FilterConfig, 
  ViewportInfo, 
  Column, 
  TableRow,
  TableEvents,
  ColumnDragState 
} from '../types';

// ====================================
// HELPER FUNCTIONS
// ====================================

const createGroupTree = (
  rows: TableRow[], 
  groupBy: string[], 
  columns: Column[]
): GroupNode[] => {
  if (groupBy.length === 0) return [];
  
  const groupTree: GroupNode[] = [];
  const groupMap = new Map<string, GroupNode>();
  
  rows.forEach(row => {
    let currentLevel = groupTree;
    let currentPath = '';
    
    groupBy.forEach((field, level) => {
      const value = row.data[field];
      const groupKey = `${currentPath}:${field}:${value}`;
      currentPath = groupKey;
      
      if (!groupMap.has(groupKey)) {
        const node: GroupNode = {
          id: groupKey,
          field,
          value,
          level,
          rowCount: 0,
          children: level === groupBy.length - 1 ? [] : [],
          isCollapsed: false
        };
        
        groupMap.set(groupKey, node);
        currentLevel.push(node);
      }
      
      const node = groupMap.get(groupKey)!;
      node.rowCount++;
      
      if (level === groupBy.length - 1) {
        (node.children as TableRow[]).push(row);
      } else {
        currentLevel = node.children as GroupNode[];
      }
    });
  });
  
  return groupTree;
};

const applySorting = (rows: TableRow[], sortBy: SortConfig[]): TableRow[] => {
  if (sortBy.length === 0) return rows;
  
  return [...rows].sort((a, b) => {
    for (const sort of sortBy) {
      const aValue = a.data[sort.field];
      const bValue = b.data[sort.field];
      
      if (aValue === bValue) continue;
      
      let comparison = 0;
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }
      
      return sort.direction === 'desc' ? -comparison : comparison;
    }
    
    return 0;
  });
};

const applyFilters = (rows: TableRow[], filters: FilterConfig[]): TableRow[] => {
  if (filters.length === 0) return rows;
  
  return rows.filter(row => {
    return filters.every(filter => {
      const value = row.data[filter.field];
      let matches = false;
      
      switch (filter.operator) {
        case 'equals':
          matches = value === filter.value;
          break;
        case 'not_equals':
          matches = value !== filter.value;
          break;
        case 'contains':
          matches = String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          break;
        case 'not_contains':
          matches = !String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          break;
        case 'starts_with':
          matches = String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
          break;
        case 'ends_with':
          matches = String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
          break;
        case 'greater_than':
          matches = Number(value) > Number(filter.value);
          break;
        case 'less_than':
          matches = Number(value) < Number(filter.value);
          break;
        case 'is_empty':
          matches = value === null || value === undefined || value === '';
          break;
        case 'is_not_empty':
          matches = value !== null && value !== undefined && value !== '';
          break;
        case 'in':
          matches = Array.isArray(filter.value) && filter.value.includes(value);
          break;
        case 'not_in':
          matches = Array.isArray(filter.value) && !filter.value.includes(value);
          break;
        case 'regex':
          try {
            const regex = new RegExp(filter.value, filter.caseSensitive ? 'g' : 'gi');
            matches = regex.test(String(value));
          } catch {
            matches = false;
          }
          break;
        default:
          matches = true;
      }
      
      return filter.negate ? !matches : matches;
    });
  });
};

const calculateViewport = (
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  bufferSize: number = 10
): ViewportInfo => {
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const end = Math.min(totalItems, start + visibleCount + bufferSize * 2);
  
  return {
    start,
    end,
    height: containerHeight,
    scrollTop,
    itemHeight
  };
};

// ====================================
// ASYNC ACTORS
// ====================================

const processDataTransformation = fromPromise(async ({ input }: {
  input: { 
    rows: TableRow[]; 
    filters: FilterConfig[]; 
    sortBy: SortConfig[]; 
    groupBy: string[];
    columns: Column[];
  }
}) => {
  const { rows, filters, sortBy, groupBy, columns } = input;
  
  console.log('[processDataTransformation] Starting with:', {
    rowCount: rows.length,
    sortBy,
    hasFilters: filters.length > 0,
    hasGrouping: groupBy.length > 0
  });
  
  // Apply filters first
  const filteredRows = applyFilters(rows, filters);
  
  // Then apply sorting
  const sortedRows = applySorting(filteredRows, sortBy);
  
  console.log('[processDataTransformation] After sorting:', {
    sortedRowCount: sortedRows.length,
    firstRow: sortedRows[0]?.data,
    lastRow: sortedRows[sortedRows.length - 1]?.data
  });
  
  // Finally create group tree if needed
  const groupTree = createGroupTree(sortedRows, groupBy, columns);
  
  return {
    processedRows: sortedRows,
    groupTree,
    totalRowCount: filteredRows.length
  };
});

const calculateGroupSummaries = fromPromise(async ({ input }: {
  input: { groupTree: GroupNode[]; columns: Column[] }
}) => {
  const { groupTree, columns } = input;
  
  const calculateSummary = (node: GroupNode): Record<string, any> => {
    const summary: Record<string, any> = {};
    
    if (node.children.length === 0) return summary;
    
    // Calculate summaries for numeric columns
    const numericColumns = columns.filter(col => col.type === 'number');
    
    numericColumns.forEach(column => {
      const values: number[] = [];
      
      const collectValues = (children: GroupNode[] | TableRow[]) => {
        children.forEach(child => {
          if ('data' in child) {
            // It's a TableRow
            const value = child.data[column.field];
            if (typeof value === 'number') {
              values.push(value);
            }
          } else {
            // It's a GroupNode, recurse
            collectValues(child.children);
          }
        });
      };
      
      collectValues(node.children);
      
      if (values.length > 0) {
        summary[column.field] = {
          sum: values.reduce((sum, val) => sum + val, 0),
          avg: values.reduce((sum, val) => sum + val, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      }
    });
    
    return summary;
  };
  
  const updateSummaries = (nodes: GroupNode[]) => {
    nodes.forEach(node => {
      node.summary = calculateSummary(node);
      
      // Recursively update child summaries
      if (node.children.length > 0 && 'field' in node.children[0]) {
        updateSummaries(node.children as GroupNode[]);
      }
    });
  };
  
  updateSummaries(groupTree);
  
  return { groupTree };
});

// ====================================
// VIEW COORDINATOR MACHINE
// ====================================

interface ViewCoordinatorContext extends ViewContext {
  entityType: string;
  columns: Column[];
  allRows: TableRow[];
  processedRows: TableRow[];
  totalRowCount: number;
  version: number;
  
  // Processing state
  isProcessing: boolean;
  processingQueue: Array<{
    operation: string;
    timestamp: number;
  }>;
  
  // Performance metrics
  lastProcessTime: number;
  processedItemCount: number;
  
  // Column drag state
  columnDragState: ColumnDragState;
}

// Helper function to calculate hidden column count
const calculateHiddenCount = (visibility: Record<string, boolean>): number => {
  return Object.values(visibility).filter(visible => !visible).length;
};

type ViewEvents = 
  | { type: 'view.group.set'; groupBy: string[] }
  | { type: 'view.group.toggle'; groupId: string }
  | { type: 'view.sort.set'; sortBy: any[] }
  | { type: 'view.filter.set'; filters: any[] }
  | { type: 'view.viewport.update'; viewport: any }
  | { type: 'view.columns.toggle'; columnId: string }
  | { type: 'view.columns.show.all' }
  | { type: 'view.columns.hide.all' }
  | { type: 'view.columns.visibility.set'; visibility: Record<string, boolean> }
  | { type: 'view.columns.drag.start'; columnId: string; x: number; y: number }
  | { type: 'view.columns.drag.move'; x: number; y: number }
  | { type: 'view.columns.drag.end'; targetIndex: number }
  | { type: 'view.columns.drag.cancel' }
  | { type: 'view.columns.order.set'; order: string[] }
  | { type: 'view.columns.order.reset' }
  // Internal events
  | { type: 'COLUMNS_CHANGED'; columns: Column[] }
  | { type: 'ROWS_UPDATED'; rows: TableRow[] }
  | { type: 'VIEWPORT_SCROLL'; scrollTop: number; containerHeight: number; itemHeight: number }
  | { type: 'PROCESSING_COMPLETE'; result: any }
  | { type: 'SUMMARIES_UPDATED'; groupTree: GroupNode[] }
  | { type: 'REPROCESS_DATA' };

export const viewCoordinatorMachine = setup({
  types: {
    context: {} as ViewCoordinatorContext,
    events: {} as ViewEvents,
    input: {} as { columns: Column[] }
  },
  
  actors: {
    processDataTransformation,
    calculateGroupSummaries
  },
  
  actions: {
    // Group management
    setGroupBy: assign({
      groupBy: ({ event }) => 
        event.type === 'view.group.set' ? event.groupBy : [],
      version: ({ context }) => context.version + 1
    }),
    
    toggleGroup: assign({
      collapsedGroups: ({ context, event }) => {
        if (event.type !== 'view.group.toggle') return context.collapsedGroups;
        
        const newCollapsed = new Set(context.collapsedGroups);
        if (newCollapsed.has(event.groupId)) {
          newCollapsed.delete(event.groupId);
        } else {
          newCollapsed.add(event.groupId);
        }
        return newCollapsed;
      }
    }),
    
    // Sort management
    setSortBy: assign({
      sortBy: ({ event }) => {
        if (event.type === 'view.sort.set') {
          console.log('[ViewCoordinator] Setting sortBy:', event.sortBy);
          return event.sortBy;
        }
        return [];
      },
      version: ({ context }) => context.version + 1
    }),
    
    notifyParentOfSortChange: ({ context }) => {
      // Send event to parent to trigger re-render
      if (context.sortBy && context.sortBy.length >= 0) {
        console.log('[ViewCoordinator] Notifying parent of sort change');
        // This will be handled by sendParent in the event handler
      }
    },
    
    // Handle column click for sort toggling
    handleColumnClick: assign({
      sortBy: ({ context, event }) => {
        console.log('[ViewCoordinator] handleColumnClick called with event:', event);
        
        if (event.type !== 'view.column.click') {
          console.log('[ViewCoordinator] Event type is not view.column.click:', event.type);
          return context.sortBy;
        }
        
        const { field, shiftKey } = event;
        console.log('[ViewCoordinator] Processing column click:', { field, shiftKey });
        
        const currentSort = context.sortBy || [];
        console.log('[ViewCoordinator] Current sort state:', currentSort);
        
        // Find existing sort config for this field
        const existingIndex = currentSort.findIndex(s => s.field === field);
        const existing = existingIndex >= 0 ? currentSort[existingIndex] : null;
        
        let newSortConfig: Array<{ field: string; direction: 'asc' | 'desc' }>;
        
        if (shiftKey) {
          // Multi-column sort
          newSortConfig = [...currentSort];
          
          if (existing) {
            // Toggle existing: asc -> desc -> remove
            if (existing.direction === 'asc') {
              newSortConfig[existingIndex] = { field, direction: 'desc' };
            } else {
              newSortConfig.splice(existingIndex, 1);
            }
          } else {
            // Add new sort
            newSortConfig.push({ field, direction: 'asc' });
          }
        } else {
          // Single column sort
          if (existing && currentSort.length === 1) {
            // Toggle: asc -> desc -> none
            if (existing.direction === 'asc') {
              newSortConfig = [{ field, direction: 'desc' }];
            } else {
              newSortConfig = [];
            }
          } else {
            // New single column sort
            newSortConfig = [{ field, direction: 'asc' }];
          }
        }
        
        console.log(`[ViewCoordinator] Column ${field} clicked:`, {
          existing,
          newSortConfig,
          shiftKey
        });
        
        return newSortConfig;
      },
      version: ({ context }) => context.version + 1
    }),
    
    // Filter management
    setFilters: assign({
      filters: ({ event }) => 
        event.type === 'view.filter.set' ? event.filters : []
    }),
    
    // Viewport management
    updateViewport: assign({
      viewport: ({ context, event }) => {
        if (event.type === 'view.viewport.update') {
          return event.viewport;
        }
        if (event.type === 'VIEWPORT_SCROLL') {
          return calculateViewport(
            event.scrollTop,
            event.containerHeight,
            event.itemHeight,
            context.totalRowCount,
            10
          );
        }
        return context.viewport;
      }
    }),
    
    // Data management
    updateRows: assign({
      allRows: ({ event }) => 
        event.type === 'ROWS_UPDATED' ? event.rows : [],
      totalRowCount: ({ event }) => 
        event.type === 'ROWS_UPDATED' ? event.rows.length : 0
    }),
    
    updateColumns: assign({
      columns: ({ event }) => 
        event.type === 'COLUMNS_CHANGED' ? event.columns : []
    }),
    
    // Processing state
    startProcessing: assign({
      isProcessing: true,
      processingQueue: ({ context }) => [
        ...context.processingQueue,
        {
          operation: 'data_transformation',
          timestamp: Date.now()
        }
      ]
    }),
    
    completeProcessing: assign({
      isProcessing: false,
      processedRows: ({ event }) => 
        event.type === 'PROCESSING_COMPLETE' ? event.result.processedRows : [],
      groupTree: ({ event }) => 
        event.type === 'PROCESSING_COMPLETE' ? event.result.groupTree : [],
      totalRowCount: ({ event }) => 
        event.type === 'PROCESSING_COMPLETE' ? event.result.totalRowCount : 0,
      lastProcessTime: () => Date.now(),
      processedItemCount: ({ event }) => 
        event.type === 'PROCESSING_COMPLETE' ? event.result.processedRows.length : 0,
      processingQueue: ({ context }) => 
        context.processingQueue.slice(1)
    }),
    
    updateGroupSummaries: assign({
      groupTree: ({ event }) => 
        event.type === 'SUMMARIES_UPDATED' ? event.groupTree : []
    }),
    
    // Performance tracking
    markPerformance: ({ context }) => {
      const processingTime = Date.now() - context.lastProcessTime;
      if (processingTime > 100) {
        console.warn(`View processing slow: ${processingTime}ms for ${context.processedItemCount} items`);
      }
    },
    
    // Column visibility management
    toggleColumnVisibility: assign({
      columnVisibility: ({ context, event }) => {
        if (event.type !== 'view.columns.toggle') return context.columnVisibility;
        
        const newVisibility = { ...context.columnVisibility };
        const columnId = event.columnId;
        
        // Find the column to check if it's hideable
        const column = context.columns.find(col => col.id === columnId);
        if (column && column.hideable === false) {
          // Don't toggle non-hideable columns
          return context.columnVisibility;
        }
        
        newVisibility[columnId] = !newVisibility[columnId];
        
        // Persist to localStorage
        if (context.entityType && typeof window !== 'undefined') {
          localStorage.setItem(
            `vibegridx-columns-${context.entityType}`,
            JSON.stringify(newVisibility)
          );
        }
        
        return newVisibility;
      },
      hiddenColumnCount: ({ context, event }) => {
        if (event.type !== 'view.columns.toggle') return context.hiddenColumnCount;
        
        const columnId = event.columnId;
        const currentlyVisible = context.columnVisibility[columnId] !== false;
        
        // Calculate new count based on toggle
        if (currentlyVisible) {
          return context.hiddenColumnCount + 1;
        } else {
          return Math.max(0, context.hiddenColumnCount - 1);
        }
      },
      version: ({ context }) => context.version + 1
    }),
    
    showAllColumns: assign({
      columnVisibility: ({ context }) => {
        const newVisibility = Object.fromEntries(
          context.columns.map(col => [col.id, true])
        );
        
        // Persist to localStorage
        if (context.entityType && typeof window !== 'undefined') {
          localStorage.setItem(
            `vibegridx-columns-${context.entityType}`,
            JSON.stringify(newVisibility)
          );
        }
        
        return newVisibility;
      },
      hiddenColumnCount: 0,
      version: ({ context }) => context.version + 1
    }),
    
    hideAllColumns: assign({
      columnVisibility: ({ context }) => {
        const newVisibility = Object.fromEntries(
          context.columns.map(col => [col.id, col.hideable === false ? true : false])
        );
        
        // Persist to localStorage
        if (context.entityType && typeof window !== 'undefined') {
          localStorage.setItem(
            `vibegridx-columns-${context.entityType}`,
            JSON.stringify(newVisibility)
          );
        }
        
        return newVisibility;
      },
      hiddenColumnCount: ({ context }) => {
        // Count columns that can be hidden
        return context.columns.filter(col => col.hideable !== false).length;
      },
      version: ({ context }) => context.version + 1
    }),
    
    setColumnVisibility: assign({
      columnVisibility: ({ event }) => {
        if (event.type !== 'view.columns.visibility.set') return {};
        return event.visibility;
      },
      hiddenColumnCount: ({ event }) => {
        if (event.type !== 'view.columns.visibility.set') return 0;
        return calculateHiddenCount(event.visibility);
      },
      version: ({ context }) => context.version + 1
    }),
    
    // Column drag actions
    startColumnDrag: assign({
      columnDragState: ({ context, event }) => {
        if (event.type !== 'view.columns.drag.start') return context.columnDragState;
        
        const columnIndex = context.columnOrder.indexOf(event.columnId);
        return {
          isDragging: true,
          draggedColumnId: event.columnId,
          draggedColumnIndex: columnIndex,
          currentDropIndex: columnIndex,
          mouseX: event.x,
          mouseY: event.y
        };
      }
    }),
    
    updateColumnDrag: assign({
      columnDragState: ({ context, event }) => {
        if (event.type !== 'view.columns.drag.move' || !context.columnDragState.isDragging) {
          return context.columnDragState;
        }
        
        return {
          ...context.columnDragState,
          mouseX: event.x,
          mouseY: event.y
        };
      }
    }),
    
    endColumnDrag: assign({
      columnOrder: ({ context, event }) => {
        if (event.type !== 'view.columns.drag.end' || !context.columnDragState.isDragging) {
          return context.columnOrder;
        }
        
        const fromIndex = context.columnDragState.draggedColumnIndex;
        const toIndex = event.targetIndex;
        
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
          return context.columnOrder;
        }
        
        // Reorder columns
        const newOrder = [...context.columnOrder];
        const [removed] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, removed);
        
        // Persist to localStorage
        if (context.entityType && typeof window !== 'undefined') {
          localStorage.setItem(
            `vibegridx-column-order-${context.entityType}`,
            JSON.stringify(newOrder)
          );
        }
        
        console.log('ViewCoordinator: Column reordered', { from: fromIndex, to: toIndex });
        return newOrder;
      },
      columnDragState: () => ({
        isDragging: false,
        draggedColumnId: null,
        draggedColumnIndex: -1,
        currentDropIndex: -1,
        mouseX: 0,
        mouseY: 0
      }),
      version: ({ context }) => context.version + 1
    }),
    
    cancelColumnDrag: assign({
      columnDragState: () => ({
        isDragging: false,
        draggedColumnId: null,
        draggedColumnIndex: -1,
        currentDropIndex: -1,
        mouseX: 0,
        mouseY: 0
      })
    }),
    
    setColumnOrder: assign({
      columnOrder: ({ event }) => {
        if (event.type !== 'view.columns.order.set') return [];
        
        // Persist to localStorage
        const context = event as any;
        if (context.entityType && typeof window !== 'undefined') {
          localStorage.setItem(
            `vibegridx-column-order-${context.entityType}`,
            JSON.stringify(event.order)
          );
        }
        
        return event.order;
      },
      version: ({ context }) => context.version + 1
    }),
    
    resetColumnOrder: assign({
      columnOrder: ({ context }) => {
        const defaultOrder = context.columns.map(col => col.id);
        
        // Clear persisted order
        if (context.entityType && typeof window !== 'undefined') {
          localStorage.removeItem(`vibegridx-column-order-${context.entityType}`);
        }
        
        return defaultOrder;
      },
      version: ({ context }) => context.version + 1
    })
  },
  
  guards: {
    hasData: ({ context }) => context.allRows.length > 0,
    hasGroups: ({ context }) => context.groupBy.length > 0,
    hasFilters: ({ context }) => context.filters.length > 0,
    hasSorting: ({ context }) => context.sortBy.length > 0,
    needsReprocessing: ({ context }) => 
      context.processingQueue.length > 0 || 
      (context.lastProcessTime < Date.now() - 5000), // Reprocess if stale
    hasGroupSummaries: ({ context }) => 
      context.groupTree.some(node => node.summary !== undefined)
  }
  
}).createMachine({
  id: 'viewCoordinator',
  
  initial: 'idle',
  
  context: ({ input }) => {
    // Get entity type from parent context via input
    const entityType = (input as any).entityType || '';
    
    // Try to restore persisted sort state
    const persistedSort = typeof window !== 'undefined' && entityType
      ? localStorage.getItem(`vibegridx-sort-${entityType}`)
      : null;
    
    const initialSortBy = persistedSort ? JSON.parse(persistedSort) : [];
    
    if (initialSortBy.length > 0) {
      console.log(`ViewCoordinator: Restored sort state for ${entityType}:`, initialSortBy);
    }
    
    // Try to restore persisted column visibility state
    const persistedColumns = typeof window !== 'undefined' && entityType
      ? localStorage.getItem(`vibegridx-columns-${entityType}`)
      : null;
    
    // Initialize all columns as visible by default
    const defaultVisibility = Object.fromEntries(
      input.columns.map(col => [col.id, true])
    );
    
    const initialColumnVisibility = persistedColumns 
      ? { ...defaultVisibility, ...JSON.parse(persistedColumns) }
      : defaultVisibility;
    
    const initialHiddenCount = calculateHiddenCount(initialColumnVisibility);
    
    if (persistedColumns) {
      console.log(`ViewCoordinator: Restored column visibility for ${entityType}, ${initialHiddenCount} hidden`);
    }
    
    // Try to restore persisted column order
    const persistedOrder = typeof window !== 'undefined' && entityType
      ? localStorage.getItem(`vibegridx-column-order-${entityType}`)
      : null;
    
    // Default column order is the order they were defined
    const defaultOrder = input.columns.map(col => col.id);
    const initialColumnOrder = persistedOrder 
      ? JSON.parse(persistedOrder)
      : defaultOrder;
    
    if (persistedOrder) {
      console.log(`ViewCoordinator: Restored column order for ${entityType}`);
    }
    
    return {
      entityType,
      columns: input.columns,
      allRows: [],
      processedRows: [],
      totalRowCount: 0,
      
      groupBy: [],
      groupTree: [],
      collapsedGroups: new Set(),
      sortBy: initialSortBy,
      filters: [],
      viewport: {
        start: 0,
        end: 50,
        height: 400,
        scrollTop: 0,
        itemHeight: 40
      },
      columnVisibility: initialColumnVisibility,
      hiddenColumnCount: initialHiddenCount,
      columnOrder: initialColumnOrder,
      
      isProcessing: false,
      processingQueue: [],
      lastProcessTime: 0,
      processedItemCount: 0,
      version: 0,
      
      // Initialize column drag state
      columnDragState: {
        isDragging: false,
        draggedColumnId: null,
        draggedColumnIndex: -1,
        currentDropIndex: -1,
        mouseX: 0,
        mouseY: 0
      }
    };
  },
  
  states: {
    idle: {
      entry: [
        // If we have initial sort state, hidden columns, or custom column order, notify parent to trigger render
        ({ context }) => {
          const hasInitialState = context.sortBy.length > 0 || 
                                  context.hiddenColumnCount > 0 ||
                                  JSON.stringify(context.columnOrder) !== JSON.stringify(context.columns.map(c => c.id));
          if (hasInitialState) {
            console.log('ViewCoordinator: Notifying parent of initial view state', {
              sortBy: context.sortBy.length,
              hiddenColumns: context.hiddenColumnCount,
              hasCustomOrder: JSON.stringify(context.columnOrder) !== JSON.stringify(context.columns.map(c => c.id))
            });
          }
        },
        sendParent(({ context }) => {
          const hasInitialState = context.sortBy.length > 0 || 
                                  context.hiddenColumnCount > 0 ||
                                  JSON.stringify(context.columnOrder) !== JSON.stringify(context.columns.map(c => c.id));
          if (hasInitialState) {
            return {
              type: 'view.state.changed',
              viewState: {
                sortBy: context.sortBy,
                filters: context.filters,
                groupBy: context.groupBy,
                columnVisibility: context.columnVisibility,
                hiddenColumnCount: context.hiddenColumnCount,
                columnOrder: context.columnOrder
              }
            };
          }
          return { type: 'noop' }; // XState requires an event to be returned
        })
      ],
      on: {
        // Configuration changes
        'view.group.set': {
          target: 'processing',
          actions: ['setGroupBy', 'startProcessing']
        },
        
        'view.group.toggle': {
          actions: 'toggleGroup'
        },
        
        'view.sort.set': {
          actions: ['setSortBy', 
            sendParent(({ context }) => ({
              type: 'view.state.changed',
              viewState: {
                sortBy: context.sortBy,
                filters: context.filters,
                groupBy: context.groupBy
              }
            }))
          ]
        },
        
        'view.column.click': {
          target: 'processing',
          actions: ['handleColumnClick', 'startProcessing',
            sendParent(({ context }) => ({
              type: 'view.state.changed',
              viewState: {
                sortBy: context.sortBy,
                filters: context.filters,
                groupBy: context.groupBy
              }
            })),
            // Clear selections when sort changes
            sendParent(() => ({
              type: 'selection.clear'
            }))
          ]
        },
        
        'view.filter.set': {
          target: 'processing',
          actions: ['setFilters', 'startProcessing']
        },
        
        'view.viewport.update': {
          actions: 'updateViewport'
        },
        
        // Data updates
        ROWS_UPDATED: {
          target: 'processing',
          actions: ['updateRows', 'startProcessing']
        },
        
        COLUMNS_CHANGED: {
          actions: 'updateColumns'
        },
        
        VIEWPORT_SCROLL: {
          actions: 'updateViewport'
        },
        
        REPROCESS_DATA: {
          guard: 'hasData',
          target: 'processing',
          actions: 'startProcessing'
        },
        
        // Column visibility events
        'view.columns.toggle': {
          actions: ['toggleColumnVisibility',
            sendParent(({ context }) => ({
              type: 'view.state.changed',
              viewState: {
                sortBy: context.sortBy,
                filters: context.filters,
                groupBy: context.groupBy,
                columnVisibility: context.columnVisibility,
                hiddenColumnCount: context.hiddenColumnCount
              }
            }))
          ]
        },
        
        'view.columns.show.all': {
          actions: ['showAllColumns',
            sendParent(({ context }) => ({
              type: 'view.state.changed',
              viewState: {
                sortBy: context.sortBy,
                filters: context.filters,
                groupBy: context.groupBy,
                columnVisibility: context.columnVisibility,
                hiddenColumnCount: context.hiddenColumnCount
              }
            }))
          ]
        },
        
        'view.columns.hide.all': {
          actions: ['hideAllColumns',
            sendParent(({ context }) => ({
              type: 'view.state.changed',
              viewState: {
                sortBy: context.sortBy,
                filters: context.filters,
                groupBy: context.groupBy,
                columnVisibility: context.columnVisibility,
                hiddenColumnCount: context.hiddenColumnCount
              }
            }))
          ]
        },
        
        'view.columns.visibility.set': {
          actions: ['setColumnVisibility',
            sendParent(({ context }) => ({
              type: 'view.state.changed',
              viewState: {
                sortBy: context.sortBy,
                filters: context.filters,
                groupBy: context.groupBy,
                columnVisibility: context.columnVisibility,
                hiddenColumnCount: context.hiddenColumnCount
              }
            }))
          ]
        },
        
        // Column drag events
        'view.columns.drag.start': {
          actions: ['startColumnDrag',
            sendParent(({ context }) => ({
              type: 'view.drag.started',
              columnDragState: context.columnDragState
            }))
          ]
        },
        
        'view.columns.drag.move': {
          actions: ['updateColumnDrag',
            sendParent(({ context }) => ({
              type: 'view.drag.updated',
              columnDragState: context.columnDragState
            }))
          ]
        },
        
        'view.columns.drag.end': {
          actions: ['endColumnDrag',
            sendParent(({ context }) => ({
              type: 'view.state.changed',
              viewState: {
                sortBy: context.sortBy,
                filters: context.filters,
                groupBy: context.groupBy,
                columnVisibility: context.columnVisibility,
                hiddenColumnCount: context.hiddenColumnCount,
                columnOrder: context.columnOrder
              }
            }))
          ]
        },
        
        'view.columns.drag.cancel': {
          actions: ['cancelColumnDrag',
            sendParent(({ context }) => ({
              type: 'view.drag.cancelled',
              columnDragState: context.columnDragState
            }))
          ]
        },
        
        'view.columns.order.set': {
          actions: ['setColumnOrder',
            sendParent(({ context }) => ({
              type: 'view.state.changed',
              viewState: {
                sortBy: context.sortBy,
                filters: context.filters,
                groupBy: context.groupBy,
                columnVisibility: context.columnVisibility,
                hiddenColumnCount: context.hiddenColumnCount,
                columnOrder: context.columnOrder
              }
            }))
          ]
        },
        
        'view.columns.order.reset': {
          actions: ['resetColumnOrder',
            sendParent(({ context }) => ({
              type: 'view.state.changed',
              viewState: {
                sortBy: context.sortBy,
                filters: context.filters,
                groupBy: context.groupBy,
                columnVisibility: context.columnVisibility,
                hiddenColumnCount: context.hiddenColumnCount,
                columnOrder: context.columnOrder
              }
            }))
          ]
        }
      }
    },
    
    processing: {
      entry: () => {
        console.log('[ViewCoordinator] Entering processing state');
      },
      invoke: {
        src: 'processDataTransformation',
        input: ({ context }) => {
          console.log('[ViewCoordinator] Processing data with:', {
            rowCount: context.allRows.length,
            sortBy: context.sortBy,
            filters: context.filters.length,
            groupBy: context.groupBy
          });
          return {
            rows: context.allRows,
            filters: context.filters,
            sortBy: context.sortBy,
            groupBy: context.groupBy,
            columns: context.columns
          };
        },
        onDone: [
          {
            guard: 'hasGroups',
            target: 'calculatingSummaries',
            actions: 'completeProcessing'
          },
          {
            target: 'idle',
            actions: ['completeProcessing', 'markPerformance']
          }
        ],
        onError: {
          target: 'idle',
          actions: assign({
            isProcessing: false,
            processingQueue: ({ context }) => context.processingQueue.slice(1)
          })
        }
      }
    },
    
    calculatingSummaries: {
      invoke: {
        src: 'calculateGroupSummaries',
        input: ({ context }) => ({
          groupTree: context.groupTree,
          columns: context.columns
        }),
        onDone: {
          target: 'idle',
          actions: ['updateGroupSummaries', 'markPerformance']
        },
        onError: {
          target: 'idle',
          actions: 'markPerformance'
        }
      }
    }
  }
});
// Core types for VibeGridX XState v5 architecture
import type { ActorRefFrom } from 'xstate';

// ====================================
// CORE ENTITY TYPES
// ====================================

export interface TableRow {
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

export interface Column<T = any> {
  id: string;
  name: string;
  field: keyof T & string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  width: number; // Required - no defaults
  editable?: boolean;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  options?: string[]; // for select type
}

export interface TableSettings {
  enableVirtualScrolling?: boolean;
  enableGrouping?: boolean;
  enableFiltering?: boolean;
  enableFormulas?: boolean;
  enableCollaboration?: boolean;
  pageSize?: number;
  rowHeight?: number;
  bufferSize?: number;
}

// ====================================
// SELECTION TYPES
// ====================================

export interface CellRef {
  rowId: string;
  columnId: string;
}

export interface SelectionRange {
  start: CellRef;
  end: CellRef;
}

export type SelectionMode = 'single' | 'range' | 'column' | 'row';

// ====================================
// EDIT TYPES
// ====================================

export interface EditingState {
  cellRef: CellRef;
  value: any;
  originalValue: any;
  isValid: boolean;
  validationErrors: string[];
}

export interface OptimisticOperation {
  id: string;
  type: 'update' | 'create' | 'delete';
  entityId: string;
  field: string;
  newValue: any;
  oldValue: any;
  timestamp: number;
}

// ====================================
// VIEW TYPES
// ====================================

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  id: string;
  field: string;
  operator: FilterOperator;
  value: any;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'select';
  caseSensitive?: boolean;
  negate?: boolean;
}

export type FilterOperator = 
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'greater_than' | 'less_than' | 'between'
  | 'is_empty' | 'is_not_empty'
  | 'in' | 'not_in'
  | 'regex';

export interface GroupNode {
  id: string;
  field: string;
  value: any;
  level: number;
  rowCount: number;
  children: GroupNode[] | TableRow[];
  isCollapsed?: boolean;
  summary?: Record<string, any>;
}

// ====================================
// DRAG TYPES
// ====================================

export interface DraggedItem {
  type: 'row' | 'column' | 'group';
  id: string;
  data?: any;
}

export interface DropTarget {
  type: 'row' | 'column' | 'group';
  id: string;
  position: 'above' | 'below' | 'left' | 'right';
  valid: boolean;
}

// ====================================
// VIEWPORT TYPES
// ====================================

export interface ViewportInfo {
  start: number;
  end: number;
  height: number;
  width: number;
  scrollTop: number;
  scrollLeft?: number;
  itemHeight: number;
}

// ====================================
// CONTEXT TYPES
// ====================================

export interface TableContext {
  id: string;
  entityType: 'task' | 'project' | 'user' | string;
  columns: Column<any>[];
  visibleRowIds: string[];
  settings: TableSettings;
  version: number;
  
  // Dimension management
  dimensionManager?: any; // Will be typed as ColumnDimensionManager after import
  rowDimensionManager?: any; // Will be typed as RowDimensionManager after import
  
  // Actor references
  actors: {
    selectionCoordinator: ActorRefFrom<any> | null;
    editCoordinator: ActorRefFrom<any> | null;
    viewCoordinator: ActorRefFrom<any> | null;
    dragCoordinator: ActorRefFrom<any> | null;
    overlayActor: ActorRefFrom<any> | null;
    rowActors: Map<string, ActorRefFrom<any>>;
  };
  
  // Performance tracking
  performance: {
    lastRenderTime: number;
    totalRows: number;
    visibleRows: number;
    activeActors: number;
  };
}

export interface SelectionContext {
  selectedCells: Set<string>; // "rowId:columnId"
  activeCell: CellRef | null;
  selectionRanges: SelectionRange[];
  selectionMode: SelectionMode;
  anchor: CellRef | null; // For range selection
}

export interface EditContext {
  editingCell: CellRef | null;
  editValue: any;
  originalValue: any;
  validationErrors: Map<string, string>;
  optimisticOperations: Map<string, OptimisticOperation>;
  isDirty: boolean;
}

export interface ViewContext {
  groupBy: string[];
  groupTree: GroupNode[];
  collapsedGroups: Set<string>;
  sortBy: SortConfig[];
  filters: FilterConfig[];
  viewport: ViewportInfo;
}

export interface DragContext {
  draggedItem: DraggedItem | null;
  dropTarget: DropTarget | null;
  isActive: boolean;
  constraints: Record<string, any>;
}

// ====================================
// EVENT TYPES
// ====================================

export type TableEvents = 
  // Entity configuration
  | { type: 'SET_ENTITY_TYPE'; entityType: string; columns: Column[] }
  | { type: 'SET_VISIBLE_ENTITIES'; entityIds: string[] }
  
  // Selection events
  | { type: 'selection.cell.select'; rowId: string; columnId: string; ctrlKey?: boolean; shiftKey?: boolean }
  | { type: 'selection.range.select'; start: CellRef; end: CellRef }
  | { type: 'selection.row.select'; rowId: string; extend?: boolean }
  | { type: 'selection.column.select'; columnId: string; extend?: boolean }
  | { type: 'selection.bulk.set'; selectedCells: Set<string> }
  | { type: 'selection.clear' }
  | { type: 'selection.drag.start'; startCell: CellRef }
  | { type: 'selection.drag.move'; currentCell: CellRef; selectedCells: Set<string> }
  | { type: 'selection.drag.end'; selectedCells: Set<string> }
  
  // Edit events
  | { type: 'edit.cell.start'; rowId: string; columnId: string }
  | { type: 'edit.value.update'; value: any }
  | { type: 'edit.commit' }
  | { type: 'edit.cancel' }
  | { type: 'edit.row.create'; insertAfter?: string }
  
  // Keyboard events
  | { type: 'keyboard.arrow'; direction: 'up' | 'down' | 'left' | 'right'; extend?: boolean }
  | { type: 'keyboard.copy' }
  | { type: 'keyboard.paste'; data?: string }
  | { type: 'keyboard.delete' }
  | { type: 'keyboard.enter'; shift?: boolean }
  | { type: 'keyboard.tab'; shift?: boolean }
  | { type: 'keyboard.escape' }
  
  // View events
  | { type: 'view.group.set'; groupBy: string[] }
  | { type: 'view.group.toggle'; groupId: string }
  | { type: 'view.sort.set'; sortBy: SortConfig[] }
  | { type: 'view.filter.set'; filters: FilterConfig[] }
  | { type: 'view.viewport.update'; viewport: ViewportInfo }
  
  // Drag events
  | { type: 'drag.row.start'; rowId: string }
  | { type: 'drag.row.over'; targetRowId: string; position: 'above' | 'below' }
  | { type: 'drag.row.drop' }
  | { type: 'drag.cancel' }
  
  // Performance events
  | { type: 'PERFORMANCE_MARK'; operation: string; duration: number }
  | { type: 'ACTOR_SPAWNED'; actorType: string; actorId: string }
  | { type: 'ACTOR_STOPPED'; actorType: string; actorId: string };

// ====================================
// CONFIGURATION TYPES
// ====================================

export interface TableConfig {
  id: string;
  entityType: string;
  columns: Column<any>[];
  initialData?: TableRow[];
  settings?: TableSettings;
}

// ====================================
// RENDERER TYPES
// ====================================

export interface RendererOptions {
  container: HTMLElement;
  columns?: Column<any>[];
  dimensionManager?: any; // Will be typed as ColumnDimensionManager
  rowDimensionManager?: any; // Will be typed as RowDimensionManager
  onCellClick?: (rowId: string, columnId: string, event: MouseEvent) => void;
  onCellDoubleClick?: (rowId: string, columnId: string, event: MouseEvent) => void;
  onColumnClick?: (columnId: string, event: MouseEvent) => void;
  onStateChange?: (state: any) => void;
  onScroll?: (viewport: ViewportInfo) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onSelectionChange?: (selectedCells: Set<string>) => void;
  onFillComplete?: (originalCells: Set<string>, fillCells: Set<string>) => void;
  onCanvasContainerReady?: (container: HTMLElement) => void;
  debug?: boolean;
  
  // Canvas overlay configuration
  cellHeight?: number;
  cellWidth?: number;
  selectionColor?: string;
  selectionBorderColor?: string;
  editingColor?: string;
  editingBorderColor?: string;
  enableAnimations?: boolean;
  animationDuration?: number;
  borderWidth?: number;
}

export interface RenderState {
  rows: TableRow[]; // All rows in the table (renamed from visibleRows for clarity)
  columns?: Column<any>[];
  selectedCells: Set<string>;
  editingCell: CellRef | null;
  groupedData: GroupNode[];
  optimisticOperations: Map<string, OptimisticOperation>;
  version: number;
}
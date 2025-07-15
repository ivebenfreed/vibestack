// Core types for VibeGridX XState v5 architecture
import type { ActorRefFrom } from 'xstate';

// View state management types
export type SortConfig = {
  field: string;
  direction: 'asc' | 'desc';
};

export type FilterConfig = {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'in' | 'not_in' | 'regex';
  value: any;
  caseSensitive?: boolean;
  negate?: boolean;
};
import type { EnumOption, VibeGridXColumn } from '@repo/dataforge/vibegridx-columns';

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

// Extend the generated column type with runtime-specific options
export interface Column<T = any> extends VibeGridXColumn<T> {
  // Additional runtime options not in generated columns
  options?: string[] | EnumOption[]; // Allow string[] for backward compatibility
  
  // Additional display formatting
  className?: string;
  style?: Record<string, any>;
  
  // Additional text renderer options
  minLength?: number;
  pattern?: string;
  patternError?: string;
  searchTerm?: string;
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize';
  colorMap?: Record<string, string>;
  fontWeight?: string;
  fontSize?: string;
  
  // Additional number renderer options
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  step?: number;
  useLocale?: boolean;
  locale?: string;
  currency?: string;
  prefix?: string;
  suffix?: string;
  showArrows?: boolean;
  showPlusSign?: boolean;
  negativeFormat?: 'minus' | 'parentheses';
  negativeColor?: string;
  positiveColor?: string;
  zeroColor?: string;
  colorScale?: any;
  numberFormat?: any;
  
  // Additional date renderer options
  inputFormat?: string;
  dateOptions?: Intl.DateTimeFormatOptions;
  timeOptions?: Intl.DateTimeFormatOptions;
  dateTimeOptions?: Intl.DateTimeFormatOptions;
  showRelativeTime?: boolean;
  relativeTimePosition?: 'append' | 'replace';
  minDate?: string | Date;
  maxDate?: string | Date;
  allowedDaysOfWeek?: number[];
  pastColor?: string;
  futureColor?: string;
  todayColor?: string;
  highlightOverdue?: boolean;
  highlightUpcoming?: boolean;
  upcomingDays?: number;
  customFormat?: (date: Date) => string;
  
  // Boolean renderer options
  allowNull?: boolean;
  trueLabel?: string;
  falseLabel?: string;
  nullLabel?: string;
  trueIcon?: string;
  falseIcon?: string;
  nullIcon?: string;
  trueColor?: string;
  falseColor?: string;
  nullColor?: string;
  trueBadgeColor?: string;
  falseBadgeColor?: string;
  nullBadgeColor?: string;
  readOnly?: boolean;
  
  // Enum renderer options
  enumOptions?: EnumOption[];
  strictEnum?: boolean;
  multiple?: boolean;
  maxSelections?: number;
  minSelections?: number;
  customRender?: (value: any, option?: EnumOption) => string;
  
  // Column visibility options
  hideable?: boolean; // Whether column can be hidden (default: true)
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
  initialViewport?: ViewportInfo;
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

// Removed duplicate SortConfig and FilterConfig interfaces
// Using the type definitions from the top of the file

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
  type: 'row' | 'column' | 'group' | 'cell';
  id: string;
  index?: number;
  data?: any;
}

export interface DropTarget {
  type: 'row' | 'column' | 'group' | 'cell' | 'selection';
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
  rows: TableRow[]; // Processed and sorted rows ready for rendering
  visibleRowIds: string[]; // Currently visible row IDs in viewport
  allRowIds: string[]; // All row IDs in the dataset
  settings: TableSettings;
  version: number;
  enableSelectionColumn: boolean;
  
  // Dimension management
  dimensionManager?: any; // Will be typed as ColumnDimensionManager after import
  rowDimensionManager?: any; // Will be typed as RowDimensionManager after import
  coordinateManager?: any; // Will be typed as VibeGridXCoordinateManager after import
  // selectionManager removed - selection state now managed directly in TableMachine
  
  // Coordinate mapping from coordinate actor
  coordinateMapping?: any; // Will be typed as CoordinateMapping after import
  
  // Entities from parent component (via EntityIntegration/domain atoms)
  entities: any[]; // Raw entity data provided by parent
  
  // Relationship resolvers for foreign key lookups
  relationshipResolvers: Record<string, (id: string | string[]) => string>;
  
  // Entity update handler for self-contained saves
  onEntityUpdate?: (rowId: string, updates: Record<string, any>) => Promise<void> | void;
  
  // Atom subscription management (moved from React to XState)
  primaryAtom?: any; // Primary entity atom to subscribe to
  relationshipAtoms?: Record<string, any>; // Relationship atoms for foreign key lookups
  atomUnsubscribers?: {
    primary?: () => void;
    relationships: Record<string, () => void>;
  }; // Cleanup functions for atom subscriptions
  
  // View state management (moved from viewCoordinator)
  sortBy: SortConfig[];
  filters: FilterConfig[];
  groupBy: string[];
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  hiddenColumnCount: number;
  
  // Current viewport for coordinate calculations
  viewport: ViewportInfo | null;
  
  // Selection state (for stateless canvas rendering)
  selectedCells: Set<string>;
  
  // Actor references
  actors: {
    rendererActor: ActorRefFrom<any> | null;
    canvasActor: ActorRefFrom<any> | null;
    selectionCoordinator: ActorRefFrom<any> | null;
    // viewCoordinator removed - view state now managed directly in TableMachine
    dragCoordinator: ActorRefFrom<any> | null;
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
  selectedRows: Set<string>; // Row IDs for checkbox selection
  activeCell: CellRef | null;
  selectionRanges: SelectionRange[];
  selectionMode: SelectionMode;
  anchor: CellRef | null; // For range selection
  lastSelectedRowId: string | null; // For shift+click range selection
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
  columnVisibility: Record<string, boolean>; // columnId -> visible
  hiddenColumnCount: number;
  columnOrder: string[]; // Array of column IDs in display order
}

export interface DragContext {
  draggedItem: DraggedItem | null;
  dropTarget: DropTarget | null;
  isActive: boolean;
  constraints: Record<string, any>;
}

// Column drag state for header reordering
export interface ColumnDragState {
  isDragging: boolean;
  draggedColumnId: string | null;
  draggedColumnIndex: number;
  currentDropIndex: number;
  mouseX: number;
  mouseY: number;
}

// Column resize state
export interface ColumnResizeState {
  isResizing: boolean;
  resizingColumnId: string | null;
  startX: number;
  startWidth: number;
  currentX: number;
  previewWidth: number;
}

// Row selection state
export interface RowSelectionState {
  selectedRows: Set<string>;
  lastSelectedRowId: string | null;
  selectionMode: 'checkbox' | 'cell' | 'both';
}

// ====================================
// EVENT TYPES
// ====================================

export type TableEvents = 
  // Entity configuration
  | { type: 'SET_ENTITY_TYPE'; entityType: string; columns: Column[] }
  | { type: 'SET_VISIBLE_ENTITIES'; entityIds: string[] }
  | { type: 'SET_ENTITIES'; entities: any[] }
  | { type: 'UPDATE_RELATIONSHIP_DATA'; relationshipTable: string; data: Record<string, any> }
  | { type: 'ROWS_SORTED'; rowIds: string[]; sortBy: SortConfig[] }
  
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
  | { type: 'selection.checkbox.toggle'; rowId: string }
  | { type: 'selection.checkbox.all' }
  | { type: 'selection.checkbox.none' }
  | { type: 'selection.checkbox.range'; startRowId: string; endRowId: string }
  
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
  | { type: 'view.column.click'; columnId: string; field: string; shiftKey: boolean }
  | { type: 'view.filter.set'; filters: FilterConfig[] }
  | { type: 'view.viewport.update'; viewport: ViewportInfo }
  | { type: 'view.columns.toggle'; columnId: string }
  | { type: 'view.columns.show.all' }
  | { type: 'view.columns.hide.all' }
  | { type: 'view.columns.visibility.set'; visibility: Record<string, boolean> }
  | { type: 'view.columns.drag.start'; columnId: string; x: number; y: number }
  | { type: 'view.columns.drag.move'; x: number; y: number }
  | { type: 'view.columns.drag.end'; targetIndex: number }
  | { type: 'view.columns.drag.cancel' }
  | { type: 'view.columns.reorder'; fromIndex: number; toIndex: number }
  | { type: 'view.columns.order.set'; order: string[] }
  | { type: 'view.columns.order.reset' }
  | { type: 'view.columns.resize.start'; columnId: string; x: number; width: number }
  | { type: 'view.columns.resize.move'; x: number }
  | { type: 'view.columns.resize.end' }
  | { type: 'view.columns.resize.cancel' }
  | { type: 'view.column.resized'; columnId: string; width: number } // Event from view coordinator to parent
  
  // Drag events
  | { type: 'drag.row.start'; rowId: string }
  | { type: 'drag.row.over'; targetRowId: string; position: 'above' | 'below' }
  | { type: 'drag.row.drop' }
  | { type: 'drag.cancel' }
  
  // Performance events
  | { type: 'PERFORMANCE_MARK'; operation: string; duration: number }
  | { type: 'ACTOR_SPAWNED'; actorType: string; actorId: string }
  | { type: 'ACTOR_STOPPED'; actorType: string; actorId: string }
  
  // Resize state events from view coordinator
  | { type: 'view.resize.started'; columnResizeState: ColumnResizeState }
  | { type: 'view.resize.updated'; columnResizeState: ColumnResizeState }
  | { type: 'view.resize.ended' }
  | { type: 'view.resize.cancelled' }
  
  // Fill events (responses from canvas actor)
  | { type: 'FILL_START'; direction: 'vertical' | 'horizontal' }
  | { type: 'FILL_PREVIEW'; previewCells: Set<string> }
  | { type: 'FILL_COMPLETE'; fillCells: Set<string> }
  | { type: 'FILL_CANCEL' };

// ====================================
// CONFIGURATION TYPES
// ====================================

export interface TableConfig {
  id: string;
  entityType: string;
  columns: Column<any>[];
  entities?: any[]; // CLEAN API: Pass entities directly instead of atomConfig
  relationshipResolvers?: Record<string, (id: string | string[]) => string>; // Resolvers for relationship columns
  initialData?: TableRow[];
  settings?: TableSettings;
  enableSelectionColumn?: boolean;
  persistedData?: any; // Persisted UI state from localStorage (sync machine pattern)
  onEntityUpdate?: (rowId: string, updates: Record<string, any>) => Promise<void> | void; // Generic entity update handler
}

// ====================================
// RELATIONSHIP DATA TYPES
// ====================================

export interface RelationshipDataProvider {
  [key: string]: {
    data: Array<{ id: string; name?: string; [key: string]: any }>
    displayField?: string
  }
}

// ====================================
// RENDERER TYPES
// ====================================

export interface RendererOptions {
  container: HTMLElement;
  columns?: Column<any>[];
  dimensionManager?: any; // Will be typed as ColumnDimensionManager
  rowDimensionManager?: any; // Will be typed as RowDimensionManager
  coordinateManager?: any; // Will be typed as VibeGridXCoordinateManager
  relationshipData?: RelationshipDataProvider;
  enableSelectionColumn?: boolean;
  onCellClick?: (rowId: string, columnId: string, event: MouseEvent) => void;
  onCellDoubleClick?: (rowId: string, columnId: string, event: MouseEvent) => void;
  onColumnClick?: (columnId: string, event: MouseEvent) => void;
  onColumnDragStart?: (columnId: string, x: number, y: number) => void;
  onColumnDragMove?: (x: number, y: number) => void;
  onColumnDragEnd?: (targetIndex: number) => void;
  onColumnResizeStart?: (columnId: string, x: number, width: number) => void;
  onColumnResizeMove?: (x: number) => void;
  onColumnResizeEnd?: () => void;
  onStateChange?: (state: any) => void;
  onScroll?: (viewport: ViewportInfo) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onSelectionChange?: (selectedCells: Set<string>) => void;
  onFillComplete?: (originalCells: Set<string>, fillCells: Set<string>) => void;
  // onCanvasContainerReady removed - now using event-driven pattern
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
  
  // Performance: Initial viewport for virtual scrolling
  initialViewport?: ViewportInfo;
}

export interface RenderState {
  rows: TableRow[]; // All rows in the table (renamed from visibleRows for clarity)
  columns?: Column<any>[];
  selectedCells: Set<string>;
  editingCell: CellRef | null;
  groupedData: GroupNode[];
  optimisticOperations: Map<string, OptimisticOperation>;
  version: number;
  sortBy?: SortConfig[]; // Current sort configuration
  columnVisibility?: Record<string, boolean>; // Column visibility state
  columnOrder?: string[]; // Column order array
  columnWidths?: Record<string, number>; // Column widths from table machine context
  columnOffsets?: Record<string, number>; // Column offsets from table machine context
  totalWidth?: number; // Total width of all columns from table machine context
  totalHeight?: number; // Total height from table machine context
  
  // AUTHORITATIVE coordinate mapping from state machine
  coordinateMapping?: {
    rows: Array<{
      rowId: string;
      originalIndex: number;
      sortedIndex: number;
      offset: number;
    }>;
    columns: Array<{
      columnId: string;
      index: number;
      offset: number;
      width: number;
    }>;
    version: number;
  };
}
/**
 * UltraTable TypeScript Definitions
 */

export interface Column {
  id: string;
  field?: string;
  name?: string;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'enum' | 'relationship-single' | 'relationship-multi';
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  sortable?: boolean;
  editable?: boolean;
  visible?: boolean;
  
  // Enum/Select options
  options?: Array<{ value: string; label: string; color?: string }>;
  
  // Relationship configuration
  relationshipType?: 'single' | 'multi';
  relationshipTable?: string;
  relationshipField?: string;
  relationshipDisplayField?: string;
  
  // Formatting
  format?: string;
  placeholder?: string;
  
  // Custom renderer
  cellRenderer?: (value: any, row: any) => string | HTMLElement;
}

export interface UltraTableProps {
  // Data source
  entityType: string;
  tableId?: string;
  
  // Column configuration
  columns?: Column[];
  
  // Dimensions
  width?: number | string;
  height?: number | string;
  rowHeight?: number;
  
  // Features
  enableVirtualScrolling?: boolean;
  enableSelectionColumn?: boolean;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableGrouping?: boolean;
  enableResizing?: boolean;
  enableReordering?: boolean;
  
  // Performance
  bufferRows?: number;
  
  // Styling
  className?: string;
  
  // Event handlers
  onCellClick?: (rowId: string, columnId: string, value: any, rowData: any) => void;
  onCellDoubleClick?: (rowId: string, columnId: string, value: any, rowData: any) => void;
  onCellEdit?: (rowId: string, columnId: string, oldValue: any, newValue: any) => Promise<void> | void;
  onSelectionChange?: (selectedRows: Set<string>, selectedCells: Set<string>) => void;
  onColumnSort?: (columnId: string, direction: 'asc' | 'desc' | null) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  onColumnReorder?: (columnId: string, fromIndex: number, toIndex: number) => void;
  onScroll?: (scrollTop: number, scrollLeft: number) => void;
  
  // Ref for imperative API
  ref?: React.Ref<UltraTableAPI>;
}

export interface UltraTableAPI {
  getSelectedRows(): Set<string>;
  clearSelection(): void;
  scrollToRow(rowId: string): void;
  refresh(): void;
  getRenderer(): any;
}

export interface UltraTableState {
  // Data
  entities: any[];
  
  // View state
  sortBy: Array<{ field: string; direction: 'asc' | 'desc' }>;
  filters: any[];
  selectedRows: Set<string>;
  selectedCells: Set<string>;
  
  // UI state
  editingCell: { rowId: string; columnId: string } | null;
  viewport: {
    scrollTop: number;
    scrollLeft: number;
    visibleStart: number;
    visibleEnd: number;
    containerWidth: number;
    containerHeight: number;
  };
  
  // Column state
  columnWidths: Record<string, number>;
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  
  // Performance tracking
  lastRenderTime: number;
  renderCount: number;
}

export interface RendererOptions {
  container: HTMLElement;
  columns: Column[];
  entityType: string;
  tableId: string;
  
  // Performance settings
  enableVirtualScrolling: boolean;
  enableSelectionColumn: boolean;
  bufferRows: number;
  rowHeight: number;
  
  // Event handlers
  onCellClick?: (rowId: string, columnId: string, value: any, rowData: any) => void;
  onCellDoubleClick?: (rowId: string, columnId: string, value: any, rowData: any) => void;
  onSelectionChange?: (selectedRows: Set<string>, selectedCells: Set<string>) => void;
  onCellEdit?: (rowId: string, columnId: string, oldValue: any, newValue: any) => Promise<void> | void;
  onColumnSort?: (columnId: string, direction: 'asc' | 'desc' | null) => void;
  onScroll?: (scrollTop: number, scrollLeft: number) => void;
  
  debug?: boolean;
}

export interface ViewportInfo {
  scrollTop: number;
  scrollLeft: number;
  containerWidth: number;
  containerHeight: number;
  visibleStart: number;
  visibleEnd: number;
  totalRows: number;
}

export interface CellPosition {
  rowId: string;
  columnId: string;
  rowIndex: number;
  columnIndex: number;
}

export interface RenderMetrics {
  renderTime: number;
  cellCount: number;
  visibleRows: number;
  totalRows: number;
  fps: number;
}
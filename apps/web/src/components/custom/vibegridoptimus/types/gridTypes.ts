import type { ActorRef } from 'xstate'
import type { gridCellMachine } from '../machines/gridCellMachine'

export interface SortColumn {
  columnKey: string
  direction: 'ASC' | 'DESC'
}

export interface FilterState {
  activeFilters: Map<string, FilterCondition>
  globalSearch: string
  quickFilters: Set<string>
}

export interface FilterCondition {
  type: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between' | 'in'
  value: any
  operator?: 'and' | 'or'
}

export interface GridSelection {
  cells: Set<string>
  rows: Set<string>
  columns: Set<string>
  ranges: SelectionRange[]
}

export interface SelectionRange {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

export interface GridPreferences {
  columnWidths: Map<string, number>
  columnOrder: string[]
  hiddenColumns: Set<string>
  sortColumns: SortColumn[]
  filterState: FilterState
  pageSize: number
  pinnedColumns: { left: string[]; right: string[] }
}

export interface VirtualizedRange {
  start: number
  end: number
  overscan: number
}

export interface GridContext {
  // Cell Management
  cells: Map<string, ActorRef<typeof gridCellMachine>>
  activeCell: string | null
  pendingSaves: Set<string>
  
  // Grid State
  sortColumns: SortColumn[]
  filterState: FilterState
  selection: GridSelection
  
  // Pagination
  currentPage: number
  pageSize: number
  totalCount: number
  
  // Local Persistence
  preferences: GridPreferences
  persistenceKey: string
  
  // Performance
  virtualizedRange: VirtualizedRange
  lastAtomUpdate: number
  
  // Error Handling
  errors: Map<string, GridError>
  retryCount: number
}

export interface GridError {
  id: string
  type: 'cell_save' | 'grid_load' | 'persistence' | 'sync'
  message: string
  timestamp: number
  context?: Record<string, any>
}

export type GridEvent =
  // Cell Events
  | { type: 'REGISTER_CELL'; cellId: string; columnKey: string; value: any; onUpdate?: SaveHandler }
  | { type: 'UNREGISTER_CELL'; cellId: string; columnKey: string }
  | { type: 'CELL_EDIT_START'; cellId: string; columnKey: string }
  | { type: 'CELL_SAVE_START'; cellId: string; columnKey: string }
  | { type: 'CELL_SAVE_COMPLETE'; cellId: string; columnKey: string }
  | { type: 'CELL_SAVE_FAILED'; cellId: string; columnKey: string; error: string }
  
  // Grid State Events
  | { type: 'SORT_CHANGE'; sortColumns: SortColumn[] }
  | { type: 'FILTER_CHANGE'; filterState: FilterState }
  | { type: 'SELECT_CELL'; cellId: string; extend?: boolean }
  | { type: 'SELECT_ROW'; rowId: string; extend?: boolean }
  | { type: 'SELECT_COLUMN'; columnKey: string; extend?: boolean }
  | { type: 'CLEAR_SELECTION' }
  
  // Pagination Events
  | { type: 'SET_PAGE'; page: number }
  | { type: 'SET_PAGE_SIZE'; pageSize: number }
  
  // Persistence Events
  | { type: 'SAVE_PREFERENCES' }
  | { type: 'LOAD_PREFERENCES' }
  | { type: 'RESET_PREFERENCES' }
  
  // Data Events
  | { type: 'ATOM_UPDATE'; cellId: string; columnKey: string; value: any }
  | { type: 'BULK_UPDATE'; updates: Array<{ cellId: string; columnKey: string; value: any }> }
  | { type: 'REFRESH_DATA' }
  
  // Performance Events
  | { type: 'SET_VIRTUALIZED_RANGE'; range: VirtualizedRange }
  
  // Error Events
  | { type: 'ERROR_OCCURRED'; error: GridError }
  | { type: 'ERROR_CLEARED'; errorId: string }
  | { type: 'RETRY_FAILED_OPERATION'; errorId: string }

export type SaveHandler = (id: string, column: string, value: any) => Promise<void>

export interface GridMachineAPI {
  // Cell Management
  registerCell: (cellId: string, columnKey: string, value: any, onUpdate?: SaveHandler) => void
  unregisterCell: (cellId: string, columnKey: string) => void
  getCellState: (cellId: string, columnKey: string) => any
  
  // Grid State
  sortColumns: SortColumn[]
  setSortColumns: (columns: SortColumn[]) => void
  filterState: FilterState
  setFilterState: (state: FilterState) => void
  
  // Selection
  selection: GridSelection
  selectCell: (cellId: string, extend?: boolean) => void
  selectRow: (rowId: string, extend?: boolean) => void
  selectColumn: (columnKey: string, extend?: boolean) => void
  clearSelection: () => void
  
  // Pagination
  currentPage: number
  pageSize: number
  totalCount: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  
  // Persistence
  savePreferences: () => void
  loadPreferences: () => void
  resetPreferences: () => void
  
  // Performance
  virtualizedRange: VirtualizedRange
  setVirtualizedRange: (range: VirtualizedRange) => void
  
  // State
  isEditing: boolean
  isLoading: boolean
  pendingSavesCount: number
  errors: GridError[]
}
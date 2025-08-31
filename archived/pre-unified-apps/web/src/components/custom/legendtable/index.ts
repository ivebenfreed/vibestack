// Main component export
export { LegendTable } from './LegendTable';

// Types export
export type { 
  LegendTableProps, 
  TableConfig, 
  SortConfig, 
  SelectionState,
  Column,
  TableRow,
  CellRef,
  ViewportInfo
} from './types';

// Hook exports
export { useLegendTableState } from './hooks/use-legend-table-state';
export { useTableData } from './hooks/use-table-data';
export { useTableViewport } from './hooks/use-table-viewport';
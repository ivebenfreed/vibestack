import { observable, batch, computed } from '@legendapp/state';
import type { 
import { uiLog } from '@/logger';
const log = uiLog('components/custom/legendtable/state/table-state.ts');
  TableRow, 
  Column, 
  CellRef, 
  ViewportInfo, 
  SortConfig, 
  SelectionState,
  TableConfig,
  CoordinateMapping 
} from '../types';

// Utility functions for data processing
function filterData(data: TableRow[], filters: Map<string, any>, searchTerm: string): TableRow[] {
  return data.filter(row => {
    // Handle rows where data might be directly on the row, not nested
    const rowData = row.data || row;
    
    // Skip rows with no usable data
    if (!rowData || typeof rowData !== 'object') return false;
    
    // Apply column filters
    for (const [columnId, filterValue] of filters.entries()) {
      if (!filterValue) continue;
      
      const cellValue = rowData[columnId];
      if (!cellValue || !String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase())) {
        return false;
      }
    }
    
    // Apply search term across all columns
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matches = Object.values(rowData).some(value => 
        value && String(value).toLowerCase().includes(searchLower)
      );
      if (!matches) return false;
    }
    
    return true;
  });
}

function sortData(data: TableRow[], sorting: SortConfig): TableRow[] {
  if (!sorting.column || data.length === 0) return data;
  
  return [...data].sort((a, b) => {
    // Handle rows where data might be directly on the row, not nested
    const aData = a.data || a;
    const bData = b.data || b;
    
    const aValue = aData[sorting.column!];
    const bValue = bData[sorting.column!];
    
    // Handle null/undefined values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;
    
    // Compare values based on type
    let comparison = 0;
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else if (aValue instanceof Date && bValue instanceof Date) {
      comparison = aValue.getTime() - bValue.getTime();
    } else {
      comparison = String(aValue).localeCompare(String(bValue));
    }
    
    return sorting.direction === 'asc' ? comparison : -comparison;
  });
}

// Efficient cell range calculation using generator to avoid creating large arrays
function* generateCellRange(
  startCell: string, 
  endCell: string, 
  data: TableRow[], 
  columns: Column[]
): Generator<string, void, unknown> {
  const [startRowId, startColId] = startCell.split(':');
  const [endRowId, endColId] = endCell.split(':');
  
  // CRITICAL FIX: The data array passed in is already sorted, so findIndex gives us
  // the correct visual/sorted indices, not the original unsorted indices
  const startRowIndex = data.findIndex(row => row.id === startRowId);
  const endRowIndex = data.findIndex(row => row.id === endRowId);
  const startColIndex = columns.findIndex(col => col.id === startColId);
  const endColIndex = columns.findIndex(col => col.id === endColId);
  
  if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) {
    log.warn(`[generateCellRange] Invalid indices - no cells generated`, {
      startRowIndex, endRowIndex, startColIndex, endColIndex,
      startCell: startCell.substring(0, 30) + '...',
      endCell: endCell.substring(0, 30) + '...'
    });
    return;
  }
  
  const minRowIndex = Math.min(startRowIndex, endRowIndex);
  const maxRowIndex = Math.max(startRowIndex, endRowIndex);
  const minColIndex = Math.min(startColIndex, endColIndex);
  const maxColIndex = Math.max(startColIndex, endColIndex);
  
  for (let rowIndex = minRowIndex; rowIndex <= maxRowIndex; rowIndex++) {
    for (let colIndex = minColIndex; colIndex <= maxColIndex; colIndex++) {
      const rowId = data[rowIndex].id;
      const columnId = columns[colIndex].id;
      yield `${rowId}:${columnId}`;
    }
  }
}

// Fixed function that properly handles sorted data by using array indices correctly
function calculateCellRange(
  startCell: string, 
  endCell: string, 
  data: TableRow[], 
  columns: Column[]
): string[] {
  const [startRowId, startColId] = startCell.split(':');
  const [endRowId, endColId] = endCell.split(':');
  
  // Find indices in the sorted data array - this should give us correct visual positions
  const startRowIndex = data.findIndex(row => row.id === startRowId);
  const endRowIndex = data.findIndex(row => row.id === endRowId);
  const startColIndex = columns.findIndex(col => col.id === startColId);
  const endColIndex = columns.findIndex(col => col.id === endColId);
  
  // DEBUGGING: Log actual row IDs at calculated positions to verify mapping
  const debugStartRow = data[startRowIndex];
  const debugEndRow = data[endRowIndex];
  
  log.info(`[calculateCellRange] DEBUG: Index mapping validation`, {
    startCell: startCell.substring(0, 40) + '...',
    endCell: endCell.substring(0, 40) + '...',
    startRowId: startRowId.substring(0, 20) + '...',
    endRowId: endRowId.substring(0, 20) + '...',
    startRowIndex,
    endRowIndex,
    actualStartRowId: debugStartRow?.id.substring(0, 20) + '...',
    actualEndRowId: debugEndRow?.id.substring(0, 20) + '...',
    startRowMatch: debugStartRow?.id === startRowId,
    endRowMatch: debugEndRow?.id === endRowId,
    dataLength: data.length,
    firstFewRowIds: data.slice(0, 3).map(r => r.id.substring(0, 15) + '...'),
    sortingInfo: data[0]?.metadata || 'no metadata'
  });

  // CRITICAL DEBUG: Check what happens when we search for the exact row IDs
  log.info(`[calculateCellRange] CRITICAL DEBUGGING: Searching for row IDs manually`, {
    startRowFound: data.some(row => row.id === startRowId),
    endRowFound: data.some(row => row.id === endRowId),
    startRowSampleMatch: data.find(row => row.id === startRowId)?.name || 'NOT FOUND',
    endRowSampleMatch: data.find(row => row.id === endRowId)?.name || 'NOT FOUND',
    dataFirstRowId: data[0]?.id.substring(0, 30) + '...',
    dataSecondRowId: data[1]?.id.substring(0, 30) + '...',
    lookingForStartId: startRowId.substring(0, 30) + '...',
    lookingForEndId: endRowId.substring(0, 30) + '...',
    startRowIdExact: startRowId,
    endRowIdExact: endRowId
  });
  
  if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) {
    log.warn(`[calculateCellRange] Invalid indices found - returning empty selection`, {
      startRowIndex, endRowIndex, startColIndex, endColIndex,
      startCell, endCell, 
      dataLength: data.length,
      startRowFound: data.some(row => row.id === startRowId),
      endRowFound: data.some(row => row.id === endRowId),
      startRowIdSample: startRowId.substring(0, 20) + '...',
      endRowIdSample: endRowId.substring(0, 20) + '...'
    });
    return [];
  }
  
  const minRowIndex = Math.min(startRowIndex, endRowIndex);
  const maxRowIndex = Math.max(startRowIndex, endRowIndex);
  const minColIndex = Math.min(startColIndex, endColIndex);
  const maxColIndex = Math.max(startColIndex, endColIndex);
  
  const rowCount = maxRowIndex - minRowIndex + 1;
  const colCount = maxColIndex - minColIndex + 1;
  const totalCells = rowCount * colCount;
  
  // Enhanced debug logging with validation checks
  log.info(`[calculateCellRange] Selection calculation`, {
    startCell: startCell.substring(0, 30) + '...',
    endCell: endCell.substring(0, 30) + '...',
    startRowIndex,
    endRowIndex, 
    startColIndex,
    endColIndex,
    minRowIndex,
    maxRowIndex,
    minColIndex,
    maxColIndex,
    rowCount,
    colCount,
    totalCells,
    dataLength: data.length,
    columnsLength: columns.length,
    // EXTREME DEBUG: Show exactly what's happening with index calculation
    indexDifference: Math.abs(startRowIndex - endRowIndex),
    shouldOnlyBe1OrSmall: 'EXPECTED: 1 for adjacent rows',
    actualRowNames: {
      startRowName: data[startRowIndex]?.name || 'NOT FOUND',
      endRowName: data[endRowIndex]?.name || 'NOT FOUND'
    }
  });
  
  // Warn about large selections but don't spam with huge selections
  if (totalCells > 100) {
    log.warn(`[calculateCellRange] Large selection detected - ${totalCells} cells`);
  }
  
  // Limit array generation for performance - if selection is too large, use Set approach
  if (totalCells > 1000) {
    // Generate cells incrementally using Set to avoid huge arrays
    const range = new Set<string>();
    for (const cellKey of generateCellRange(startCell, endCell, data, columns)) {
      range.add(cellKey);
    }
    return Array.from(range);
  }
  
  // For smaller selections, use the traditional array approach
  const range: string[] = [];
  for (let rowIndex = minRowIndex; rowIndex <= maxRowIndex; rowIndex++) {
    for (let colIndex = minColIndex; colIndex <= maxColIndex; colIndex++) {
      const rowId = data[rowIndex].id;
      const columnId = columns[colIndex].id;
      range.push(`${rowId}:${columnId}`);
    }
  }
  
  return range;
}

// ====================================
// SERIES PATTERN DETECTION
// ====================================

interface SeriesPattern {
  type: 'number' | 'date' | 'day' | 'month' | 'text';
  samples: any[];
  increment?: number;
  startValue?: any;
  dateUnit?: 'day' | 'month' | 'year';
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function detectSeriesPatterns(sourceRange: Set<string>, data: TableRow[], columns: Column[]): Map<string, SeriesPattern> {
  const patterns = new Map<string, SeriesPattern>();
  
  // Group source cells by column
  const columnCells = new Map<string, string[]>();
  sourceRange.forEach(cellId => {
    const [rowId, columnId] = cellId.split(':');
    if (!columnCells.has(columnId)) {
      columnCells.set(columnId, []);
    }
    columnCells.get(columnId)!.push(cellId);
  });
  
  // Analyze each column for patterns
  columnCells.forEach((cellIds, columnId) => {
    const values = cellIds.map(cellId => {
      const [rowId] = cellId.split(':');
      const row = data.find(r => r.id === rowId);
      return row?.data[columnId];
    }).filter(v => v != null);
    
    if (values.length === 0) return;
    
    const pattern = detectPattern(values);
    if (pattern) {
      patterns.set(columnId, pattern);
    }
  });
  
  return patterns;
}

function detectPattern(values: any[]): SeriesPattern | null {
  if (values.length === 0) return null;
  
  // Sort values by their order (assuming they're in sequence)
  const samples = [...values];
  
  // 1. Try number sequence
  const numberPattern = detectNumberPattern(samples);
  if (numberPattern) return numberPattern;
  
  // 2. Try date sequence
  const datePattern = detectDatePattern(samples);
  if (datePattern) return datePattern;
  
  // 3. Try day name sequence
  const dayPattern = detectDayPattern(samples);
  if (dayPattern) return dayPattern;
  
  // 4. Try month name sequence
  const monthPattern = detectMonthPattern(samples);
  if (monthPattern) return monthPattern;
  
  // 5. Try text with numeric suffix (Task1, Task2, etc.)
  const textPattern = detectTextPattern(samples);
  if (textPattern) return textPattern;
  
  return null;
}

function detectNumberPattern(values: any[]): SeriesPattern | null {
  const numbers = values.map(v => {
    const num = Number(v);
    return isNaN(num) ? null : num;
  }).filter(n => n !== null) as number[];
  
  if (numbers.length < 2 || numbers.length !== values.length) return null;
  
  // Check for arithmetic progression
  const diffs = [];
  for (let i = 1; i < numbers.length; i++) {
    diffs.push(numbers[i] - numbers[i - 1]);
  }
  
  // All differences should be the same (or close for floating point)
  const firstDiff = diffs[0];
  const isConsistent = diffs.every(diff => Math.abs(diff - firstDiff) < 0.0001);
  
  if (isConsistent) {
    return {
      type: 'number',
      samples: numbers,
      increment: firstDiff,
      startValue: numbers[numbers.length - 1]
    };
  }
  
  return null;
}

function detectDatePattern(values: any[]): SeriesPattern | null {
  const dates = values.map(v => {
    const date = new Date(v);
    return isNaN(date.getTime()) ? null : date;
  }).filter(d => d !== null) as Date[];
  
  if (dates.length < 2 || dates.length !== values.length) return null;
  
  // Check for consistent time intervals
  const intervals = [];
  for (let i = 1; i < dates.length; i++) {
    intervals.push(dates[i].getTime() - dates[i - 1].getTime());
  }
  
  const firstInterval = intervals[0];
  const isConsistent = intervals.every(interval => interval === firstInterval);
  
  if (isConsistent) {
    const dayMs = 24 * 60 * 60 * 1000;
    let dateUnit: 'day' | 'month' | 'year' = 'day';
    
    if (firstInterval === dayMs) {
      dateUnit = 'day';
    } else if (firstInterval >= 28 * dayMs && firstInterval <= 31 * dayMs) {
      dateUnit = 'month';
    } else if (firstInterval >= 365 * dayMs && firstInterval <= 366 * dayMs) {
      dateUnit = 'year';
    }
    
    return {
      type: 'date',
      samples: dates,
      dateUnit,
      startValue: dates[dates.length - 1]
    };
  }
  
  return null;
}

function detectDayPattern(values: any[]): SeriesPattern | null {
  const dayIndices = values.map(v => {
    const str = String(v);
    let index = DAY_NAMES.indexOf(str);
    if (index === -1) index = DAY_NAMES_SHORT.indexOf(str);
    return index === -1 ? null : index;
  }).filter(i => i !== null) as number[];
  
  if (dayIndices.length < 2 || dayIndices.length !== values.length) return null;
  
  // Check for consecutive days (with wrapping)
  let isConsecutive = true;
  for (let i = 1; i < dayIndices.length; i++) {
    const expected = (dayIndices[i - 1] + 1) % 7;
    if (dayIndices[i] !== expected) {
      isConsecutive = false;
      break;
    }
  }
  
  if (isConsecutive) {
    return {
      type: 'day',
      samples: values,
      startValue: dayIndices[dayIndices.length - 1]
    };
  }
  
  return null;
}

function detectMonthPattern(values: any[]): SeriesPattern | null {
  const monthIndices = values.map(v => {
    const str = String(v);
    let index = MONTH_NAMES.indexOf(str);
    if (index === -1) index = MONTH_NAMES_SHORT.indexOf(str);
    return index === -1 ? null : index;
  }).filter(i => i !== null) as number[];
  
  if (monthIndices.length < 2 || monthIndices.length !== values.length) return null;
  
  // Check for consecutive months (with wrapping)
  let isConsecutive = true;
  for (let i = 1; i < monthIndices.length; i++) {
    const expected = (monthIndices[i - 1] + 1) % 12;
    if (monthIndices[i] !== expected) {
      isConsecutive = false;
      break;
    }
  }
  
  if (isConsecutive) {
    return {
      type: 'month',
      samples: values,
      startValue: monthIndices[monthIndices.length - 1]
    };
  }
  
  return null;
}

function detectTextPattern(values: any[]): SeriesPattern | null {
  const strings = values.map(v => String(v));
  
  if (strings.length < 2) return null;
  
  // Look for pattern like "Text1", "Text2", "Text3"
  const pattern = /^(.*?)(\d+)$/;
  const matches = strings.map(s => s.match(pattern));
  
  if (matches.every(m => m !== null)) {
    const prefixes = matches.map(m => m![1]);
    const numbers = matches.map(m => parseInt(m![2]));
    
    // Check if all prefixes are the same and numbers are consecutive
    const firstPrefix = prefixes[0];
    const samePrefix = prefixes.every(p => p === firstPrefix);
    
    if (samePrefix) {
      const numberPattern = detectNumberPattern(numbers);
      if (numberPattern) {
        return {
          type: 'text',
          samples: strings,
          increment: numberPattern.increment,
          startValue: { prefix: firstPrefix, number: numbers[numbers.length - 1] }
        };
      }
    }
  }
  
  return null;
}

function generateSeriesValue(pattern: SeriesPattern, index: number): any {
  switch (pattern.type) {
    case 'number':
      return pattern.startValue + (pattern.increment! * (index + 1));
      
    case 'date':
      const date = new Date(pattern.startValue);
      if (pattern.dateUnit === 'day') {
        date.setDate(date.getDate() + (index + 1));
      } else if (pattern.dateUnit === 'month') {
        date.setMonth(date.getMonth() + (index + 1));
      } else if (pattern.dateUnit === 'year') {
        date.setFullYear(date.getFullYear() + (index + 1));
      }
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
      
    case 'day':
      const nextDayIndex = (pattern.startValue + index + 1) % 7;
      const isShort = DAY_NAMES_SHORT.includes(pattern.samples[0]);
      return isShort ? DAY_NAMES_SHORT[nextDayIndex] : DAY_NAMES[nextDayIndex];
      
    case 'month':
      const nextMonthIndex = (pattern.startValue + index + 1) % 12;
      const isMonthShort = MONTH_NAMES_SHORT.includes(pattern.samples[0]);
      return isMonthShort ? MONTH_NAMES_SHORT[nextMonthIndex] : MONTH_NAMES[nextMonthIndex];
      
    case 'text':
      const { prefix, number } = pattern.startValue;
      const nextNumber = number + (pattern.increment! * (index + 1));
      return `${prefix}${nextNumber}`;
      
    default:
      return pattern.samples[0]; // Fallback to first value
  }
}

export function createTableState(config: TableConfig) {
  const tableState$ = observable({
    // ====================================
    // SINGLE PIPELINE ARCHITECTURE
    // ====================================
    // Following Legend State best practices - single computed that processes all data transformations
    
    // Raw data layer
    data: [] as TableRow[],
    
    // DATA PIPELINE - Viewport-independent data processing
    dataProcessing: () => {
      const rawData = tableState$.data.get();
      const filters = tableState$.filters.get();
      const searchTerm = tableState$.searchTerm.get();
      const sorting = tableState$.sorting.get();
      const columns = tableState$.columns.get();
      
      log.info('🔍 [dataProcessing] VIEWPORT-INDEPENDENT COMPUTATION START:', {
        rawDataLength: rawData.length,
        hasFilters: filters.size > 0,
        hasSearchTerm: !!searchTerm,
        sortingState: sorting,
        columnsLength: columns?.length || 0,
        computationTimestamp: Date.now()
      });
      
      // Step 1: Filter data
      const filteredData = filterData(rawData, filters, searchTerm);
      
      // Step 2: Sort data
      const sortedData = sortData(filteredData, sorting);
      
      return {
        filteredData,
        sortedData,
        columns,
        sorting
      };
    },
    
    // COORDINATE PIPELINE - Viewport-dependent coordinate mapping
    processedData: () => {
      const dataProcessing = tableState$.dataProcessing.get();
      const viewport = tableState$.viewport.get();
      
      log.info('🔍 [processedData] COORDINATE MAPPING COMPUTATION:', {
        sortedDataLength: dataProcessing.sortedData.length,
        viewportState: viewport,
        computationTimestamp: Date.now()
      });
      
      // Step 3: Calculate coordinate mapping
      const HEADER_HEIGHT = 40;
      const SELECTION_COLUMN_WIDTH = 48;
      
      // Compute row coordinates - ONLY visible rows for virtual scrolling
      const visibleRows = (dataProcessing.sortedData || [])
        .slice(viewport.start, viewport.end + 1)
        .map((row, visibleIndex) => {
          const absoluteIndex = viewport.start + visibleIndex;
          return {
            rowId: row?.id || `row-${absoluteIndex}`,
            index: absoluteIndex,
            offset: HEADER_HEIGHT + (visibleIndex * 40), // Position within visible viewport
            height: 40,
            isVisible: true
          };
        });
      
      const rows = visibleRows;
      
      // Compute column coordinates
      let offset = SELECTION_COLUMN_WIDTH;
      const columnCoords = (dataProcessing.columns || []).map(column => {
        const coord = {
          columnId: column?.id || 'unknown-column',
          offset,
          width: column?.width || 150
        };
        offset += coord.width;
        return coord;
      });
      
      const coordinateMapping = {
        rows: rows || [], // Ensure rows is always an array
        columns: columnCoords || [], // Ensure columns is always an array
        version: Date.now() // Add versioning for change detection
      };
      
      log.info('🔍 [processedData] COORDINATE MAPPING CREATED:', {
        filteredDataLength: dataProcessing.filteredData.length,
        sortedDataLength: dataProcessing.sortedData.length,
        allRowsLength: rows.length,
        visibleRowsCount: rows.filter(r => r.isVisible).length,
        coordinateMappingRowsLength: coordinateMapping.rows.length,
        coordinateMappingColumnsLength: coordinateMapping.columns.length,
        coordinateMappingExists: !!coordinateMapping,
        coordinateMappingRowsExists: !!coordinateMapping.rows,
        coordinateMappingColumnsExists: !!coordinateMapping.columns,
        viewportRange: `${viewport.start}-${viewport.end}`
      });
      
      // Return unified processed data - everything computed atomically
      const result = {
        // Core data arrays
        filteredData: dataProcessing.filteredData,
        sortedData: dataProcessing.sortedData,
        
        // Coordinate mapping
        coordinateMapping,
        
        // Render state (for renderer)
        renderState: {
          rows: dataProcessing.sortedData,
          columns: dataProcessing.columns,
          selectedCells: new Set(), // Empty - handled separately for performance
          selectedRows: new Set(),  // Empty - handled separately
          editingCell: null,        // Handled separately
          clipboardState: { cells: new Set(), data: null },
          groupedData: [],
          optimisticOperations: new Map(),
          version: Date.now(),
          sortBy: dataProcessing.sorting.column ? [dataProcessing.sorting] : [],
          coordinateMapping
        },
        
        // Viewport info
        viewport,
        
        // Performance metrics
        metrics: {
          totalRows: dataProcessing.sortedData.length,
          filteredRows: dataProcessing.filteredData.length,
          visibleRows: rows.filter(r => r.isVisible).length,
          computationTime: Date.now()
        }
      };
      
      log.info('🔍 [processedData] SINGLE PIPELINE RESULT:', {
        hasResult: !!result,
        hasRenderState: !!result.renderState,
        hasCoordinateMapping: !!result.coordinateMapping,
        coordinateMappingRowsLength: result.coordinateMapping?.rows?.length || 0,
        renderStateRowsLength: result.renderState?.rows?.length || 0,
        renderStateColumnsLength: result.renderState?.columns?.length || 0,
        resultKeys: Object.keys(result),
        renderStateKeys: Object.keys(result.renderState)
      });
      
      return result;
    },
    
    // Selection state (separate for performance)
    selectionState: () => {
      const selectedCells = tableState$.selection.selectedCells.get();
      const selectedRows = tableState$.selection.selectedRows.get();
      const editingCell = tableState$.selection.editingCell.get();
      const clipboardState = tableState$.clipboard.get();
      
      return {
        selectedCells,
        selectedRows,
        editingCell,
        clipboardState,
        version: Date.now()
      };
    },
    
    // Configuration
    columns: config.columns,
    viewport: {
      start: 0,
      end: Math.min(20, config.columns.length), // Initial viewport
      scrollTop: 0,
      scrollLeft: 0,
      height: 400,
      width: 800
    } as ViewportInfo,
    
    // Selection layer
    selection: {
      selectedCells: new Set<string>(),
      selectedRows: new Set<string>(),
      anchorCell: null as CellRef | null,
      editingCell: null as CellRef | null
    } as SelectionState,
    
    // Interaction layer
    sorting: {
      column: null as string | null,
      direction: 'asc' as 'asc' | 'desc'
    } as SortConfig,
    
    filters: new Map<string, any>(),
    searchTerm: '',
    
    // Clipboard layer
    clipboard: {
      copiedCells: new Set<string>(),
      isCut: false,
      isActive: false
    },
    
    // Settings
    settings: {
      enableSelectionColumn: config.enableSelectionColumn ?? true,
      enableVirtualScrolling: config.enableVirtualScrolling ?? true,
      enableSorting: config.enableSorting ?? true,
      enableFiltering: config.enableFiltering ?? true,
      persistState: config.persistState ?? true
    },
    
    // Actions as observable methods
    selectCell: (cellId: string, addToSelection = false) => {
      batch(() => {
        if (!addToSelection) {
          tableState$.selection.selectedCells.set(new Set());
        }
        const selected = new Set(tableState$.selection.selectedCells.get());
        selected.add(cellId);
        tableState$.selection.selectedCells.set(selected);
      });
    },
    
    selectRange: (startCell: string, endCell: string) => {
      batch(() => {
        // Use unified data pipeline for perfect consistency
        const processed = tableState$.processedData.get();
        const data = processed.sortedData;
        const columns = tableState$.columns.get();
        
        log.info(`[selectRange] UNIFIED PIPELINE: Cell range request`, {
          startCell: startCell.substring(0, 50) + '...',
          endCell: endCell.substring(0, 50) + '...',
          dataLength: data.length,
          firstFewRowIds: data.slice(0, 5).map(r => ({ id: r.id.substring(0, 20) + '...', name: r.name })),
          startCellRowId: startCell.split(':')[0].substring(0, 20) + '...',
          endCellRowId: endCell.split(':')[0].substring(0, 20) + '...',
          pipelineVersion: processed.metrics.computationTime
        });
        
        const range = calculateCellRange(startCell, endCell, data, columns);
        tableState$.selection.selectedCells.set(new Set(range));
      });
    },
    
    selectRow: (rowId: string, addToSelection = false) => {
      batch(() => {
        if (!addToSelection) {
          tableState$.selection.selectedRows.set(new Set());
        }
        const selected = new Set(tableState$.selection.selectedRows.get());
        selected.add(rowId);
        tableState$.selection.selectedRows.set(selected);
      });
    },
    
    selectAllRows: () => {
      // Use unified pipeline for consistency
      const processed = tableState$.processedData.get();
      const allRowIds = new Set(processed.sortedData.map(row => row.id));
      tableState$.selection.selectedRows.set(allRowIds);
    },
    
    clearSelection: () => {
      batch(() => {
        tableState$.selection.selectedCells.set(new Set());
        tableState$.selection.selectedRows.set(new Set());
        tableState$.selection.anchorCell.set(null);
      });
    },
    
    setViewport: (viewport: ViewportInfo) => {
      tableState$.viewport.assign(viewport);
    },
    
    sortByColumn: (columnId: string) => {
      const currentSort = tableState$.sorting.get();
      tableState$.sorting.assign({
        column: columnId,
        direction: currentSort.column === columnId && currentSort.direction === 'asc' ? 'desc' : 'asc'
      });
    },
    
    setFilter: (columnId: string, value: any) => {
      const filters = new Map(tableState$.filters.get());
      if (value) {
        filters.set(columnId, value);
      } else {
        filters.delete(columnId);
      }
      tableState$.filters.set(filters);
    },
    
    setSearchTerm: (term: string) => {
      tableState$.searchTerm.set(term);
    },
    
    startEdit: (rowId: string, columnId: string) => {
      tableState$.selection.editingCell.set({ rowId, columnId });
    },
    
    commitEdit: (value: any) => {
      const editingCell = tableState$.selection.editingCell.get();
      if (!editingCell) return;
      
      batch(() => {
        // Update raw data - pipeline will automatically recompute
        const data = [...tableState$.data.get()];
        const rowIndex = data.findIndex(row => row.id === editingCell.rowId);
        if (rowIndex !== -1) {
          data[rowIndex] = {
            ...data[rowIndex],
            data: {
              ...data[rowIndex].data,
              [editingCell.columnId]: value
            }
          };
          tableState$.data.set(data); // Single pipeline will handle all downstream updates
        }
        
        // Clear editing state
        tableState$.selection.editingCell.set(null);
      });
    },
    
    cancelEdit: () => {
      tableState$.selection.editingCell.set(null);
    },
    
    // Fill operations for Excel-like functionality
    fillDown: (sourceRange: Set<string>, fillRange: Set<string>) => {
      batch(() => {
        // Update raw data - single pipeline will handle all recomputations
        const data = [...tableState$.data.get()];
        
        // Get source values (use first row as template)
        const sourceValues: Record<string, any> = {};
        const sourceArray = Array.from(sourceRange);
        if (sourceArray.length === 0) return;
        
        // Parse first source cell to get the template
        const [sourceRowId, sourceColId] = sourceArray[0].split(':');
        const sourceRow = data.find(row => row.id === sourceRowId);
        if (!sourceRow) return;
        
        // For each column in source range, get the template value
        const sourceColumns = new Set<string>();
        sourceRange.forEach(cellId => {
          const [, colId] = cellId.split(':');
          sourceColumns.add(colId);
        });
        
        sourceColumns.forEach(colId => {
          sourceValues[colId] = sourceRow.data[colId];
        });
        
        // Apply values to fill range
        fillRange.forEach(cellId => {
          const [rowId, colId] = cellId.split(':');
          const rowIndex = data.findIndex(row => row.id === rowId);
          if (rowIndex !== -1 && sourceValues[colId] !== undefined) {
            data[rowIndex] = {
              ...data[rowIndex],
              data: {
                ...data[rowIndex].data,
                [colId]: sourceValues[colId]
              }
            };
          }
        });
        
        // Single update - pipeline handles all downstream effects
        tableState$.data.set(data);
      });
    },
    
    fillSeries: (sourceRange: Set<string>, fillRange: Set<string>) => {
      batch(() => {
        // Use raw data for pattern detection, single pipeline will handle updates
        const data = [...tableState$.data.get()];
        
        log.info('[TableState] fillSeries: Analyzing series patterns', {
          sourceRange: Array.from(sourceRange),
          fillRange: Array.from(fillRange)
        });
        
        // Detect patterns from source range
        const patterns = detectSeriesPatterns(sourceRange, data, tableState$.columns.get());
        
        if (patterns.size === 0) {
          // No patterns detected, fall back to fillDown
          log.info('[TableState] fillSeries: No patterns detected, falling back to fillDown');
          tableState$.fillDown(sourceRange, fillRange);
          return;
        }
        
        // Apply detected patterns to fill range
        fillRange.forEach((cellId, index) => {
          const [rowId, colId] = cellId.split(':');
          const rowIndex = data.findIndex(row => row.id === rowId);
          
          if (rowIndex !== -1) {
            const pattern = patterns.get(colId);
            if (pattern) {
              const fillValue = generateSeriesValue(pattern, index);
              
              data[rowIndex] = {
                ...data[rowIndex],
                data: {
                  ...data[rowIndex].data,
                  [colId]: fillValue
                }
              };
              
              log.info('[TableState] fillSeries: Applied pattern', {
                cellId,
                pattern: pattern.type,
                originalValue: pattern.samples[0],
                fillValue
              });
            }
          }
        });
        
        // Single update triggers entire pipeline recomputation
        tableState$.data.set(data);
      });
    },
    
    // Clipboard operations
    copyCells: (cellIds?: Set<string>) => {
      const cellsToUse = cellIds || tableState$.selection.selectedCells.get();
      if (cellsToUse.size === 0) return;
      
      batch(() => {
        tableState$.clipboard.assign({
          copiedCells: new Set(cellsToUse),
          isCut: false,
          isActive: true
        });
        
        log.info('[TableState] Cells copied to clipboard', { count: cellsToUse.size });
      });
    },
    
    cutCells: (cellIds?: Set<string>) => {
      const cellsToUse = cellIds || tableState$.selection.selectedCells.get();
      if (cellsToUse.size === 0) return;
      
      batch(() => {
        tableState$.clipboard.assign({
          copiedCells: new Set(cellsToUse),
          isCut: true,
          isActive: true
        });
        
        log.info('[TableState] Cells cut to clipboard', { count: cellsToUse.size });
      });
    },
    
    clearClipboard: () => {
      batch(() => {
        tableState$.clipboard.assign({
          copiedCells: new Set(),
          isCut: false,
          isActive: false
        });
        
        log.info('[TableState] Clipboard cleared');
      });
    }
  });
  
  return tableState$;
}

export type TableState = ReturnType<typeof createTableState>;
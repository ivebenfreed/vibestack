# Phase 1: Core Features (Legend State Only)

## Overview

Implement essential spreadsheet features using only Legend State observables, computed values, and built-in capabilities. No additional libraries required.

## Features to Implement

### 1.1 Multi-Cell Selection System

**Current**: Basic row selection with Set
**Target**: Excel-style cell and range selection

```typescript
// Legend State selection observable
const tableSelection$ = observable({
  // Active cell being edited or focused
  activeCell: null as { row: number; col: number } | null,
  
  // Selected cell ranges
  ranges: [] as Array<{
    start: { row: number; col: number }
    end: { row: number; col: number }
    id: string
  }>,
  
  // Selection mode
  mode: 'cell' as 'cell' | 'row' | 'column' | 'range',
  
  // UI state
  isSelecting: false,
  lastClick: null as { row: number; col: number } | null
})

// Computed: Get all selected cells
const selectedCells$ = computed(() => {
  const ranges = tableSelection$.ranges.get()
  const cells = new Set<string>()
  
  ranges.forEach(range => {
    for (let row = range.start.row; row <= range.end.row; row++) {
      for (let col = range.start.col; col <= range.end.col; col++) {
        cells.add(`${row}:${col}`)
      }
    }
  })
  
  return cells
})

// Computed: Get selected row IDs
const selectedRowIds$ = computed(() => {
  const selectedCells = selectedCells$.get()
  const data = tableData$.get()
  const rowIds = new Set<string>()
  
  selectedCells.forEach(cellKey => {
    const [rowIndex] = cellKey.split(':')
    const row = data[parseInt(rowIndex)]
    if (row?.id) rowIds.add(row.id)
  })
  
  return rowIds
})
```

### 1.2 Copy/Paste System (Native Clipboard API)

**Current**: No copy/paste
**Target**: Excel-style copy/paste with format preservation

```typescript
// Legend State clipboard observable
const clipboard$ = observable({
  data: [] as Array<{
    row: number
    col: number  
    value: any
    field: string
    format?: any
  }>,
  operation: 'copy' as 'copy' | 'cut',
  source: null as string | null, // table ID
  timestamp: 0
})

// Copy selected cells
async function copySelectedCells() {
  const selectedCells = selectedCells$.get()
  const data = tableData$.get()
  const columns = tableColumns$.get()
  
  // Prepare data for clipboard
  const clipboardData = Array.from(selectedCells).map(cellKey => {
    const [rowIndex, colIndex] = cellKey.split(':').map(Number)
    const row = data[rowIndex]
    const column = columns[colIndex]
    
    return {
      row: rowIndex,
      col: colIndex,
      value: row[column.field],
      field: column.field,
      format: column.format
    }
  })
  
  // Update Legend State clipboard
  clipboard$.assign({
    data: clipboardData,
    operation: 'copy',
    source: 'ultra-table',
    timestamp: Date.now()
  })
  
  // Native clipboard API
  const textData = convertToCSV(clipboardData)
  const htmlData = convertToHTML(clipboardData)
  
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([textData], { type: 'text/plain' }),
      'text/html': new Blob([htmlData], { type: 'text/html' })
    })
  ])
}

// Paste with Legend State batch
async function pasteData(targetCell: { row: number; col: number }) {
  try {
    const clipboardItems = await navigator.clipboard.read()
    const textData = await clipboardItems[0].getType('text/plain').then(b => b.text())
    
    // Parse CSV data
    const pastedRows = parseCSV(textData)
    
    // Apply with batch for performance
    batch(() => {
      pastedRows.forEach((rowData, rowOffset) => {
        rowData.forEach((cellValue, colOffset) => {
          const targetRow = targetCell.row + rowOffset
          const targetCol = targetCell.col + colOffset
          const column = tableColumns$.get()[targetCol]
          
          if (column && tableData$[targetRow]) {
            tableData$[targetRow][column.field].set(cellValue)
          }
        })
      })
    })
  } catch (error) {
    console.error('Paste failed:', error)
  }
}
```

### 1.3 Undo/Redo System (Legend State trackHistory)

**Current**: No undo/redo
**Target**: Full edit history with Legend State built-in

```typescript
// Enable history tracking on table data
const tableData$ = observable(initialData)
const history$ = trackHistory(tableData$, {
  limit: 100, // Keep last 100 changes
  enabled: true
})

// Undo/redo actions
function undo() {
  history$.undo()
}

function redo() {
  history$.redo()
}

// Computed: Can undo/redo state
const canUndo$ = computed(() => history$.canUndo.get())
const canRedo$ = computed(() => history$.canRedo.get())

// Keyboard shortcuts (no library needed)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      if (e.shiftKey) {
        redo()
      } else {
        undo()
      }
    }
  }
  
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [])
```

### 1.4 Bulk Operations (Legend State batch)

**Current**: Basic bulk actions
**Target**: Excel-style bulk editing with Legend State performance

```typescript
// Bulk update with Legend State batch
function bulkUpdateSelectedCells(newValue: any) {
  const selectedCells = selectedCells$.get()
  const data = tableData$.get()
  const columns = tableColumns$.get()
  
  batch(() => {
    selectedCells.forEach(cellKey => {
      const [rowIndex, colIndex] = cellKey.split(':').map(Number)
      const column = columns[colIndex]
      
      if (tableData$[rowIndex] && column) {
        tableData$[rowIndex][column.field].set(newValue)
      }
    })
  })
}

// Bulk operations toolbar
function BulkActionsToolbar() {
  const selectedCount = selectedCells$.get().size
  const canUndo = canUndo$.use()
  const canRedo = canRedo$.use()
  
  if (selectedCount === 0) return null
  
  return (
    <div className="bulk-actions-toolbar">
      <span>{selectedCount} cells selected</span>
      
      <button onClick={() => copySelectedCells()}>
        Copy ({selectedCount})
      </button>
      
      <button onClick={() => deleteSelectedCells()}>
        Delete
      </button>
      
      <button onClick={undo} disabled={!canUndo}>
        Undo
      </button>
      
      <button onClick={redo} disabled={!canRedo}>
        Redo
      </button>
    </div>
  )
}
```

### 1.5 Filtering & Sorting (Legend State computed)

**Current**: Basic sorting
**Target**: Advanced filtering with computed observables

```typescript
// Filter state
const tableFilters$ = observable({
  global: '', // Search all columns
  columns: {} as Record<string, {
    value: string
    operator: 'equals' | 'contains' | 'startsWith' | 'gt' | 'lt'
    type: 'string' | 'number' | 'date' | 'boolean'
  }>
})

// Filtered data computed observable
const filteredData$ = computed(() => {
  const data = tableData$.get()
  const filters = tableFilters$.get()
  const globalFilter = filters.global.toLowerCase()
  
  return data.filter(row => {
    // Global filter
    if (globalFilter) {
      const matchesGlobal = Object.values(row)
        .some(value => String(value).toLowerCase().includes(globalFilter))
      if (!matchesGlobal) return false
    }
    
    // Column-specific filters
    return Object.entries(filters.columns).every(([field, filter]) => {
      const cellValue = row[field]
      return matchesFilter(cellValue, filter)
    })
  })
})

// Sorted data computed observable
const sortedData$ = computed(() => {
  const filtered = filteredData$.get()
  const sorting = tableSorting$.get()
  
  if (!sorting.field) return filtered
  
  return [...filtered].sort((a, b) => {
    const aVal = a[sorting.field]
    const bVal = b[sorting.field]
    const result = compareValues(aVal, bVal, sorting.type)
    return sorting.direction === 'desc' ? -result : result
  })
})
```

## Implementation Checklist

### Week 1
- [ ] Create selection observables with Legend State
- [ ] Implement cell range selection with mouse drag
- [ ] Add keyboard navigation (arrows, tab, enter)
- [ ] Create copy/paste system with native Clipboard API
- [ ] Test with 10k+ records for performance

### Week 2  
- [ ] Add undo/redo with trackHistory()
- [ ] Implement bulk operations with batch()
- [ ] Create filtering system with computed observables
- [ ] Enhanced sorting with multiple columns
- [ ] Performance optimization and testing

## Key Patterns

### Legend State Performance
```typescript
// Use batch() for multiple updates
batch(() => {
  data$[0].name.set('New Name')
  data$[0].status.set('Active')
  data$[1].priority.set('High')
})

// Use computed() for derived data
const summary$ = computed(() => {
  const data = tableData$.get()
  return {
    total: data.length,
    active: data.filter(r => r.status === 'active').length,
    completed: data.filter(r => r.status === 'completed').length
  }
})

// Use when() for side effects
when(tableSelection$.activeCell, (cell) => {
  if (cell) {
    // Focus management
    focusCell(cell.row, cell.col)
  }
})
```

### Reactive Components
```typescript
// Memo for granular updates
<Memo>
  {() => {
    const cellValue = row$[column.field].get()
    const isSelected = selectedCells$.get().has(`${rowIndex}:${colIndex}`)
    
    return (
      <td className={cn(isSelected && 'selected')}>
        {formatValue(cellValue, column.type)}
      </td>
    )
  }}
</Memo>
```

This phase establishes the foundation for all advanced features while maintaining the lightweight Legend State approach.
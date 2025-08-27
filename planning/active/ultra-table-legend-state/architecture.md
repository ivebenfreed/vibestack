# UltraTable Architecture (Legend State First)

## Overview

Component architecture designed around Legend State's reactive patterns, minimizing re-renders and maximizing performance through fine-grained reactivity and computed observables.

## Core Architecture Principles

### 1. Legend State as Single Source of Truth
- All table state lives in Legend State observables
- Components subscribe only to specific data slices
- Computed observables handle all derived data
- No local component state except for ephemeral UI

### 2. Performance-First Component Design
- Granular Memo components for individual cells
- React.memo for row-level optimizations
- Portal-based editors outside React tree
- Virtualization-friendly component structure

### 3. Separation of Concerns
- **State**: Pure Legend State observables
- **Logic**: Pure functions and computed observables  
- **UI**: Thin React components with minimal logic
- **Effects**: Isolated side effects with when() and useEffect

## Component Hierarchy

```
UltraTable (Container)
├── UltraTableProvider (Legend State context)
├── UltraTableToolbar (Actions, filters, grouping)
├── UltraTableFormulaBar (Formula editing)
├── UltraTableHeader (Column headers, sorting)
├── UltraTableBody (Main data grid)
│   ├── GroupingPanel (Collapsible group controls)
│   ├── VirtualizedRows (react-virtuoso)
│   │   ├── GroupHeader (Group summary rows)
│   │   └── DataRow (Individual data rows)
│   │       └── DataCell (Individual cells)
│   └── SelectionOverlay (Selection ranges)
├── UltraTableFooter (Aggregations, pagination)
├── UltraTableEditor (Portal-based cell editor)
├── UltraTableSelection (Floating selection toolbar)
└── ImportExportModals (File operations)
```

## State Architecture

### Core Observables Structure

```typescript
// Main table state container
export const ultraTableState$ = observable({
  // Table identity and metadata
  id: '',
  title: '',
  version: 0,
  lastModified: 0,
  
  // Data observables
  data: [] as any[], // Raw data rows
  columns: [] as ColumnDefinition[],
  
  // View state
  view: {
    mode: 'table' as 'table' | 'pivot' | 'chart',
    zoom: 1,
    frozenRows: 0,
    frozenColumns: 0,
    showLineNumbers: true,
    theme: 'default' as 'default' | 'excel' | 'notion'
  },
  
  // Operations state
  operations: {
    loading: false,
    saving: false,
    lastSave: 0,
    isDirty: false,
    pendingChanges: 0
  }
})

// Computed derived state
export const derivedTableState = {
  // Filtered and sorted data
  processedData$: computed(() => {
    const raw = ultraTableState$.data.get()
    const filters = tableFilters$.get()
    const sorting = tableSorting$.get()
    const grouping = tableGrouping$.get()
    
    let result = raw
    
    // Apply filters
    if (filters.global || Object.keys(filters.columns).length > 0) {
      result = applyFilters(result, filters)
    }
    
    // Apply sorting
    if (sorting.field) {
      result = applySorting(result, sorting)
    }
    
    // Apply grouping
    if (grouping.groups.length > 0) {
      result = applyGrouping(result, grouping)
    }
    
    return result
  }),
  
  // Table statistics
  stats$: computed(() => {
    const data = ultraTableState$.data.get()
    const processed = derivedTableState.processedData$.get()
    
    return {
      totalRows: data.length,
      visibleRows: processed.length,
      selectedRows: selectedCells$.get().size,
      filteredOut: data.length - processed.length
    }
  }),
  
  // Performance metrics
  performance$: computed(() => {
    const data = ultraTableState$.data.get()
    const formulas = Object.keys(tableFormulas$.formulas.get()).length
    const groups = tableGrouping$.groups.get().length
    
    return {
      dataSize: data.length,
      formulaCount: formulas,
      groupLevels: groups,
      estimatedMemory: estimateMemoryUsage(data, formulas, groups)
    }
  })
}
```

### State Organization Patterns

```typescript
// Feature-specific state modules
export const tableFeatures = {
  // Selection state (Phase 1 & 2)
  selection: tableSelection$,
  
  // Formula state (Phase 3)
  formulas: tableFormulas$,
  
  // Import/Export state (Phase 4)
  io: {
    clipboard: clipboard$,
    files: fileOperations$,
    api: apiIntegration$
  },
  
  // Grouping state (Phase 5)
  grouping: {
    config: tableGrouping$,
    data: groupedData$,
    aggregations: aggregationEngine$
  },
  
  // UI state
  ui: {
    editing: editingState$,
    dialogs: dialogState$,
    notifications: notificationState$
  }
}

// Computed state connections
export const tableComputed = {
  // Cross-cutting computed values
  selectedData$: computed(() => {
    const selected = selectedCells$.get()
    const data = derivedTableState.processedData$.get()
    
    return data.filter((_, index) => 
      Array.from(selected).some(cellKey => 
        cellKey.startsWith(`${index}:`)
      )
    )
  }),
  
  // Validation state
  validation$: computed(() => {
    const formulas = tableFormulas$.formulas.get()
    const data = ultraTableState$.data.get()
    
    return {
      formulaErrors: Object.values(formulas).filter(f => f.error).length,
      dataIntegrity: validateDataIntegrity(data),
      circularRefs: formulaDependencies$.circularRefs.get().length
    }
  })
}
```

## Component Patterns

### 1. Granular Memo Components

```typescript
// Cell-level optimization
const DataCell = React.memo(({ 
  rowIndex, 
  columnIndex, 
  field 
}: {
  rowIndex: number
  columnIndex: number  
  field: string
}) => {
  // Only subscribe to this specific cell's data
  const cellValue = ultraTableState$.data[rowIndex][field].use()
  const isSelected = selectedCells$.use().has(`${rowIndex}:${columnIndex}`)
  const formula = tableFormulas$.formulas[`${rowIndex}:${columnIndex}`].use()
  
  return (
    <Memo>
      {() => (
        <td 
          className={cn(
            'border-r border-border px-2 py-1 text-sm',
            isSelected && 'bg-primary/20 border-primary',
            formula?.error && 'bg-destructive/10 text-destructive'
          )}
          data-row={rowIndex}
          data-col={columnIndex}
          data-field={field}
          onClick={(e) => handleCellClick(rowIndex, columnIndex, e)}
          onDoubleClick={() => startCellEdit(rowIndex, columnIndex)}
        >
          {formula?.error ? '#ERROR' : formatCellValue(cellValue, field)}
        </td>
      )}
    </Memo>
  )
})

// Row-level optimization
const DataRow = React.memo(({ 
  row, 
  rowIndex, 
  style 
}: { 
  row: any
  rowIndex: number
  style?: React.CSSProperties 
}) => {
  const columns = tableColumns$.use()
  
  return (
    <tr style={style} className="border-b border-border hover:bg-muted/50">
      {columns.map((column, columnIndex) => (
        <DataCell
          key={column.field}
          rowIndex={rowIndex}
          columnIndex={columnIndex}
          field={column.field}
        />
      ))}
    </tr>
  )
})
```

### 2. Portal-Based Floating Components

```typescript
// Editor portal pattern
function UltraTableEditor(props: UltraTableEditorProps) {
  // Render outside React tree for performance
  return createPortal(
    <FloatingEditor {...props} />,
    document.body
  )
}

// Selection overlay portal
function UltraTableSelectionOverlay() {
  const ranges = tableSelection$.ranges.use()
  
  return createPortal(
    <div className="absolute inset-0 pointer-events-none z-10">
      {ranges.map(range => (
        <SelectionRange key={range.id} range={range} />
      ))}
    </div>,
    document.querySelector('[data-table-container]') || document.body
  )
}
```

### 3. Event Handling Architecture

```typescript
// Centralized event management
export class TableEventManager {
  private handlers = new Map<string, Function[]>()
  
  // Event registration
  on(event: string, handler: Function) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event)!.push(handler)
  }
  
  // Event emission with Legend State batch
  emit(event: string, data: any) {
    const handlers = this.handlers.get(event) || []
    
    if (handlers.length > 0) {
      batch(() => {
        handlers.forEach(handler => handler(data))
      })
    }
  }
  
  // Cleanup
  off(event: string, handler: Function) {
    const handlers = this.handlers.get(event) || []
    const index = handlers.indexOf(handler)
    if (index > -1) handlers.splice(index, 1)
  }
}

// Global event manager instance
export const tableEvents = new TableEventManager()

// Event-driven updates
tableEvents.on('cell:changed', ({ row, col, field, newValue, oldValue }) => {
  // Update data
  ultraTableState$.data[row][field].set(newValue)
  
  // Trigger formula recalculation
  recalculateFormulasForCell(row, col)
  
  // Update history
  addToHistory('cell:edit', { row, col, field, newValue, oldValue })
})

tableEvents.on('selection:changed', ({ ranges, activeCell }) => {
  batch(() => {
    tableSelection$.ranges.set(ranges)
    tableSelection$.activeCell.set(activeCell)
  })
})
```

## Integration Patterns

### 1. Legend State + React Virtuoso

```typescript
// Optimized virtualization with Legend State
function VirtualizedTableBody() {
  const data = derivedTableState.processedData$.use()
  const columns = tableColumns$.use()
  
  return (
    <Virtuoso
      data={data}
      totalCount={data.length}
      itemContent={(index, row) => (
        <DataRow
          key={row.id || index}
          row={row}
          rowIndex={index}
          columns={columns}
        />
      )}
      components={{
        Header: () => <TableHeader />,
        Footer: () => <TableFooter />
      }}
      // Performance optimizations
      overscan={200}
      increaseViewportBy={1000}
      fixedItemHeight={32} // If all rows same height
    />
  )
}
```

### 2. Legend State + Native APIs

```typescript
// Clipboard integration
function useClipboardIntegration() {
  // Native clipboard events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (document.activeElement?.closest('[data-table-container]')) {
        e.preventDefault()
        const activeCell = tableSelection$.activeCell.get()
        if (activeCell) {
          pasteWithFormatDetection(activeCell)
        }
      }
    }
    
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])
}

// File system integration
function useFileSystemIntegration() {
  // Drag and drop
  useEffect(() => {
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files || [])
      
      files.forEach(file => {
        if (file.type.includes('csv') || file.name.endsWith('.xlsx')) {
          processImportFile(file)
        }
      })
    }
    
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    
    document.addEventListener('drop', handleDrop)
    document.addEventListener('dragover', handleDragOver)
    
    return () => {
      document.removeEventListener('drop', handleDrop)
      document.removeEventListener('dragover', handleDragOver)
    }
  }, [])
}
```

## Performance Architecture

### 1. Render Optimization

```typescript
// Minimize re-renders with precise subscriptions
function OptimizedTable() {
  // Only subscribe to data length for virtualization
  const dataLength = computed(() => ultraTableState$.data.length).use()
  
  // Subscribe to view settings
  const viewSettings = ultraTableState$.view.use()
  
  // Don't subscribe to data content here - let individual cells handle it
  return (
    <div 
      className="ultra-table-container"
      data-table-container
      style={{ 
        fontSize: `${viewSettings.zoom * 100}%`,
        '--frozen-columns': viewSettings.frozenColumns 
      }}
    >
      <TableVirtualizer itemCount={dataLength} />
    </div>
  )
}

// Cell-level subscriptions only
function DataCellOptimized({ rowIndex, columnIndex, field }: CellProps) {
  // Precise subscription - only this cell's value
  const value = ultraTableState$.data[rowIndex]?.[field]?.use()
  
  // Selection state for this specific cell
  const isSelected = useMemo(() => 
    computed(() => selectedCells$.get().has(`${rowIndex}:${columnIndex}`))
  , [rowIndex, columnIndex]).use()
  
  // Formula state for this cell
  const formula = tableFormulas$.formulas[`${rowIndex}:${columnIndex}`].use()
  
  return (
    <td className={cn(isSelected && 'selected', formula?.error && 'error')}>
      {formula?.error ? '#ERROR' : value}
    </td>
  )
}
```

### 2. Memory Management

```typescript
// Memory-efficient patterns
export const memoryOptimizations = {
  // Lazy computed observables
  lazyGrouping$: computed(() => {
    // Only calculate when actually needed
    const groups = tableGrouping$.groups.get()
    return groups.length > 0 ? calculateGrouping() : null
  }, { lazy: true }),
  
  // Cleanup on unmount
  cleanup() {
    // Clear large caches
    formulaCache.clear()
    aggregationCache.clear()
    
    // Reset computeds
    lazyGrouping$.reset()
  },
  
  // Memory monitoring
  getMemoryUsage() {
    const data = ultraTableState$.data.get()
    const formulas = Object.keys(tableFormulas$.formulas.get()).length
    
    return {
      dataRows: data.length,
      formulaCount: formulas,
      cacheSize: formulaCache.size + aggregationCache.size,
      estimatedMB: (data.length * 0.001) + (formulas * 0.01)
    }
  }
}
```

## Error Boundaries & Recovery

```typescript
// Table-specific error boundary
export class UltraTableErrorBoundary extends React.Component {
  state = { hasError: false, error: null, errorInfo: null }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    
    // Log to Legend State for debugging
    tableErrors$.push({
      error: error.message,
      stack: error.stack,
      component: errorInfo.componentStack,
      timestamp: Date.now()
    })
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="table-error-fallback p-8 text-center">
          <h2 className="text-lg font-semibold text-destructive mb-4">
            Table Error
          </h2>
          <p className="text-muted-foreground mb-4">
            Something went wrong with the table. Your data is safe.
          </p>
          <Button onClick={() => this.setState({ hasError: false })}>
            Reload Table
          </Button>
        </div>
      )
    }
    
    return this.props.children
  }
}

// Legend State error tracking
const tableErrors$ = observable([])

// Error recovery patterns
function recoverFromError(errorType: string) {
  switch (errorType) {
    case 'formula_error':
      // Clear problematic formulas
      clearErrorFormulas()
      break
      
    case 'render_error':
      // Reset view state
      ultraTableState$.view.assign({
        mode: 'table',
        zoom: 1
      })
      break
      
    case 'data_corruption':
      // Reload from source
      reloadTableData()
      break
  }
}
```

## Plugin Architecture

```typescript
// Extensible plugin system
interface UltraTablePlugin {
  name: string
  version: string
  install: (table: typeof ultraTableState$) => void
  uninstall: () => void
  hooks?: {
    beforeCellEdit?: (cell: CellRef) => boolean
    afterCellEdit?: (cell: CellRef, oldValue: any, newValue: any) => void
    beforeExport?: (data: any[]) => any[]
    afterImport?: (data: any[]) => void
  }
}

// Plugin registry with Legend State
const plugins$ = observable({
  installed: new Map<string, UltraTablePlugin>(),
  enabled: new Set<string>(),
  hooks: {
    beforeCellEdit: [] as Function[],
    afterCellEdit: [] as Function[],
    beforeExport: [] as Function[],
    afterImport: [] as Function[]
  }
})

// Plugin installation
function installPlugin(plugin: UltraTablePlugin) {
  if (plugins$.installed.get().has(plugin.name)) {
    throw new Error(`Plugin ${plugin.name} already installed`)
  }
  
  batch(() => {
    // Install plugin
    plugins$.installed.get().set(plugin.name, plugin)
    plugins$.enabled.get().add(plugin.name)
    
    // Register hooks
    if (plugin.hooks) {
      Object.entries(plugin.hooks).forEach(([hookName, hookFn]) => {
        if (hookFn) {
          plugins$.hooks[hookName].push(hookFn)
        }
      })
    }
    
    // Run plugin installation
    plugin.install(ultraTableState$)
  })
}

// Hook execution
function executeHook(hookName: string, ...args: any[]) {
  const hooks = plugins$.hooks[hookName].get()
  
  return hooks.reduce((result, hook) => {
    try {
      return hook(result, ...args)
    } catch (error) {
      console.error(`Plugin hook ${hookName} failed:`, error)
      return result
    }
  }, args[0])
}
```

## Testing Architecture

```typescript
// Test utilities for Legend State
export const tableTestUtils = {
  // Create test table instance
  createTestTable(data: any[], columns: any[]) {
    const testTable$ = observable({
      data: data.map(row => observable(row)),
      columns: observable(columns)
    })
    
    return testTable$
  },
  
  // Simulate user interactions
  async simulateClick(rowIndex: number, columnIndex: number) {
    tableEvents.emit('cell:click', { rowIndex, columnIndex })
  },
  
  async simulateKeypress(key: string, modifiers: any = {}) {
    const event = new KeyboardEvent('keydown', { key, ...modifiers })
    document.dispatchEvent(event)
  },
  
  // Assert state changes
  waitForState(observable$: any, condition: (value: any) => boolean, timeout = 1000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), timeout)
      
      const unsubscribe = observable$.onChange(() => {
        if (condition(observable$.get())) {
          clearTimeout(timer)
          unsubscribe()
          resolve(observable$.get())
        }
      })
    })
  },
  
  // Performance measurement
  measureRenderTime(operation: () => void) {
    const start = performance.now()
    operation()
    return performance.now() - start
  }
}
```

## File Structure

```
src/components/tables/
├── UltraTable/
│   ├── index.tsx                    # Main container
│   ├── UltraTableProvider.tsx      # Legend State context
│   ├── UltraTableToolbar.tsx       # Top toolbar
│   ├── UltraTableHeader.tsx        # Column headers
│   ├── UltraTableBody.tsx          # Virtualized body
│   ├── UltraTableFooter.tsx        # Status/aggregations
│   ├── UltraTableEditor.tsx        # Portal editor
│   └── UltraTableSelection.tsx     # Selection overlay
├── cells/
│   ├── DataCell.tsx                # Individual cell component
│   ├── GroupCell.tsx               # Group header cell
│   └── AggregationCell.tsx         # Summary cell
├── overlays/
│   ├── SelectionOverlay.tsx        # Selection ranges
│   ├── FillHandle.tsx              # Fill operations
│   └── FormulaBar.tsx              # Formula editing
├── modals/
│   ├── ImportModal.tsx             # File import
│   ├── ExportModal.tsx             # File export
│   └── SettingsModal.tsx           # Table configuration
└── hooks/
    ├── useTableSelection.tsx       # Selection logic
    ├── useTableKeyboard.tsx        # Keyboard handling
    ├── useTableClipboard.tsx       # Clipboard operations
    └── useTablePerformance.tsx     # Performance monitoring

src/legend-state/
├── table/
│   ├── selection.ts                # Selection observables
│   ├── formulas.ts                 # Formula engine
│   ├── grouping.ts                 # Grouping state
│   ├── import-export.ts            # I/O operations
│   └── aggregations.ts             # Aggregation engine
└── patterns/
    ├── reactive-patterns.ts        # Common reactive patterns
    ├── performance-patterns.ts     # Performance optimizations
    └── testing-patterns.ts         # Test utilities
```

This architecture maximizes Legend State's capabilities while maintaining clean separation of concerns and optimal performance for large datasets and complex operations.
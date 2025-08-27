# Legend State Compatibility Fixes

## Critical Pattern Corrections

### 1. ❌ Incorrect: `computed()` as separate function
```typescript
// ❌ Wrong - computed is no longer separate
const selectedCells$ = computed(() => {
  const ranges = tableSelection$.ranges.get()
  // ...
})
```

### ✅ Correct: Functions within `observable()`
```typescript
// ✅ Correct - computed as function in observable
const tableSelection$ = observable({
  ranges: [],
  activeCell: null,
  
  // Computed as function
  selectedCells: () => {
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
  }
})

// Access computed value
const selected = tableSelection$.selectedCells.get() // Reactive
// OR
const selected = tableSelection$.selectedCells() // Direct call
```

### 2. ❌ Incorrect: Direct `.get()` in React components
```typescript
// ❌ Wrong - direct get() without use$
const Component = observer(() => {
  const value = tableData$[0].name.get() // Deprecated pattern
  return <div>{value}</div>
})
```

### ✅ Correct: `use$()` hook in React
```typescript
// ✅ Correct - use use$() for reactive values
const Component = observer(() => {
  const value = use$(tableData$[0].name)
  return <div>{value}</div>
})

// ✅ Or use Memo for fine-grained reactivity
const Component = () => {
  return (
    <div>
      <Memo>{tableData$[0].name}</Memo>
    </div>
  )
}
```

### 3. ❌ Incorrect: `trackHistory()` usage
```typescript
// ❌ Wrong - trackHistory returns history observable
const history$ = trackHistory(tableData$, {
  limit: 100,
  enabled: true
})
```

### ✅ Correct: `undoRedo()` for undo/redo functionality
```typescript
// ✅ Correct - use undoRedo for undo/redo
const { undo, redo, undos$, redos$ } = undoRedo(tableData$, { 
  limit: 100 
})

// Computed: Can undo/redo state
const canUndo$ = undos$ // This is already an observable
const canRedo$ = redos$ // This is already an observable

// React component
function UndoRedoButtons() {
  const canUndo = use$(undos$)
  const canRedo = use$(redos$)
  
  return (
    <div>
      <button onClick={undo} disabled={canUndo === 0}>
        Undo
      </button>
      <button onClick={redo} disabled={canRedo === 0}>
        Redo
      </button>
    </div>
  )
}
```

### 4. ❌ Incorrect: Observable array access
```typescript
// ❌ Wrong - direct array indexing without proper observable setup
ultraTableState$.data[rowIndex][field].set(value)
```

### ✅ Correct: Proper observable array handling
```typescript
// ✅ Correct - ensure data is properly observable
const ultraTableState$ = observable({
  data: [] as any[] // Will be filled with observable objects
})

// When adding data, make each row observable
function setTableData(rawData: any[]) {
  ultraTableState$.data.set(
    rawData.map(row => observable(row))
  )
}

// Then access is safe
ultraTableState$.data[rowIndex][field].set(value)
```

### 5. ❌ Incorrect: `when()` syntax
```typescript
// ❌ Wrong - old when syntax
when(tableSelection$.activeCell, (cell) => {
  if (cell) {
    focusCell(cell.row, cell.col)
  }
})
```

### ✅ Correct: New `when()` and `observe()` syntax
```typescript
// ✅ Correct - new when syntax with selector function
when(() => tableSelection$.activeCell.get(), (cell) => {
  if (cell) {
    focusCell(cell.row, cell.col)
  }
})

// ✅ Or use observe for general reactivity
observe(() => {
  const cell = tableSelection$.activeCell.get()
  if (cell) {
    focusCell(cell.row, cell.col)
  }
})
```

### 6. ❌ Incorrect: `onChange()` usage patterns
```typescript
// ❌ Wrong - onChange is for debugging mainly
tableData$.onChange(() => {
  markTableDirty()
})
```

### ✅ Correct: `observe()` for side effects
```typescript
// ✅ Correct - use observe for side effects
observe(() => {
  const data = tableData$.get()
  // This runs when data changes
  markTableDirty()
})

// ✅ Or with cleanup
const dispose = observe((e) => {
  const data = tableData$.get()
  
  // Setup side effect
  const cleanup = setupSideEffect(data)
  
  // Cleanup on next run
  e.onCleanup = cleanup
})
```

## Updated Core Patterns

### Corrected Table State Structure
```typescript
// ✅ Correct Legend State structure
const ultraTableState$ = observable({
  // Basic data
  data: [] as any[], // Will contain observable rows
  columns: [] as ColumnDefinition[],
  
  // View state
  view: {
    mode: 'table' as 'table' | 'pivot',
    zoom: 1,
    frozenRows: 0,
    frozenColumns: 0
  },
  
  // Computed values as functions
  stats: () => {
    const data = ultraTableState$.data.get()
    return {
      totalRows: data.length,
      hasData: data.length > 0
    }
  },
  
  // Actions as functions
  addRow: (rowData: any) => {
    ultraTableState$.data.push(observable(rowData))
  },
  
  updateCell: (row: number, field: string, value: any) => {
    ultraTableState$.data[row][field].set(value)
  }
})

// Selection state with computed functions
const tableSelection$ = observable({
  activeCell: null as { row: number; col: number } | null,
  ranges: [] as Array<{
    start: { row: number; col: number }
    end: { row: number; col: number }
    id: string
  }>,
  
  // Computed selection helpers
  selectedCells: () => {
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
  },
  
  selectedRowIds: () => {
    const selectedCells = tableSelection$.selectedCells.get()
    const data = ultraTableState$.data.get()
    const rowIds = new Set<string>()
    
    selectedCells.forEach(cellKey => {
      const [rowIndex] = cellKey.split(':')
      const row = data[parseInt(rowIndex)]
      if (row?.id) rowIds.add(row.id.get())
    })
    
    return rowIds
  }
})
```

### Corrected React Component Patterns
```typescript
// ✅ Correct React integration
const DataCell = observer(({ rowIndex, columnIndex, field }: CellProps) => {
  // Use use$() for reactive values
  const cellValue = use$(ultraTableState$.data[rowIndex][field])
  const isSelected = use$(() => 
    tableSelection$.selectedCells.get().has(`${rowIndex}:${columnIndex}`)
  )
  
  return (
    <td 
      className={cn(isSelected && 'bg-primary/20')}
      onClick={() => handleCellClick(rowIndex, columnIndex)}
    >
      {cellValue}
    </td>
  )
})

// ✅ Or use Memo for even finer control
const DataCellMemo = () => {
  return (
    <td onClick={() => handleCellClick(rowIndex, columnIndex)}>
      <Memo>
        {() => {
          const value = ultraTableState$.data[rowIndex][field].get()
          const isSelected = tableSelection$.selectedCells.get().has(`${rowIndex}:${columnIndex}`)
          
          return (
            <span className={cn(isSelected && 'bg-primary/20')}>
              {value}
            </span>
          )
        }}
      </Memo>
    </td>
  )
}
```

### Corrected Formula Engine
```typescript
// ✅ Correct formula structure in observable
const tableFormulas$ = observable({
  formulas: {} as Record<string, {
    expression: string
    compiledFn: Function | null
    dependencies: string[]
    error: string | null
  }>,
  
  // Computed results as function
  results: () => {
    const formulas = tableFormulas$.formulas.get()
    const results: Record<string, any> = {}
    
    Object.entries(formulas).forEach(([cellKey, formula]) => {
      if (formula.compiledFn && !formula.error) {
        try {
          results[cellKey] = formula.compiledFn()
        } catch (error) {
          results[cellKey] = `#ERROR: ${error.message}`
        }
      }
    })
    
    return results
  }
})

// Reactive recalculation
observe(() => {
  const data = ultraTableState$.data.get()
  const formulas = tableFormulas$.formulas.get()
  
  // Recalculate when data changes
  if (Object.keys(formulas).length > 0) {
    recalculateFormulas()
  }
})
```

### Corrected Persistence Pattern
```typescript
// ✅ Correct persistence with syncObservable
import { syncObservable } from '@legendapp/state/sync'

// Setup persistence after creating observable
syncObservable(ultraTableState$, {
  persist: {
    name: 'ultra-table-state',
    plugin: ObservablePersistIndexedDB // or your chosen plugin
  }
})

// ✅ Or with synced in constructor
const persistedTableState$ = observable(synced({
  initial: {
    data: [],
    columns: [],
    view: { mode: 'table', zoom: 1 }
  },
  persist: {
    name: 'ultra-table-state'
  }
}))
```

## Key Migration Points

1. **No separate `computed()`** - Use functions in `observable()`
2. **Use `use$()` in React** - Don't use direct `.get()` 
3. **Use `undoRedo()`** - Not `trackHistory()` for undo/redo
4. **Use `observe()`** - Not `onChange()` for side effects
5. **Use `when(() => obs.get())`** - Not `when(obs)`
6. **Make arrays observable** - Each row must be `observable(row)`
7. **Use `observer()` HOC** - For automatic tracking in components
8. **Use `Memo` component** - For finest-grained reactivity

## Performance Optimizations from Docs

```typescript
// ✅ Fine-grained with Memo
function TableCell({ rowIndex, field }) {
  return (
    <td>
      <Memo>
        {() => {
          const value = ultraTableState$.data[rowIndex][field].get()
          const isSelected = tableSelection$.selectedCells.get().has(`${rowIndex}:${field}`)
          
          return (
            <span className={cn(isSelected && 'selected')}>
              {value}
            </span>
          )
        }}
      </Memo>
    </td>
  )
}

// ✅ Batch for performance
function updateMultipleCells(updates: any[]) {
  batch(() => {
    updates.forEach(({ row, field, value }) => {
      ultraTableState$.data[row][field].set(value)
    })
  })
}

// ✅ Shallow tracking for arrays
observe(() => {
  // Only tracks when array items added/removed, not content changes
  const data = ultraTableState$.data.get(true) // true = shallow
  console.log(`${data.length} rows`)
})
```

The main issues were using deprecated patterns and incorrect API usage. Our approach is now fully compatible with Legend State v3!

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Review planning files against Legend State docs for compatibility issues", "status": "completed", "activeForm": "Reviewing planning files against Legend State docs for compatibility issues"}]
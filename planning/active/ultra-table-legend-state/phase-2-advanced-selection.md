# Phase 2: Advanced Selection (Legend State Only)

## Overview

Implement Excel-style selection behaviors including range selection, keyboard navigation, fill operations, and smart pattern detection - all using Legend State observables.

## Features to Implement

### 2.1 Range Selection with Mouse Drag

**Current**: Single cell/row selection
**Target**: Excel-style rectangular range selection

```typescript
// Enhanced selection state
const tableSelection$ = observable({
  // ... existing from Phase 1
  
  // Drag selection state
  dragStart: null as { row: number; col: number } | null,
  dragCurrent: null as { row: number; col: number } | null,
  isDragging: false,
  
  // Fill handle state
  fillHandle: {
    visible: false,
    position: null as { row: number; col: number } | null,
    isDragging: false,
    fillDirection: null as 'down' | 'right' | 'up' | 'left' | null
  }
})

// Computed: Current drag range
const dragRange$ = computed(() => {
  const start = tableSelection$.dragStart.get()
  const current = tableSelection$.dragCurrent.get()
  
  if (!start || !current) return null
  
  return {
    start: {
      row: Math.min(start.row, current.row),
      col: Math.min(start.col, current.col)
    },
    end: {
      row: Math.max(start.row, current.row),
      col: Math.max(start.col, current.col)
    }
  }
})

// Mouse handlers for range selection
function handleCellMouseDown(row: number, col: number, e: MouseEvent) {
  if (e.shiftKey) {
    // Extend selection from last click
    extendSelectionTo(row, col)
  } else if (e.ctrlKey || e.metaKey) {
    // Add to selection
    addCellToSelection(row, col)
  } else {
    // Start new selection
    batch(() => {
      tableSelection$.ranges.set([])
      tableSelection$.dragStart.set({ row, col })
      tableSelection$.dragCurrent.set({ row, col })
      tableSelection$.isDragging.set(true)
      tableSelection$.activeCell.set({ row, col })
    })
  }
}

function handleCellMouseMove(row: number, col: number) {
  if (tableSelection$.isDragging.get()) {
    tableSelection$.dragCurrent.set({ row, col })
  }
}

function handleMouseUp() {
  const isDragging = tableSelection$.isDragging.get()
  const dragRange = dragRange$.get()
  
  if (isDragging && dragRange) {
    // Commit selection range
    batch(() => {
      tableSelection$.ranges.push({
        start: dragRange.start,
        end: dragRange.end,
        id: `range-${Date.now()}`
      })
      tableSelection$.isDragging.set(false)
      tableSelection$.dragStart.set(null)
      tableSelection$.dragCurrent.set(null)
    })
  }
}
```

### 2.2 Keyboard Navigation

**Current**: Basic tab support
**Target**: Full Excel-style keyboard navigation

```typescript
// Keyboard navigation state
const navigation$ = observable({
  mode: 'navigate' as 'navigate' | 'edit',
  lastDirection: null as 'up' | 'down' | 'left' | 'right' | null
})

// Keyboard handler using Legend State
function useTableKeyboardNavigation() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeCell = tableSelection$.activeCell.get()
      const mode = navigation$.mode.get()
      
      // Don't handle if we're editing
      if (mode === 'edit') return
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          moveActiveCell('up', e.shiftKey)
          break
          
        case 'ArrowDown':
          e.preventDefault()
          moveActiveCell('down', e.shiftKey)
          break
          
        case 'ArrowLeft':
          e.preventDefault()
          moveActiveCell('left', e.shiftKey)
          break
          
        case 'ArrowRight':
          e.preventDefault()
          moveActiveCell('right', e.shiftKey)
          break
          
        case 'Tab':
          e.preventDefault()
          moveActiveCell(e.shiftKey ? 'left' : 'right', false)
          break
          
        case 'Enter':
          e.preventDefault()
          if (activeCell) {
            // Start editing current cell OR move down after edit
            if (navigation$.mode.get() === 'navigate') {
              startCellEdit(activeCell.row, activeCell.col)
            } else {
              moveActiveCell('down', false)
            }
          }
          break
          
        case 'Escape':
          // Cancel edit or clear selection
          if (mode === 'edit') {
            cancelCellEdit()
          } else {
            clearSelection()
          }
          break
          
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          deleteSelectedCells()
          break
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}

function moveActiveCell(direction: string, extend: boolean) {
  const current = tableSelection$.activeCell.get()
  if (!current) return
  
  const data = sortedData$.get()
  const columns = tableColumns$.get()
  
  let newRow = current.row
  let newCol = current.col
  
  switch (direction) {
    case 'up':
      newRow = Math.max(0, current.row - 1)
      break
    case 'down':
      newRow = Math.min(data.length - 1, current.row + 1)
      break
    case 'left':
      newCol = Math.max(0, current.col - 1)
      break
    case 'right':
      newCol = Math.min(columns.length - 1, current.col + 1)
      break
  }
  
  batch(() => {
    tableSelection$.activeCell.set({ row: newRow, col: newCol })
    navigation$.lastDirection.set(direction)
    
    if (extend) {
      // Extend selection to new position
      extendSelectionTo(newRow, newCol)
    } else {
      // Move selection to new position
      tableSelection$.ranges.set([{
        start: { row: newRow, col: newCol },
        end: { row: newRow, col: newCol },
        id: `single-${Date.now()}`
      }])
    }
  })
}
```

### 2.3 Fill Handle & Smart Fill

**Current**: No fill operations
**Target**: Excel-style drag-to-fill with pattern detection

```typescript
// Fill operations using Legend State
const fillOperations$ = observable({
  isActive: false,
  sourceRange: null as { start: { row: number; col: number }; end: { row: number; col: number } } | null,
  targetRange: null as { start: { row: number; col: number }; end: { row: number; col: number } } | null,
  pattern: null as 'linear' | 'date' | 'text' | 'copy' | null,
  preview: [] as any[]
})

// Pattern detection
function detectFillPattern(values: any[]): string {
  if (values.length < 2) return 'copy'
  
  // Check for numeric sequence
  const numbers = values.map(v => parseFloat(v)).filter(n => !isNaN(n))
  if (numbers.length === values.length && numbers.length >= 2) {
    const diff = numbers[1] - numbers[0]
    const isLinear = numbers.every((n, i) => 
      i === 0 || Math.abs((n - numbers[i-1]) - diff) < 0.001
    )
    if (isLinear) return 'linear'
  }
  
  // Check for date sequence
  const dates = values.map(v => new Date(v)).filter(d => !isNaN(d.getTime()))
  if (dates.length === values.length && dates.length >= 2) {
    return 'date'
  }
  
  // Default to copy
  return 'copy'
}

// Fill operation
function fillRange(sourceRange: any, targetRange: any) {
  const sourceData = extractRangeData(sourceRange)
  const pattern = detectFillPattern(sourceData.map(cell => cell.value))
  
  batch(() => {
    // Generate fill values based on pattern
    const fillValues = generateFillValues(sourceData, targetRange, pattern)
    
    // Apply to target cells
    fillValues.forEach(({ row, col, value, field }) => {
      if (tableData$[row]) {
        tableData$[row][field].set(value)
      }
    })
  })
}

// Fill handle UI component
function FillHandle() {
  const fillState = fillOperations$.use()
  const activeCell = tableSelection$.activeCell.use()
  
  if (!activeCell) return null
  
  return (
    <div 
      className="fill-handle"
      style={{
        position: 'absolute',
        // Position at bottom-right of active cell
      }}
      onMouseDown={(e) => startFillDrag(e, activeCell)}
    >
      <div className="fill-handle-dot" />
    </div>
  )
}
```

### 2.4 Enhanced Selection UI

**Current**: Basic selection styling
**Target**: Professional selection feedback

```typescript
// Selection overlay component
function SelectionOverlay() {
  const ranges = tableSelection$.ranges.use()
  const dragRange = dragRange$.use()
  
  return (
    <>
      {/* Committed selection ranges */}
      {ranges.map(range => (
        <SelectionRange 
          key={range.id}
          range={range}
          type="committed"
        />
      ))}
      
      {/* Active drag range */}
      {dragRange && (
        <SelectionRange 
          range={dragRange}
          type="dragging"
        />
      )}
    </>
  )
}

function SelectionRange({ range, type }: { 
  range: { start: any; end: any }; 
  type: 'committed' | 'dragging' 
}) {
  const startCell = getCellElement(range.start.row, range.start.col)
  const endCell = getCellElement(range.end.row, range.end.col)
  
  if (!startCell || !endCell) return null
  
  const startRect = startCell.getBoundingClientRect()
  const endRect = endCell.getBoundingClientRect()
  
  return (
    <div
      className={cn(
        'absolute pointer-events-none border-2',
        type === 'committed' ? 'border-blue-500 bg-blue-100/20' : 'border-blue-300 bg-blue-50/10'
      )}
      style={{
        top: startRect.top,
        left: startRect.left,
        width: endRect.right - startRect.left,
        height: endRect.bottom - startRect.top
      }}
    />
  )
}
```

## Implementation Priority

### High Priority (Week 2)
1. ✅ Range selection with drag
2. ✅ Keyboard navigation (arrows, tab, enter)
3. ✅ Shift+click to extend selection
4. ✅ Fill handle UI and basic fill

### Medium Priority (Week 3)
1. Smart pattern detection for fill
2. Multi-range selection (Ctrl+click)
3. Column/row selection
4. Selection persistence across operations

### Lower Priority (Week 4)
1. Advanced fill patterns (custom sequences)
2. Selection animation and polish
3. Touch gesture support for mobile
4. Accessibility improvements

## Testing Strategy

### Performance Tests
- 10k rows with range selection performance
- Fill operations on 1k+ cells
- Keyboard navigation speed
- Memory usage with large selections

### Functional Tests
- All selection modes work correctly
- Fill patterns detect properly
- Keyboard shortcuts respond < 50ms
- UI feedback is immediate

### Edge Cases
- Empty data handling
- Very large ranges (1000x1000)
- Mixed data types in fill
- Boundary conditions

This phase builds the foundation for all advanced spreadsheet interactions while maintaining our Legend State-first approach.
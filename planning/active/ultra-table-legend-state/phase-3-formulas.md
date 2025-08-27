# Phase 3: Formulas & Computed Values (Legend State Only)

## Overview

Implement Excel-style formula engine using Legend State's computed observables and reactivity. No external formula parser initially - build from first principles using JavaScript expressions and computed values.

## Features to Implement

### 3.1 Basic Formula Engine

**Current**: Static cell values
**Target**: Reactive formulas with cell references

```typescript
// Formula state management
const tableFormulas$ = observable({
  // Formula definitions by cell
  formulas: {} as Record<string, {
    cellKey: string // "row:col"
    expression: string // "=A1+B1" or "=SUM(A1:A10)"
    rawValue: any // Original input
    compiledFn: Function | null // Compiled JS function
    dependencies: string[] // Referenced cell keys
    error: string | null
  }>,
  
  // Calculation state
  isCalculating: false,
  lastCalculation: 0,
  cyclicErrors: [] as string[]
})

// Enhanced table data with formula support
const tableData$ = observable(initialData.map(row => ({
  ...row,
  // Add computed fields for formulas
  _computed: {} as Record<string, any>
})))

// Cell value resolver - checks for formulas first
const getCellValue$ = (row: number, col: number) => computed(() => {
  const cellKey = `${row}:${col}`
  const formula = tableFormulas$.formulas[cellKey].get()
  
  if (formula && !formula.error) {
    // Return computed formula result
    return formula.compiledFn?.() ?? ''
  }
  
  // Return raw data value
  const column = tableColumns$.get()[col]
  const rowData = tableData$.get()[row]
  return rowData?.[column.field] ?? ''
})

// Formula parser and compiler
function parseFormula(expression: string): {
  compiledFn: Function | null
  dependencies: string[]
  error: string | null
} {
  try {
    if (!expression.startsWith('=')) {
      return { compiledFn: null, dependencies: [], error: null }
    }
    
    const formula = expression.slice(1) // Remove '='
    const dependencies = extractCellReferences(formula)
    
    // Compile to JavaScript function
    const jsExpression = translateFormulaToJS(formula)
    const compiledFn = new Function('getCellValue', `return ${jsExpression}`)
    
    return { compiledFn, dependencies, error: null }
  } catch (error) {
    return { 
      compiledFn: null, 
      dependencies: [], 
      error: error.message 
    }
  }
}

// Cell reference extraction (A1, B2:C5, etc.)
function extractCellReferences(formula: string): string[] {
  const cellRefPattern = /([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?/g
  const references: string[] = []
  let match
  
  while ((match = cellRefPattern.exec(formula)) !== null) {
    const [, startCol, startRow, endCol, endRow] = match
    
    if (endCol && endRow) {
      // Range reference (A1:B5)
      const startColIndex = columnLetterToIndex(startCol)
      const endColIndex = columnLetterToIndex(endCol)
      const startRowIndex = parseInt(startRow) - 1
      const endRowIndex = parseInt(endRow) - 1
      
      for (let r = startRowIndex; r <= endRowIndex; r++) {
        for (let c = startColIndex; c <= endColIndex; c++) {
          references.push(`${r}:${c}`)
        }
      }
    } else {
      // Single cell reference (A1)
      const colIndex = columnLetterToIndex(startCol)
      const rowIndex = parseInt(startRow) - 1
      references.push(`${rowIndex}:${colIndex}`)
    }
  }
  
  return references
}

// Translate Excel formulas to JavaScript
function translateFormulaToJS(formula: string): string {
  return formula
    // Cell references: A1 -> getCellValue(0, 0)
    .replace(/([A-Z]+)(\d+)/g, (match, col, row) => {
      const colIndex = columnLetterToIndex(col)
      const rowIndex = parseInt(row) - 1
      return `getCellValue(${rowIndex}, ${colIndex})`
    })
    // Excel functions to JS
    .replace(/SUM\(([^)]+)\)/g, 'sum($1)')
    .replace(/AVERAGE\(([^)]+)\)/g, 'average($1)')
    .replace(/COUNT\(([^)]+)\)/g, 'count($1)')
    .replace(/MIN\(([^)]+)\)/g, 'min($1)')
    .replace(/MAX\(([^)]+)\)/g, 'max($1)')
}
```

### 3.2 Excel Function Library

**Current**: No functions
**Target**: Common Excel functions using JavaScript

```typescript
// Built-in formula functions
const formulaFunctions = {
  // Math functions
  sum: (...values: any[]) => {
    return values.flat().reduce((acc, val) => acc + (parseFloat(val) || 0), 0)
  },
  
  average: (...values: any[]) => {
    const nums = values.flat().map(v => parseFloat(v)).filter(n => !isNaN(n))
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
  },
  
  count: (...values: any[]) => {
    return values.flat().filter(v => v != null && v !== '').length
  },
  
  min: (...values: any[]) => {
    const nums = values.flat().map(v => parseFloat(v)).filter(n => !isNaN(n))
    return nums.length > 0 ? Math.min(...nums) : 0
  },
  
  max: (...values: any[]) => {
    const nums = values.flat().map(v => parseFloat(v)).filter(n => !isNaN(n))
    return nums.length > 0 ? Math.max(...nums) : 0
  },
  
  // Text functions
  concatenate: (...values: any[]) => {
    return values.flat().join('')
  },
  
  len: (text: string) => String(text || '').length,
  
  upper: (text: string) => String(text || '').toUpperCase(),
  
  lower: (text: string) => String(text || '').toLowerCase(),
  
  // Logical functions
  if: (condition: any, trueValue: any, falseValue: any) => {
    return condition ? trueValue : falseValue
  },
  
  and: (...conditions: any[]) => {
    return conditions.every(Boolean)
  },
  
  or: (...conditions: any[]) => {
    return conditions.some(Boolean)
  }
}

// Enhanced JavaScript execution context
function createFormulaContext(row: number, col: number) {
  return {
    // Cell value getter with Legend State reactivity
    getCellValue: (r: number, c: number) => {
      return getCellValue$(r, c).get()
    },
    
    // Range value getter  
    getRangeValues: (startRow: number, startCol: number, endRow: number, endCol: number) => {
      const values = []
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          values.push(getCellValue$(r, c).get())
        }
      }
      return values
    },
    
    // Built-in functions
    ...formulaFunctions
  }
}
```

### 3.3 Dependency Tracking & Circular Detection

**Current**: No formula dependencies
**Target**: Automatic recalculation with cycle prevention

```typescript
// Dependency graph with Legend State
const formulaDependencies$ = observable({
  // Cell dependency graph: cellKey -> dependent cells
  dependencies: {} as Record<string, Set<string>>,
  
  // Reverse mapping: cellKey -> cells this depends on
  dependents: {} as Record<string, Set<string>>,
  
  // Calculation order (topological sort)
  calculationOrder: [] as string[],
  
  // Circular references detected
  circularRefs: [] as string[]
})

// Update formula with dependency tracking
function setFormula(row: number, col: number, expression: string) {
  const cellKey = `${row}:${col}`
  const parsed = parseFormula(expression)
  
  batch(() => {
    // Clear old dependencies
    clearCellDependencies(cellKey)
    
    // Set new formula
    tableFormulas$.formulas[cellKey].set({
      cellKey,
      expression,
      rawValue: expression,
      compiledFn: parsed.compiledFn,
      dependencies: parsed.dependencies,
      error: parsed.error
    })
    
    // Update dependency graph
    if (parsed.dependencies.length > 0) {
      updateDependencyGraph(cellKey, parsed.dependencies)
    }
    
    // Recalculate affected cells
    recalculateFromCell(cellKey)
  })
}

// Topological sort for calculation order
function calculateDependencyOrder(): string[] {
  const dependencies = formulaDependencies$.dependencies.get()
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const order: string[] = []
  const cycles: string[] = []
  
  function visit(cellKey: string): boolean {
    if (visiting.has(cellKey)) {
      cycles.push(cellKey)
      return false // Cycle detected
    }
    
    if (visited.has(cellKey)) return true
    
    visiting.add(cellKey)
    
    const deps = dependencies[cellKey] || new Set()
    for (const dep of deps) {
      if (!visit(dep)) return false
    }
    
    visiting.delete(cellKey)
    visited.add(cellKey)
    order.push(cellKey)
    
    return true
  }
  
  // Visit all formula cells
  Object.keys(tableFormulas$.formulas.get()).forEach(visit)
  
  formulaDependencies$.assign({
    calculationOrder: order,
    circularRefs: cycles
  })
  
  return order
}

// Reactive recalculation when dependencies change
when(() => tableData$.get(), () => {
  // Data changed - recalculate all formulas
  recalculateAllFormulas()
})
```

### 3.4 Formula Bar & Cell Editor Integration

**Current**: Basic cell editing
**Target**: Excel-style formula bar with auto-complete

```typescript
// Formula bar component
function FormulaBar() {
  const activeCell = tableSelection$.activeCell.use()
  const formula = activeCell ? 
    tableFormulas$.formulas[`${activeCell.row}:${activeCell.col}`].use() : null
  
  const [editingFormula, setEditingFormula] = useState('')
  const [showAutoComplete, setShowAutoComplete] = useState(false)
  
  useEffect(() => {
    if (formula) {
      setEditingFormula(formula.expression || getCellDisplayValue(activeCell))
    } else if (activeCell) {
      setEditingFormula(getCellDisplayValue(activeCell))
    } else {
      setEditingFormula('')
    }
  }, [activeCell, formula])
  
  const handleFormulaSubmit = () => {
    if (!activeCell) return
    
    if (editingFormula.startsWith('=')) {
      // Set as formula
      setFormula(activeCell.row, activeCell.col, editingFormula)
    } else {
      // Set as regular value
      const column = tableColumns$.get()[activeCell.col]
      if (column) {
        tableData$[activeCell.row][column.field].set(editingFormula)
      }
    }
  }
  
  return (
    <div className="formula-bar flex items-center gap-2 p-2 border-b">
      {/* Cell reference indicator */}
      <div className="cell-ref font-mono text-sm bg-muted px-2 py-1 rounded min-w-16">
        {activeCell ? 
          `${indexToColumnLetter(activeCell.col)}${activeCell.row + 1}` : 
          ''
        }
      </div>
      
      {/* Formula input */}
      <div className="flex-1 relative">
        <Input
          value={editingFormula}
          onChange={(e) => setEditingFormula(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleFormulaSubmit()
            } else if (e.key === 'Escape') {
              setEditingFormula(formula?.expression || getCellDisplayValue(activeCell))
            }
          }}
          onFocus={() => setShowAutoComplete(true)}
          onBlur={() => setTimeout(() => setShowAutoComplete(false), 100)}
          placeholder="Enter value or formula (=A1+B1)"
          className="font-mono text-sm"
        />
        
        {/* Auto-complete suggestions */}
        {showAutoComplete && editingFormula.includes('=') && (
          <FormulaAutoComplete 
            formula={editingFormula}
            onSelect={(suggestion) => {
              setEditingFormula(suggestion)
              setShowAutoComplete(false)
            }}
          />
        )}
      </div>
      
      {/* Formula validation */}
      {formula?.error && (
        <div className="text-destructive text-xs px-2">
          Error: {formula.error}
        </div>
      )}
    </div>
  )
}

// Auto-complete for functions and cell references
function FormulaAutoComplete({ 
  formula, 
  onSelect 
}: { 
  formula: string
  onSelect: (suggestion: string) => void 
}) {
  const suggestions = useMemo(() => {
    const partial = formula.toLowerCase()
    const functions = Object.keys(formulaFunctions)
      .filter(fn => fn.toLowerCase().includes(partial))
      .map(fn => `${fn.toUpperCase()}()`)
    
    // Could add cell reference suggestions here
    return functions.slice(0, 10)
  }, [formula])
  
  if (suggestions.length === 0) return null
  
  return (
    <div className="absolute top-full left-0 right-0 bg-background border rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          className="px-3 py-1 hover:bg-muted cursor-pointer text-sm"
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </div>
      ))}
    </div>
  )
}
```

### 3.5 Real-Time Formula Calculation

**Current**: Static values
**Target**: Automatic recalculation with Legend State reactivity

```typescript
// Reactive calculation engine
const formulaCalculation$ = observable({
  queue: [] as string[], // Cells pending calculation
  isProcessing: false,
  batchSize: 100, // Calculate in batches for performance
  lastUpdate: 0
})

// Computed: All formula results
const formulaResults$ = computed(() => {
  const formulas = tableFormulas$.formulas.get()
  const results: Record<string, any> = {}
  
  // Calculate in dependency order
  const order = formulaDependencies$.calculationOrder.get()
  
  order.forEach(cellKey => {
    const formula = formulas[cellKey]
    if (formula?.compiledFn && !formula.error) {
      try {
        const context = createFormulaContext(cellKey)
        results[cellKey] = formula.compiledFn.call(context)
      } catch (error) {
        results[cellKey] = `#ERROR: ${error.message}`
      }
    }
  })
  
  return results
})

// Auto-recalculation when any cell changes
when(() => tableData$.get(), () => {
  // Debounce recalculation
  clearTimeout(recalcTimer)
  recalcTimer = setTimeout(recalculateAllFormulas, 50)
})

// Batch recalculation for performance
function recalculateAllFormulas() {
  const formulas = Object.keys(tableFormulas$.formulas.get())
  
  if (formulas.length === 0) return
  
  batch(() => {
    formulaCalculation$.isProcessing.set(true)
    
    // Process in dependency order
    const order = calculateDependencyOrder()
    
    order.forEach(cellKey => {
      const formula = tableFormulas$.formulas[cellKey].get()
      if (formula?.compiledFn) {
        try {
          const context = createFormulaContext(cellKey)
          const result = formula.compiledFn.call(context)
          
          // Update computed result
          const [row, col] = cellKey.split(':').map(Number)
          const column = tableColumns$.get()[col]
          if (column) {
            tableData$[row]._computed[column.field].set(result)
          }
        } catch (error) {
          // Handle calculation error
          tableFormulas$.formulas[cellKey].error.set(error.message)
        }
      }
    })
    
    formulaCalculation$.assign({
      isProcessing: false,
      lastUpdate: Date.now()
    })
  })
}
```

### 3.6 Advanced Formula Features

**Current**: Basic math
**Target**: Excel-level function library

```typescript
// Extended function library
const advancedFunctions = {
  // Date functions
  today: () => new Date(),
  now: () => new Date(),
  year: (date: Date) => date.getFullYear(),
  month: (date: Date) => date.getMonth() + 1,
  day: (date: Date) => date.getDate(),
  
  // Lookup functions
  vlookup: (searchValue: any, tableRange: any[][], colIndex: number, exactMatch = false) => {
    for (const row of tableRange) {
      if (exactMatch ? row[0] === searchValue : String(row[0]).includes(String(searchValue))) {
        return row[colIndex - 1] // Excel is 1-indexed
      }
    }
    return '#N/A'
  },
  
  // Conditional functions
  countif: (range: any[], criteria: any) => {
    return range.filter(val => String(val) === String(criteria)).length
  },
  
  sumif: (range: any[], criteria: any, sumRange?: any[]) => {
    const targetRange = sumRange || range
    return range.reduce((sum, val, index) => {
      return String(val) === String(criteria) ? 
        sum + (parseFloat(targetRange[index]) || 0) : sum
    }, 0)
  },
  
  // Array functions
  unique: (range: any[]) => [...new Set(range.flat())],
  
  sort: (range: any[], ascending = true) => {
    const sorted = [...range.flat()].sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') {
        return ascending ? a - b : b - a
      }
      return ascending ? 
        String(a).localeCompare(String(b)) : 
        String(b).localeCompare(String(a))
    })
    return sorted
  }
}

// Formula validation with Legend State
const formulaValidation$ = computed(() => {
  const formulas = tableFormulas$.formulas.get()
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  
  Object.entries(formulas).forEach(([cellKey, formula]) => {
    if (formula.error) {
      errors[cellKey] = formula.error
    }
    
    // Check for potential issues
    if (formula.dependencies.length > 50) {
      warnings[cellKey] = 'Formula references many cells - may impact performance'
    }
    
    // Check for circular references
    if (hasCircularReference(cellKey, formula.dependencies)) {
      errors[cellKey] = 'Circular reference detected'
    }
  })
  
  return { errors, warnings }
})

// Formula performance monitoring
const formulaPerformance$ = observable({
  calculationTimes: {} as Record<string, number>,
  slowFormulas: [] as string[], // Formulas taking >100ms
  totalCalculationTime: 0,
  averageCalculationTime: 0
})

// Performance-aware calculation
function calculateFormulaWithTiming(cellKey: string) {
  const startTime = performance.now()
  
  try {
    const result = calculateFormula(cellKey)
    const duration = performance.now() - startTime
    
    batch(() => {
      formulaPerformance$.calculationTimes[cellKey].set(duration)
      
      if (duration > 100) {
        formulaPerformance$.slowFormulas.set(prev => [...prev, cellKey])
      }
    })
    
    return result
  } catch (error) {
    throw error
  }
}
```

## Implementation Priority

### High Priority (Week 3)
1. ✅ Basic formula parser (=A1+B1, =SUM(A1:A10))
2. ✅ Cell reference extraction and translation
3. ✅ Core math functions (SUM, AVERAGE, COUNT)
4. ✅ Formula bar UI component

### Medium Priority (Week 4)
1. Dependency tracking and auto-recalculation
2. Circular reference detection
3. Text and logical functions
4. Formula validation and error handling

### Lower Priority (Week 5)
1. Advanced lookup functions (VLOOKUP, INDEX, MATCH)
2. Date/time functions
3. Array formulas and advanced operations
4. Formula performance optimization

## Performance Considerations

### Legend State Optimization
```typescript
// Use computed for expensive calculations
const expensiveFormula$ = computed(() => {
  // Only recalculates when dependencies change
  const range = getRangeValues(0, 0, 1000, 10)
  return range.reduce((sum, val) => sum + parseFloat(val), 0)
})

// Batch multiple formula updates
function updateMultipleFormulas(updates: Array<{ cellKey: string; formula: string }>) {
  batch(() => {
    updates.forEach(({ cellKey, formula }) => {
      setFormula(cellKey, formula)
    })
  })
}

// Debounce rapid changes
const debouncedRecalc = debounce(() => recalculateAllFormulas(), 100)
```

### Memory Management
- Compile formulas only once, cache compiled functions
- Use WeakMap for temporary calculation context
- Limit recursive formula depth to prevent stack overflow
- Clear unused formula contexts automatically

## Testing Strategy

### Formula Engine Tests
- Basic arithmetic: =A1+B1, =A1*B1/C1
- Range operations: =SUM(A1:A10), =AVERAGE(B1:B5)
- Nested formulas: =SUM(A1:A5)+AVERAGE(B1:B5)
- Error handling: Division by zero, invalid references

### Performance Tests
- 1000+ formulas recalculating simultaneously
- Large range formulas (SUM(A1:Z1000))
- Complex dependency chains (A1→B1→C1→...→Z1)
- Memory usage with extensive formula usage

### Edge Cases
- Circular reference prevention
- Formula referencing deleted rows/columns
- Mixed data types in calculations
- Very long formula expressions

This phase provides a complete formula engine using only Legend State's reactive capabilities, delivering Excel-level functionality with minimal external dependencies.
# Legend State Patterns & Optimizations

## Overview

Proven patterns, optimizations, and best practices for building high-performance table components with Legend State. These patterns form the foundation for all UltraTable features.

## Core Reactive Patterns

### 1. Fine-Grained Subscriptions

```typescript
// ✅ Good: Subscribe only to specific data
function DataCell({ rowIndex, field }: CellProps) {
  // Only re-renders when this specific cell changes
  const cellValue = ultraTableState$.data[rowIndex][field].use()
  
  return <td>{cellValue}</td>
}

// ❌ Bad: Subscribe to entire data array
function DataCell({ rowIndex, field }: CellProps) {
  // Re-renders when ANY data changes
  const data = ultraTableState$.data.use()
  const cellValue = data[rowIndex][field]
  
  return <td>{cellValue}</td>
}

// ✅ Good: Computed for derived state
const selectedRowCount$ = computed(() => {
  return selectedCells$.get().size
})

// ❌ Bad: Manual calculation on every render
function getSelectedCount() {
  const selected = selectedCells$.get()
  return selected.size // Recalculates every time
}
```

### 2. Batch Operations for Performance

```typescript
// ✅ Batch multiple updates together
function updateMultipleCells(updates: Array<{ row: number; col: number; field: string; value: any }>) {
  batch(() => {
    updates.forEach(({ row, field, value }) => {
      ultraTableState$.data[row][field].set(value)
    })
    
    // Update metadata in same batch
    ultraTableState$.operations.assign({
      lastModified: Date.now(),
      isDirty: true,
      pendingChanges: updates.length
    })
  })
}

// ❌ Bad: Individual updates cause multiple re-renders
function updateMultipleCellsBad(updates: any[]) {
  updates.forEach(({ row, field, value }) => {
    ultraTableState$.data[row][field].set(value) // Triggers render each time
  })
}

// ✅ Batch with error handling
function safeBatchUpdate(updateFn: () => void) {
  try {
    batch(() => {
      updateFn()
    })
  } catch (error) {
    // Rollback mechanism if needed
    console.error('Batch update failed:', error)
  }
}
```

### 3. Computed Observables for Derived Data

```typescript
// ✅ Filtered data with computed
const filteredData$ = computed(() => {
  const data = ultraTableState$.data.get()
  const filters = tableFilters$.get()
  
  // Only recalculates when data or filters change
  return data.filter(row => matchesFilters(row, filters))
})

// ✅ Sorted data building on filtered
const sortedData$ = computed(() => {
  const filtered = filteredData$.get()
  const sorting = tableSorting$.get()
  
  if (!sorting.field) return filtered
  
  return [...filtered].sort((a, b) => {
    const aVal = a[sorting.field]
    const bVal = b[sorting.field]
    const result = compareValues(aVal, bVal)
    return sorting.direction === 'desc' ? -result : result
  })
})

// ✅ Chain computeds for complex operations
const groupedAndSorted$ = computed(() => {
  const sorted = sortedData$.get()
  const grouping = tableGrouping$.get()
  
  return grouping.groups.length > 0 ? 
    applyGrouping(sorted, grouping) : 
    sorted
})

// ✅ Computed with lazy evaluation
const expensiveCalculation$ = computed(() => {
  const data = ultraTableState$.data.get()
  
  // Only calculates when explicitly accessed
  return heavyMathOperation(data)
}, { lazy: true })
```

### 4. Memory-Efficient Large Dataset Patterns

```typescript
// ✅ Virtualized observables for large datasets
function createVirtualizedData(initialData: any[]) {
  // Only track visible rows + buffer
  const visibleData$ = observable(new Map<number, any>())
  const visibleRange$ = observable({ start: 0, end: 100 })
  
  // Load data on demand
  const loadDataRange = (start: number, end: number) => {
    batch(() => {
      for (let i = start; i < end; i++) {
        if (initialData[i] && !visibleData$.get().has(i)) {
          visibleData$.get().set(i, observable(initialData[i]))
        }
      }
    })
  }
  
  // Auto-cleanup old data
  when(visibleRange$, ({ start, end }) => {
    const visible = visibleData$.get()
    const buffer = 50
    
    // Remove data outside visible range + buffer
    Array.from(visible.keys()).forEach(index => {
      if (index < start - buffer || index > end + buffer) {
        visible.delete(index)
      }
    })
    
    // Load new data
    loadDataRange(Math.max(0, start - buffer), end + buffer)
  })
  
  return { visibleData$, visibleRange$, loadDataRange }
}

// ✅ Efficient selection tracking for large datasets
const efficientSelection$ = observable({
  // Use ranges instead of individual cell tracking
  ranges: [] as Array<{
    startRow: number
    endRow: number
    startCol: number  
    endCol: number
  }>,
  
  // Quick lookup cache
  cache: new Set<string>() // Computed from ranges
})

// Computed selection cache
const selectionCache$ = computed(() => {
  const ranges = efficientSelection$.ranges.get()
  const cache = new Set<string>()
  
  ranges.forEach(range => {
    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        cache.add(`${row}:${col}`)
      }
    }
  })
  
  return cache
})
```

## Performance Optimization Patterns

### 1. Debounced Updates

```typescript
// ✅ Debounced search with Legend State
const searchTerm$ = observable('')
const debouncedSearch$ = observable('')

// Debounce search updates
let searchTimeout: NodeJS.Timeout
searchTerm$.onChange(({ value }) => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    debouncedSearch$.set(value)
  }, 300)
})

// Use debounced value for filtering
const searchFilteredData$ = computed(() => {
  const data = ultraTableState$.data.get()
  const search = debouncedSearch$.get()
  
  if (!search) return data
  
  return data.filter(row => 
    Object.values(row).some(val => 
      String(val).toLowerCase().includes(search.toLowerCase())
    )
  )
})
```

### 2. Memoization Patterns

```typescript
// ✅ Memoized expensive calculations
const memoizedCalculations = new Map<string, any>()

const complexCalculation$ = computed(() => {
  const data = ultraTableState$.data.get()
  const cacheKey = `calc-${data.length}-${getDataHash(data)}`
  
  if (memoizedCalculations.has(cacheKey)) {
    return memoizedCalculations.get(cacheKey)
  }
  
  const result = performExpensiveCalculation(data)
  memoizedCalculations.set(cacheKey, result)
  
  return result
})

// Clear cache when data fundamentally changes
when(() => ultraTableState$.data.length, () => {
  memoizedCalculations.clear()
})

// ✅ Computed with custom equality check
const optimizedComputed$ = computed(() => {
  const data = ultraTableState$.data.get()
  return processData(data)
}, {
  // Only update if result actually changed
  equals: (a, b) => JSON.stringify(a) === JSON.stringify(b)
})
```

### 3. Lazy Loading Patterns

```typescript
// ✅ Lazy observables for conditional features
const formulaEngine$ = computed(() => {
  const hasFormulas = Object.keys(tableFormulas$.formulas.get()).length > 0
  
  // Only initialize formula engine when needed
  return hasFormulas ? initializeFormulaEngine() : null
}, { lazy: true })

// ✅ On-demand data loading
function loadDataOnDemand(rowIndex: number) {
  // Check if already loaded
  if (ultraTableState$.data[rowIndex]) {
    return ultraTableState$.data[rowIndex]
  }
  
  // Load from API or cache
  return loadRowData(rowIndex).then(rowData => {
    ultraTableState$.data[rowIndex].set(observable(rowData))
    return ultraTableState$.data[rowIndex]
  })
}

// ✅ Lazy computed for expensive operations
const statistics$ = computed(() => {
  const data = ultraTableState$.data.get()
  
  return {
    mean: calculateMean(data),
    median: calculateMedian(data),
    stddev: calculateStdDev(data),
    correlations: calculateCorrelations(data) // Expensive
  }
}, { 
  lazy: true, // Only calculates when accessed
  equals: (a, b) => a?.mean === b?.mean // Custom equality
})
```

### 4. Side Effect Management

```typescript
// ✅ Controlled side effects with when()
when(
  () => tableSelection$.activeCell.get(),
  (activeCell) => {
    if (activeCell) {
      // Side effect: Update URL or focus element
      updateActiveCell(activeCell)
      
      // Side effect: Update external state
      notifySelectionChange(activeCell)
    }
  }
)

// ✅ Cleanup patterns
const subscriptions: (() => void)[] = []

function setupTableListeners() {
  // Subscribe to data changes
  subscriptions.push(
    ultraTableState$.data.onChange(() => {
      markTableDirty()
    })
  )
  
  // Subscribe to selection changes
  subscriptions.push(
    tableSelection$.onChange(() => {
      updateSelectionIndicators()
    })
  )
}

function cleanupTableListeners() {
  subscriptions.forEach(unsubscribe => unsubscribe())
  subscriptions.length = 0
}

// ✅ Effect with dependencies
function useTableAutoSave() {
  useEffect(() => {
    const unsubscribe = when(
      () => [ultraTableState$.operations.isDirty.get(), ultraTableState$.operations.pendingChanges.get()],
      ([isDirty, pendingChanges]) => {
        if (isDirty && pendingChanges === 0) {
          // All changes processed, auto-save
          autoSaveTable()
        }
      }
    )
    
    return unsubscribe
  }, [])
}
```

## Common Anti-Patterns to Avoid

### 1. Subscription Anti-Patterns

```typescript
// ❌ Over-subscribing
function BadComponent() {
  const entireTable = ultraTableState$.use() // Too broad!
  return <div>{entireTable.data.length}</div>
}

// ✅ Precise subscription
function GoodComponent() {
  const dataLength = computed(() => ultraTableState$.data.length).use()
  return <div>{dataLength}</div>
}

// ❌ Multiple subscriptions in render
function BadCell({ rowIndex, field }) {
  const value = ultraTableState$.data[rowIndex][field].use()
  const isSelected = selectedCells$.use().has(`${rowIndex}:${field}`) // Inefficient!
  
  return <td className={isSelected ? 'selected' : ''}>{value}</td>
}

// ✅ Combined computed subscription
const cellState$ = (rowIndex: number, field: string) => computed(() => ({
  value: ultraTableState$.data[rowIndex][field].get(),
  isSelected: selectedCells$.get().has(`${rowIndex}:${field}`)
}))

function GoodCell({ rowIndex, field }) {
  const { value, isSelected } = cellState$(rowIndex, field).use()
  
  return <td className={isSelected ? 'selected' : ''}>{value}</td>
}
```

### 2. Performance Anti-Patterns

```typescript
// ❌ Expensive operations in render
function BadComponent() {
  const data = ultraTableState$.data.use()
  const expensiveResult = data.map(calculateExpensiveOperation) // Every render!
  
  return <div>{expensiveResult.length}</div>
}

// ✅ Computed for expensive operations
const expensiveResults$ = computed(() => {
  const data = ultraTableState$.data.get()
  return data.map(calculateExpensiveOperation) // Only when data changes
})

function GoodComponent() {
  const results = expensiveResults$.use()
  return <div>{results.length}</div>
}

// ❌ Creating observables in render
function BadCell({ rowIndex, field }) {
  const cellObservable = observable(defaultValue) // New observable every render!
  
  return <td>{cellObservable.use()}</td>
}

// ✅ Stable observable references
const cellObservables = new Map<string, any>()

function getCellObservable(rowIndex: number, field: string) {
  const key = `${rowIndex}:${field}`
  
  if (!cellObservables.has(key)) {
    cellObservables.set(key, ultraTableState$.data[rowIndex][field])
  }
  
  return cellObservables.get(key)
}
```

## Advanced Optimization Techniques

### 1. Intelligent Caching

```typescript
// Multi-layer caching strategy
export class TableCache {
  private computedCache = new Map<string, any>()
  private aggregationCache = new Map<string, any>()
  private renderCache = new Map<string, React.ReactElement>()
  
  // Cache computed results with TTL
  getCached<T>(key: string, computeFn: () => T, ttl = 5000): T {
    const cached = this.computedCache.get(key)
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value
    }
    
    const value = computeFn()
    this.computedCache.set(key, { value, timestamp: Date.now() })
    
    return value
  }
  
  // Cache aggregations by group signature
  getAggregation(groupKey: string, data: any[], aggregations: any[]) {
    const signature = `${groupKey}-${data.length}-${JSON.stringify(aggregations)}`
    
    return this.getCached(signature, () => {
      return calculateGroupAggregations(data, aggregations)
    }, 10000) // Longer TTL for aggregations
  }
  
  // Clear expired entries
  cleanup() {
    const now = Date.now()
    
    this.computedCache.forEach((value, key) => {
      if (now - value.timestamp > 30000) { // 30 second cleanup
        this.computedCache.delete(key)
      }
    })
  }
}

export const tableCache = new TableCache()

// Auto-cleanup cache
setInterval(() => tableCache.cleanup(), 30000)
```

### 2. Virtual Data Patterns

```typescript
// Virtual row management for 100k+ datasets
export const virtualData$ = observable({
  // Only track metadata for all rows
  totalRows: 0,
  rowHeights: new Map<number, number>(),
  estimatedRowHeight: 32,
  
  // Loaded data window
  loadedRange: { start: 0, end: 0 },
  loadedData: new Map<number, any>(),
  
  // Loading state
  isLoading: false,
  loadQueue: [] as number[]
})

// Virtual data loader
async function loadDataWindow(startRow: number, endRow: number) {
  const toLoad = []
  
  for (let i = startRow; i < endRow; i++) {
    if (!virtualData$.loadedData.get().has(i)) {
      toLoad.push(i)
    }
  }
  
  if (toLoad.length === 0) return
  
  virtualData$.isLoading.set(true)
  
  try {
    // Load data in chunks
    const chunkSize = 100
    for (let i = 0; i < toLoad.length; i += chunkSize) {
      const chunk = toLoad.slice(i, i + chunkSize)
      const rowData = await fetchRowData(chunk)
      
      batch(() => {
        rowData.forEach((data, index) => {
          const rowIndex = chunk[index]
          virtualData$.loadedData.get().set(rowIndex, observable(data))
        })
      })
    }
  } finally {
    virtualData$.isLoading.set(false)
  }
}

// Smart preloading
function useSmartPreloading() {
  const visibleRange = virtualData$.loadedRange.use()
  
  useEffect(() => {
    // Preload adjacent data
    const buffer = 200
    const preloadStart = Math.max(0, visibleRange.start - buffer)
    const preloadEnd = visibleRange.end + buffer
    
    loadDataWindow(preloadStart, preloadEnd)
  }, [visibleRange.start, visibleRange.end])
}
```

### 3. Formula Optimization Patterns

```typescript
// Optimized formula dependency tracking
const formulaDependencyGraph$ = observable({
  // Adjacency list for fast lookups
  dependencies: new Map<string, Set<string>>(),
  dependents: new Map<string, Set<string>>(),
  
  // Topological sort cache
  calculationOrder: [] as string[],
  orderValid: false
})

// Incremental formula calculation
function recalculateFromCell(changedCell: string) {
  const dependents = formulaDependencyGraph$.dependents.get().get(changedCell)
  
  if (!dependents || dependents.size === 0) return
  
  // Build minimal recalculation order
  const toRecalculate = new Set<string>()
  const queue = [changedCell]
  
  while (queue.length > 0) {
    const current = queue.shift()!
    const cellDependents = formulaDependencyGraph$.dependents.get().get(current)
    
    if (cellDependents) {
      cellDependents.forEach(dependent => {
        if (!toRecalculate.has(dependent)) {
          toRecalculate.add(dependent)
          queue.push(dependent)
        }
      })
    }
  }
  
  // Recalculate in order
  batch(() => {
    Array.from(toRecalculate).forEach(cellKey => {
      recalculateSingleFormula(cellKey)
    })
  })
}

// Parallel formula calculation for independent formulas
async function calculateFormulasParallel() {
  const formulas = tableFormulas$.formulas.get()
  const independent: string[] = []
  const dependent: string[] = []
  
  Object.keys(formulas).forEach(cellKey => {
    const formula = formulas[cellKey]
    if (formula.dependencies.length === 0) {
      independent.push(cellKey)
    } else {
      dependent.push(cellKey)
    }
  })
  
  // Calculate independent formulas in parallel
  const independentPromises = independent.map(cellKey => 
    Promise.resolve(calculateSingleFormula(cellKey))
  )
  
  await Promise.all(independentPromises)
  
  // Then calculate dependent formulas in order
  batch(() => {
    dependent.forEach(cellKey => calculateSingleFormula(cellKey))
  })
}
```

### 4. Memory Management Patterns

```typescript
// Automatic cleanup patterns
export class TableMemoryManager {
  private cleanupTasks: (() => void)[] = []
  private gcTimer?: NodeJS.Timeout
  
  // Register cleanup tasks
  addCleanup(task: () => void) {
    this.cleanupTasks.push(task)
  }
  
  // Automatic garbage collection
  startGC(interval = 60000) { // 1 minute
    this.gcTimer = setInterval(() => {
      this.performGC()
    }, interval)
  }
  
  performGC() {
    // Clear unused computed observables
    this.clearUnusedComputeds()
    
    // Clean formula caches
    this.cleanFormulaCaches()
    
    // Clean selection caches
    this.cleanSelectionCaches()
    
    // Run custom cleanup tasks
    this.cleanupTasks.forEach(task => {
      try {
        task()
      } catch (error) {
        console.error('Cleanup task failed:', error)
      }
    })
  }
  
  // Force cleanup
  cleanup() {
    clearInterval(this.gcTimer)
    this.performGC()
    this.cleanupTasks.length = 0
  }
  
  private clearUnusedComputeds() {
    // Clear computeds that haven't been accessed recently
    // Implementation depends on Legend State internals
  }
  
  private cleanFormulaCaches() {
    // Clear old formula compilation cache
    const formulas = tableFormulas$.formulas.get()
    const activeFormulas = new Set(Object.keys(formulas))
    
    // Remove cached results for deleted formulas
    memoizedCalculations.forEach((value, key) => {
      const cellKey = key.split('-')[0]
      if (!activeFormulas.has(cellKey)) {
        memoizedCalculations.delete(key)
      }
    })
  }
  
  private cleanSelectionCaches() {
    // Clear old selection range calculations
    const maxAge = 300000 // 5 minutes
    const now = Date.now()
    
    selectionCache.forEach((timestamp, key) => {
      if (now - timestamp > maxAge) {
        selectionCache.delete(key)
      }
    })
  }
}

// Memory monitoring
const memoryMonitor$ = observable({
  currentUsage: 0,
  peakUsage: 0,
  gcCount: 0,
  lastGC: 0
})

function monitorMemoryUsage() {
  if ('memory' in performance) {
    const memory = (performance as any).memory
    
    memoryMonitor$.assign({
      currentUsage: memory.usedJSHeapSize,
      peakUsage: Math.max(memoryMonitor$.peakUsage.get(), memory.usedJSHeapSize)
    })
  }
}

// Monitor every 5 seconds
setInterval(monitorMemoryUsage, 5000)
```

## Debugging and Development Patterns

### 1. Development-Only Observables

```typescript
// Debug state (stripped in production)
const debugState$ = observable({
  enabled: process.env.NODE_ENV === 'development',
  showRenderCount: false,
  showSubscriptions: false,
  performanceMode: false,
  logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error'
})

// Debug wrapper for components
function withDebug<T extends object>(Component: React.ComponentType<T>, name: string) {
  if (!debugState$.enabled.get()) return Component
  
  return React.memo((props: T) => {
    const renderCount = useRef(0)
    renderCount.current++
    
    if (debugState$.showRenderCount.get()) {
      console.log(`${name} rendered ${renderCount.current} times`)
    }
    
    return <Component {...props} />
  })
}

// Performance profiling
function profileOperation<T>(name: string, operation: () => T): T {
  if (!debugState$.performanceMode.get()) {
    return operation()
  }
  
  const start = performance.now()
  const result = operation()
  const duration = performance.now() - start
  
  if (duration > 16) { // Slower than 60fps
    console.warn(`Slow operation: ${name} took ${duration.toFixed(2)}ms`)
  }
  
  return result
}
```

### 2. State Inspection Utilities

```typescript
// Legend State debugging utilities
export const tableDebug = {
  // Dump current state
  dumpState() {
    return {
      data: ultraTableState$.data.get(),
      selection: tableSelection$.get(),
      formulas: tableFormulas$.formulas.get(),
      grouping: tableGrouping$.get(),
      performance: derivedTableState.performance$.get()
    }
  },
  
  // Track subscription counts
  getSubscriptionCount() {
    // Would need Legend State internal access
    return 'Not implemented - requires Legend State internals'
  },
  
  // Validate state consistency
  validateState() {
    const errors = []
    
    // Check data integrity
    const data = ultraTableState$.data.get()
    const columns = tableColumns$.get()
    
    data.forEach((row, index) => {
      columns.forEach(col => {
        if (!(col.field in row)) {
          errors.push(`Row ${index} missing field ${col.field}`)
        }
      })
    })
    
    // Check formula dependencies
    const formulas = tableFormulas$.formulas.get()
    Object.entries(formulas).forEach(([cellKey, formula]) => {
      formula.dependencies.forEach(dep => {
        if (!isValidCellReference(dep)) {
          errors.push(`Formula in ${cellKey} has invalid dependency ${dep}`)
        }
      })
    })
    
    return errors
  },
  
  // Performance metrics
  getPerformanceMetrics() {
    return {
      dataSize: ultraTableState$.data.get().length,
      computedCount: Object.keys(derivedTableState).length,
      formulaCount: Object.keys(tableFormulas$.formulas.get()).length,
      memoryEstimate: estimateMemoryUsage()
    }
  }
}
```

## Testing Patterns

### 1. Legend State Test Utilities

```typescript
// Test-specific observable creation
export function createTestTable(data: any[] = [], columns: any[] = []) {
  return observable({
    data: data.map(row => observable(row)),
    columns: observable(columns),
    selection: observable({
      activeCell: null,
      ranges: []
    })
  })
}

// State assertions
export function expectObservableValue<T>(
  observable$: any, 
  expected: T, 
  timeout = 1000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => 
      reject(new Error(`Timeout: Observable did not reach expected value`)), timeout)
    
    const unsubscribe = observable$.onChange(() => {
      if (JSON.stringify(observable$.get()) === JSON.stringify(expected)) {
        clearTimeout(timer)
        unsubscribe()
        resolve()
      }
    })
    
    // Check immediate value
    if (JSON.stringify(observable$.get()) === JSON.stringify(expected)) {
      clearTimeout(timer)
      unsubscribe()
      resolve()
    }
  })
}

// Batch test operations
export function performTestBatch(operations: Array<() => void>) {
  return new Promise<void>(resolve => {
    batch(() => {
      operations.forEach(op => op())
    })
    
    // Wait for next tick to ensure all updates processed
    setTimeout(resolve, 0)
  })
}
```

### 2. Component Testing Patterns

```typescript
// Mock Legend State for testing
export function createMockTableState(overrides: any = {}) {
  const mockState$ = observable({
    data: [],
    columns: [],
    ...overrides
  })
  
  // Mock computed observables
  const mockDerived = {
    processedData$: computed(() => mockState$.data.get()),
    stats$: computed(() => ({
      totalRows: mockState$.data.get().length,
      visibleRows: mockState$.data.get().length
    }))
  }
  
  return { state: mockState$, derived: mockDerived }
}

// Test component with mock state
function renderWithMockTable(component: React.ReactElement, mockData: any = {}) {
  const { state, derived } = createMockTableState(mockData)
  
  return render(
    <TableStateProvider value={{ state, derived }}>
      {component}
    </TableStateProvider>
  )
}
```

## Production Deployment Patterns

### 1. Bundle Optimization

```typescript
// Lazy load heavy features
const LazyFormulaEngine = React.lazy(() => import('./FormulaEngine'))
const LazyPivotTable = React.lazy(() => import('./PivotTable'))
const LazyExcelImporter = React.lazy(() => import('./ExcelImporter'))

// Feature detection for conditional loading
function UltraTableWithFeatures() {
  const hasFormulas = Object.keys(tableFormulas$.formulas.use()).length > 0
  const isPivotMode = ultraTableState$.view.mode.use() === 'pivot'
  
  return (
    <div>
      <UltraTableCore />
      
      {hasFormulas && (
        <Suspense fallback={<div>Loading formulas...</div>}>
          <LazyFormulaEngine />
        </Suspense>
      )}
      
      {isPivotMode && (
        <Suspense fallback={<div>Loading pivot table...</div>}>
          <LazyPivotTable />
        </Suspense>
      )}
    </div>
  )
}
```

### 2. Error Recovery Patterns

```typescript
// Graceful degradation
const fallbackState$ = observable({
  mode: 'fallback' as 'normal' | 'fallback' | 'recovery',
  reason: '',
  canRecover: false
})

// Error boundary with state recovery
export function TableRecoveryWrapper({ children }: { children: React.ReactNode }) {
  const fallback = fallbackState$.use()
  
  if (fallback.mode === 'fallback') {
    return (
      <div className="table-fallback p-4 border border-destructive rounded">
        <h3 className="font-semibold text-destructive mb-2">Table Temporarily Unavailable</h3>
        <p className="text-sm text-muted-foreground mb-4">{fallback.reason}</p>
        
        {fallback.canRecover && (
          <Button onClick={recoverTable}>
            Recover Table
          </Button>
        )}
      </div>
    )
  }
  
  return <>{children}</>
}

function recoverTable() {
  batch(() => {
    // Reset to safe state
    tableSelection$.assign({
      activeCell: null,
      ranges: []
    })
    
    // Clear problematic formulas
    const formulas = tableFormulas$.formulas.get()
    Object.entries(formulas).forEach(([cellKey, formula]) => {
      if (formula.error) {
        delete tableFormulas$.formulas[cellKey]
      }
    })
    
    fallbackState$.mode.set('normal')
  })
}
```

These patterns provide the foundation for building a production-ready, high-performance table component that leverages Legend State's full capabilities while avoiding common pitfalls and performance issues.
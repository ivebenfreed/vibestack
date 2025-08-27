# Performance Benchmarks & Targets

## Overview

Specific performance targets and measurement strategies for UltraTable implementation. All benchmarks focus on Legend State optimization and minimal library overhead.

## Performance Targets by Phase

### Phase 1: Core Features
| Metric | Target | Measurement |
|--------|---------|-------------|
| **Initial render** | <200ms for 10k rows | Time to first interactive cell |
| **Cell edit latency** | <50ms | Click to editor appearance |
| **Selection update** | <16ms | Single cell selection change |
| **Copy operation** | <100ms for 1k cells | Copy to clipboard completion |
| **Paste operation** | <200ms for 1k cells | Paste and render completion |
| **Undo/redo** | <50ms | State restoration time |

### Phase 2: Advanced Selection
| Metric | Target | Measurement |
|--------|---------|-------------|
| **Range selection** | <32ms | Drag selection visual feedback |
| **Keyboard navigation** | <16ms | Arrow key response time |
| **Fill operation** | <100ms for 100 cells | Pattern fill completion |
| **Range copy** | <150ms for 5k cells | Large range copy to clipboard |
| **Multi-selection** | <50ms | Ctrl+click additional selection |

### Phase 3: Formulas
| Metric | Target | Measurement |
|--------|---------|-------------|
| **Formula compilation** | <10ms per formula | Parse and compile time |
| **Formula calculation** | <5ms simple, <50ms complex | Single formula execution |
| **Dependency update** | <100ms | Recalculate dependent formulas |
| **Circular detection** | <200ms | Detect cycles in 1k+ formulas |
| **Formula bar typing** | <16ms | Keystroke response in formula bar |

### Phase 4: Import/Export
| Metric | Target | Measurement |
|--------|---------|-------------|
| **CSV import** | <2s for 50k rows | File to table display |
| **Excel import** | <5s for 20k rows | Complex file parsing |
| **CSV export** | <1s for 50k rows | Table to download |
| **Clipboard formats** | <100ms | Multi-format clipboard write |
| **Streaming export** | 10k+ rows/second | Large dataset export rate |

### Phase 5: Grouping
| Metric | Target | Measurement |
|--------|---------|-------------|
| **Group calculation** | <500ms for 10k rows | Initial grouping computation |
| **Group expand/collapse** | <32ms | UI response time |
| **Aggregation update** | <100ms | Real-time aggregation recalc |
| **Pivot table** | <1s for 5k rows | Pivot table generation |
| **Group search** | <200ms | Filter large group list |

## Memory Targets

### Data Scale Targets
```typescript
// Memory usage benchmarks
const memoryTargets = {
  // Base memory (empty table)
  baseline: '< 10MB',
  
  // Data scaling
  '1k_rows': '< 50MB',
  '10k_rows': '< 200MB', 
  '50k_rows': '< 500MB',
  '100k_rows': '< 1GB',
  
  // Feature overhead
  formulas_1k: '+ 20MB',
  grouping_1k_groups: '+ 30MB',
  selection_10k_cells: '+ 5MB',
  
  // Sustained usage (4+ hours)
  memory_leak_rate: '< 1MB/hour',
  gc_frequency: 'Every 5 minutes max'
}

// Memory monitoring implementation
const memoryBenchmarks$ = observable({
  baseline: 0,
  current: 0,
  peak: 0,
  measurements: [] as Array<{
    timestamp: number
    heapUsed: number
    heapTotal: number
    external: number
    operation: string
  }>,
  
  // Performance alerts
  alerts: [] as Array<{
    type: 'memory' | 'performance' | 'leak'
    message: string
    timestamp: number
    severity: 'info' | 'warn' | 'error'
  }>
})

function measureMemory(operation: string) {
  if ('memory' in performance) {
    const memory = (performance as any).memory
    
    memoryBenchmarks$.measurements.push({
      timestamp: Date.now(),
      heapUsed: memory.usedJSHeapSize,
      heapTotal: memory.totalJSHeapSize,
      external: memory.externalJSHeapSize || 0,
      operation
    })
    
    // Check for memory spikes
    const current = memory.usedJSHeapSize
    const peak = memoryBenchmarks$.peak.get()
    
    if (current > peak * 1.5) {
      memoryBenchmarks$.alerts.push({
        type: 'memory',
        message: `Memory spike detected: ${(current / 1024 / 1024).toFixed(1)}MB`,
        timestamp: Date.now(),
        severity: 'warn'
      })
    }
    
    memoryBenchmarks$.assign({
      current,
      peak: Math.max(peak, current)
    })
  }
}
```

## Bundle Size Targets

### Library Budget
```typescript
const bundleBudget = {
  // Core UltraTable (excluding Legend State/React)
  core_table: '< 50KB gzipped',
  
  // Optional features (lazy loaded)
  formula_engine: '< 30KB',
  excel_support: '< 100KB', // xlsx library
  csv_parser: '< 30KB',     // papaparse
  
  // Total additional bundle impact
  total_addition: '< 200KB gzipped',
  
  // Runtime overhead
  initialization: '< 100ms',
  lazy_load_delay: '< 500ms per feature'
}

// Bundle analysis with webpack-bundle-analyzer integration
function analyzeBundleImpact() {
  // Would integrate with build process
  return {
    beforeOptimization: '500KB',
    afterOptimization: '180KB',
    savings: '64%',
    
    largestModules: [
      'xlsx: 85KB',
      'formula-engine: 25KB', 
      'virtualization: 20KB'
    ]
  }
}
```

## Real-World Performance Tests

### 1. Stress Testing Scenarios

```typescript
// Large dataset performance tests
const stressTests = {
  // Data volume tests
  async test_10k_rows() {
    const startTime = performance.now()
    
    // Generate 10k rows
    const testData = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      name: `Row ${i}`,
      value: Math.random() * 1000,
      date: new Date(Date.now() - Math.random() * 31536000000),
      status: ['active', 'inactive', 'pending'][i % 3]
    }))
    
    // Measure table initialization
    ultraTableState$.data.set(testData.map(row => observable(row)))
    
    const initTime = performance.now() - startTime
    
    // Measure first render
    const renderStart = performance.now()
    // Trigger render by accessing computed data
    const processed = derivedTableState.processedData$.get()
    const renderTime = performance.now() - renderStart
    
    return {
      dataSize: testData.length,
      initTime,
      renderTime,
      memoryUsage: measureMemory('10k_rows_loaded'),
      pass: initTime < 200 && renderTime < 200
    }
  },
  
  // Formula stress test
  async test_1k_formulas() {
    const startTime = performance.now()
    
    // Create interdependent formulas
    batch(() => {
      for (let i = 0; i < 1000; i++) {
        const row = Math.floor(i / 10)
        const col = i % 10
        const cellKey = `${row}:${col}`
        
        // Create dependency chain
        const formula = i === 0 ? '=10' : `=${indexToColumnLetter(col-1)}${row+1}+1`
        
        tableFormulas$.formulas[cellKey].set({
          cellKey,
          expression: formula,
          dependencies: i === 0 ? [] : [`${row}:${col-1}`],
          compiledFn: compileFutureFormula(formula),
          error: null
        })
      }
    })
    
    const compilationTime = performance.now() - startTime
    
    // Measure calculation time
    const calcStart = performance.now()
    recalculateAllFormulas()
    const calculationTime = performance.now() - calcStart
    
    return {
      formulaCount: 1000,
      compilationTime,
      calculationTime,
      pass: compilationTime < 500 && calculationTime < 200
    }
  },
  
  // Selection performance test
  async test_large_selection() {
    const startTime = performance.now()
    
    // Select 5000 cells
    const largeCellSet = new Set<string>()
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 50; col++) {
        largeCellSet.add(`${row}:${col}`)
      }
    }
    
    selectedCells$.set(largeCellSet)
    
    const selectionTime = performance.now() - startTime
    
    // Measure copy operation
    const copyStart = performance.now()
    await copySelectedCells()
    const copyTime = performance.now() - copyStart
    
    return {
      selectedCount: largeCellSet.size,
      selectionTime,
      copyTime,
      pass: selectionTime < 100 && copyTime < 500
    }
  }
}
```

### 2. Real-World Usage Simulation

```typescript
// Simulate typical user workflows
const usageSimulations = {
  // Data entry workflow
  async simulate_data_entry(duration = 60000) { // 1 minute
    const startTime = Date.now()
    const operations = []
    
    while (Date.now() - startTime < duration) {
      // Random cell edits
      const row = Math.floor(Math.random() * 1000)
      const col = Math.floor(Math.random() * 10)
      const value = Math.random() * 100
      
      const opStart = performance.now()
      ultraTableState$.data[row].value.set(value)
      const opTime = performance.now() - opStart
      
      operations.push({
        type: 'edit',
        duration: opTime,
        timestamp: Date.now()
      })
      
      // Simulate typing delay
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500))
    }
    
    return {
      operationCount: operations.length,
      averageLatency: operations.reduce((sum, op) => sum + op.duration, 0) / operations.length,
      p95Latency: calculatePercentile(operations.map(op => op.duration), 95),
      pass: operations.every(op => op.duration < 100)
    }
  },
  
  // Spreadsheet power user workflow
  async simulate_power_user() {
    const operations = []
    
    // Bulk selection and copy
    const start1 = performance.now()
    selectRange(0, 0, 99, 9) // 1000 cells
    await copySelectedCells()
    operations.push({ type: 'bulk_copy', duration: performance.now() - start1 })
    
    // Complex formula creation
    const start2 = performance.now()
    setFormula(100, 0, '=SUM(A1:J100)')
    operations.push({ type: 'complex_formula', duration: performance.now() - start2 })
    
    // Grouping operation
    const start3 = performance.now()
    addGroup('status')
    addGroup('category')
    operations.push({ type: 'grouping', duration: performance.now() - start3 })
    
    // Export operation
    const start4 = performance.now()
    await exportToFile('csv')
    operations.push({ type: 'export', duration: performance.now() - start4 })
    
    return {
      operations,
      totalTime: operations.reduce((sum, op) => sum + op.duration, 0),
      pass: operations.every(op => op.duration < 1000)
    }
  }
}
```

## Measurement Infrastructure

### 1. Performance Monitoring

```typescript
// Built-in performance tracking
const performanceTracker$ = observable({
  enabled: process.env.NODE_ENV === 'development',
  
  // Operation timing
  operations: {} as Record<string, {
    count: number
    totalTime: number
    averageTime: number
    maxTime: number
    recentTimes: number[] // Last 10 operations
  }>,
  
  // Render performance
  renders: {
    totalRenders: 0,
    slowRenders: 0, // >16ms
    renderTimes: [] as number[]
  },
  
  // Memory tracking
  memory: {
    samples: [] as Array<{
      timestamp: number
      heapUsed: number
      operation: string
    }>,
    peakUsage: 0,
    gcEvents: 0
  }
})

// Performance measurement wrapper
function measurePerformance<T>(operationName: string, operation: () => T): T {
  if (!performanceTracker$.enabled.get()) {
    return operation()
  }
  
  const startTime = performance.now()
  measureMemory(operationName + '_start')
  
  try {
    const result = operation()
    
    const duration = performance.now() - startTime
    measureMemory(operationName + '_end')
    
    // Update performance stats
    const current = performanceTracker$.operations[operationName].get() || {
      count: 0,
      totalTime: 0,
      averageTime: 0,
      maxTime: 0,
      recentTimes: []
    }
    
    const newCount = current.count + 1
    const newTotal = current.totalTime + duration
    const newAverage = newTotal / newCount
    const newMax = Math.max(current.maxTime, duration)
    const newRecent = [...current.recentTimes.slice(-9), duration]
    
    performanceTracker$.operations[operationName].set({
      count: newCount,
      totalTime: newTotal,
      averageTime: newAverage,
      maxTime: newMax,
      recentTimes: newRecent
    })
    
    // Alert on slow operations
    if (duration > 100) {
      console.warn(`Slow operation: ${operationName} took ${duration.toFixed(2)}ms`)
    }
    
    return result
  } catch (error) {
    measureMemory(operationName + '_error')
    throw error
  }
}

// React performance monitoring
function useRenderTracking(componentName: string) {
  const renderCount = useRef(0)
  
  useEffect(() => {
    renderCount.current++
    
    if (performanceTracker$.enabled.get()) {
      const current = performanceTracker$.renders
      current.totalRenders.set(current.totalRenders.get() + 1)
      
      // Track excessive re-renders
      if (renderCount.current > 10) {
        console.warn(`Excessive re-renders in ${componentName}: ${renderCount.current}`)
      }
    }
  })
}
```

### 2. Automated Benchmark Suite

```typescript
// Comprehensive benchmark runner
export class TableBenchmarkRunner {
  private results: Map<string, any> = new Map()
  
  async runAllBenchmarks() {
    console.log('🚀 Starting UltraTable performance benchmarks...')
    
    const suites = [
      { name: 'Core Operations', tests: this.coreOperationTests },
      { name: 'Large Data', tests: this.largeDataTests },
      { name: 'Formula Engine', tests: this.formulaTests },
      { name: 'Import/Export', tests: this.importExportTests },
      { name: 'Memory Usage', tests: this.memoryTests }
    ]
    
    for (const suite of suites) {
      console.log(`\n📊 Running ${suite.name} benchmarks...`)
      
      const suiteResults = await this.runSuite(suite.tests)
      this.results.set(suite.name, suiteResults)
      
      // Print immediate results
      this.printSuiteResults(suite.name, suiteResults)
    }
    
    // Generate final report
    this.generateReport()
  }
  
  private async runSuite(tests: Record<string, () => Promise<any>>) {
    const results: Record<string, any> = {}
    
    for (const [testName, testFn] of Object.entries(tests)) {
      try {
        // Clear caches before each test
        this.clearCaches()
        
        // Run test 3 times, take median
        const runs = []
        for (let i = 0; i < 3; i++) {
          const result = await testFn()
          runs.push(result)
          
          // Brief pause between runs
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        results[testName] = {
          runs,
          median: this.getMedianResult(runs),
          pass: runs.every(run => run.pass !== false)
        }
        
      } catch (error) {
        results[testName] = {
          error: error.message,
          pass: false
        }
      }
    }
    
    return results
  }
  
  // Core operation benchmarks
  private coreOperationTests = {
    cell_edit_latency: async () => {
      const start = performance.now()
      
      // Simulate cell edit
      ultraTableState$.data[0].name.set('New Value')
      
      // Wait for DOM update
      await new Promise(resolve => setTimeout(resolve, 0))
      
      return {
        duration: performance.now() - start,
        pass: (performance.now() - start) < 50
      }
    },
    
    selection_update: async () => {
      const start = performance.now()
      
      selectedCells$.set(new Set(['0:0', '0:1', '0:2', '1:0', '1:1', '1:2']))
      
      await new Promise(resolve => setTimeout(resolve, 0))
      
      return {
        duration: performance.now() - start,
        selectedCount: selectedCells$.get().size,
        pass: (performance.now() - start) < 16
      }
    },
    
    batch_update_performance: async () => {
      const updates = Array.from({ length: 1000 }, (_, i) => ({
        row: Math.floor(i / 10),
        field: 'value',
        value: Math.random()
      }))
      
      const start = performance.now()
      
      batch(() => {
        updates.forEach(({ row, field, value }) => {
          ultraTableState$.data[row][field].set(value)
        })
      })
      
      return {
        duration: performance.now() - start,
        updateCount: updates.length,
        pass: (performance.now() - start) < 200
      }
    }
  }
  
  // Large data benchmarks
  private largeDataTests = {
    render_10k_rows: async () => {
      const testData = this.generateTestData(10000)
      
      const start = performance.now()
      ultraTableState$.data.set(testData.map(row => observable(row)))
      
      // Trigger computed data processing
      const processed = derivedTableState.processedData$.get()
      
      return {
        duration: performance.now() - start,
        rowCount: processed.length,
        pass: (performance.now() - start) < 500
      }
    },
    
    virtual_scroll_performance: async () => {
      // Test virtualization with rapid scrolling
      const scrollEvents = 100
      const times = []
      
      for (let i = 0; i < scrollEvents; i++) {
        const start = performance.now()
        
        // Simulate scroll by updating visible range
        virtualData$.visibleRange.set({
          start: i * 10,
          end: i * 10 + 100
        })
        
        times.push(performance.now() - start)
        await new Promise(resolve => setTimeout(resolve, 16)) // 60fps
      }
      
      return {
        scrollEvents,
        averageTime: times.reduce((a, b) => a + b, 0) / times.length,
        maxTime: Math.max(...times),
        pass: times.every(time => time < 16)
      }
    }
  }
  
  // Utility methods
  private generateTestData(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      value: Math.random() * 1000,
      category: ['A', 'B', 'C', 'D'][i % 4],
      date: new Date(Date.now() - Math.random() * 31536000000),
      status: Math.random() > 0.5
    }))
  }
  
  private clearCaches() {
    // Clear all caches before tests
    formulaCache.clear()
    aggregationCache.clear()
    selectionCache.clear()
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  }
  
  private getMedianResult(runs: any[]) {
    if (runs.length === 1) return runs[0]
    
    const sorted = runs.sort((a, b) => (a.duration || 0) - (b.duration || 0))
    return sorted[Math.floor(sorted.length / 2)]
  }
  
  private generateReport() {
    console.log('\n📈 Performance Benchmark Report')
    console.log('================================')
    
    this.results.forEach((suiteResults, suiteName) => {
      console.log(`\n${suiteName}:`)
      
      Object.entries(suiteResults).forEach(([testName, result]: [string, any]) => {
        const status = result.pass ? '✅' : '❌'
        const duration = result.median?.duration || result.duration || 'N/A'
        
        console.log(`  ${status} ${testName}: ${duration}ms`)
        
        if (!result.pass && result.error) {
          console.log(`     Error: ${result.error}`)
        }
      })
    })
    
    // Overall summary
    const allTests = Array.from(this.results.values()).flatMap(suite => 
      Object.values(suite)
    )
    const passCount = allTests.filter(test => test.pass).length
    const totalTests = allTests.length
    
    console.log(`\n📊 Overall: ${passCount}/${totalTests} tests passed (${(passCount/totalTests*100).toFixed(1)}%)`)
  }
}

// Export benchmark runner
export const benchmarks = new TableBenchmarkRunner()
```

## Continuous Performance Monitoring

### 1. Production Metrics

```typescript
// Lightweight production performance tracking
const productionMetrics$ = observable({
  enabled: false, // Enable via feature flag
  
  // User interaction metrics
  interactions: {
    cellEdits: 0,
    selections: 0,
    formulaChanges: 0,
    copyPaste: 0
  },
  
  // Performance samples (only slow operations)
  slowOperations: [] as Array<{
    operation: string
    duration: number
    timestamp: number
    userAgent: string
  }>,
  
  // Error tracking
  errors: [] as Array<{
    type: string
    message: string
    stack?: string
    timestamp: number
  }>
})

// Performance reporter
function reportSlowOperation(operation: string, duration: number) {
  if (duration > 100 && productionMetrics$.enabled.get()) {
    productionMetrics$.slowOperations.push({
      operation,
      duration,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    })
    
    // Send to analytics (if configured)
    if (typeof analytics !== 'undefined') {
      analytics.track('table_performance', {
        operation,
        duration,
        slow: true
      })
    }
  }
}
```

### 2. Regression Detection

```typescript
// Performance regression detection
const regressionDetection$ = observable({
  baselines: {} as Record<string, {
    operation: string
    expectedDuration: number
    tolerance: number // +/- percentage
    samples: number[]
  }>,
  
  alerts: [] as Array<{
    operation: string
    expected: number
    actual: number
    regression: number // percentage slower
    timestamp: number
  }>
})

// Set performance baselines
function setBaseline(operation: string, expectedMs: number, tolerance = 20) {
  regressionDetection$.baselines[operation].set({
    operation,
    expectedDuration: expectedMs,
    tolerance,
    samples: []
  })
}

// Check for regressions
function checkRegression(operation: string, actualDuration: number) {
  const baseline = regressionDetection$.baselines[operation].get()
  
  if (!baseline) return
  
  const regression = ((actualDuration - baseline.expectedDuration) / baseline.expectedDuration) * 100
  
  if (regression > baseline.tolerance) {
    regressionDetection$.alerts.push({
      operation,
      expected: baseline.expectedDuration,
      actual: actualDuration,
      regression,
      timestamp: Date.now()
    })
    
    console.warn(`Performance regression detected: ${operation} is ${regression.toFixed(1)}% slower than baseline`)
  }
  
  // Update samples
  baseline.samples.push(actualDuration)
  if (baseline.samples.length > 100) {
    baseline.samples.shift() // Keep last 100 samples
  }
}

// Initialize baselines
setBaseline('cell_edit', 50, 20)
setBaseline('selection_update', 16, 25)
setBaseline('formula_calculation', 5, 30)
setBaseline('copy_1k_cells', 100, 30)
setBaseline('group_calculation', 500, 25)
```

## Competitive Benchmarking

### Target Performance vs Competition

```typescript
const competitiveBenchmarks = {
  // vs Notion Database
  notion_comparison: {
    max_rows: 10000, // Notion limit
    our_target: 50000,
    
    edit_latency: {
      notion: 200, // ms average
      our_target: 50
    },
    
    formula_support: {
      notion: 'basic',
      our_target: 'excel_level'
    }
  },
  
  // vs ClickUp Table View  
  clickup_comparison: {
    bulk_operations: {
      clickup: 'slow_ui_feedback',
      our_target: 'instant_batch_updates'
    },
    
    grouping: {
      clickup: 'basic_single_level',
      our_target: 'multi_level_real_time'
    }
  },
  
  // vs Monday.com Workdocs
  monday_comparison: {
    real_time_sync: {
      monday: 'polling_based',
      our_target: 'websocket_immediate'
    },
    
    memory_usage: {
      monday: 'heavy_browser_impact',
      our_target: 'lightweight_legend_state'
    }
  }
}

// Competitive feature matrix
const featureComparison = {
  features: [
    'Multi-cell selection',
    'Excel-style formulas', 
    'Real-time collaboration',
    'Keyboard shortcuts',
    'Copy/paste with formats',
    'Undo/redo',
    'Grouping/aggregation',
    'Large dataset handling',
    'Import/export',
    'Custom styling'
  ],
  
  scores: {
    notion: [8, 3, 9, 6, 7, 8, 7, 4, 6, 8], // /10 scale
    clickup: [7, 2, 8, 5, 6, 7, 8, 5, 7, 7],
    monday: [6, 1, 9, 4, 5, 6, 9, 6, 8, 9],
    our_target: [10, 9, 10, 10, 10, 10, 10, 10, 9, 8]
  }
}
```

## Performance Dashboard

```typescript
// Real-time performance dashboard component
function PerformanceDashboard() {
  const tracker = performanceTracker$.use()
  const memory = memoryBenchmarks$.use()
  
  if (!tracker.enabled) return null
  
  return (
    <div className="performance-dashboard fixed top-4 right-4 bg-background border rounded-lg p-4 shadow-lg z-50">
      <h3 className="font-semibold mb-3">Table Performance</h3>
      
      {/* Operation timings */}
      <div className="space-y-2 text-xs">
        {Object.entries(tracker.operations).map(([op, stats]) => (
          <div key={op} className="flex justify-between">
            <span>{op}:</span>
            <span className={stats.averageTime > 50 ? 'text-red-500' : 'text-green-500'}>
              {stats.averageTime.toFixed(1)}ms
            </span>
          </div>
        ))}
      </div>
      
      {/* Memory usage */}
      <div className="mt-4 pt-3 border-t text-xs">
        <div className="flex justify-between">
          <span>Memory:</span>
          <span>{(memory.current / 1024 / 1024).toFixed(1)}MB</span>
        </div>
        <div className="flex justify-between">
          <span>Peak:</span>
          <span>{(memory.peak / 1024 / 1024).toFixed(1)}MB</span>
        </div>
      </div>
      
      {/* Alerts */}
      {memory.alerts.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-xs text-red-500">
            ⚠ {memory.alerts.length} performance alerts
          </div>
        </div>
      )}
    </div>
  )
}

// Toggle performance monitoring
function togglePerformanceMode() {
  const enabled = performanceTracker$.enabled.get()
  performanceTracker$.enabled.set(!enabled)
  
  if (!enabled) {
    console.log('🔍 Performance monitoring enabled')
  } else {
    console.log('📊 Performance monitoring disabled')
  }
}
```

These benchmarks ensure UltraTable maintains superior performance while delivering professional spreadsheet capabilities through optimized Legend State patterns.
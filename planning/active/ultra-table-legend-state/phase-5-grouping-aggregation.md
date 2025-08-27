# Phase 5: Grouping & Aggregation (Legend State Computed)

## Overview

Implement advanced grouping, pivoting, and aggregation features using Legend State's computed observables and reactive patterns. No external libraries - leverage JavaScript's native grouping and Legend State's reactivity for real-time updates.

## Features to Implement

### 5.1 Dynamic Grouping System

**Current**: Flat table view
**Target**: Multi-level grouping with collapsible sections

```typescript
// Grouping configuration state
const tableGrouping$ = observable({
  // Active grouping configuration
  groups: [] as Array<{
    field: string
    direction: 'asc' | 'desc'
    type: 'field' | 'formula' | 'custom'
    customFn?: (value: any) => string // Custom grouping function
  }>,
  
  // Group display settings
  display: {
    showCounts: true,
    showSummaries: true,
    expandedGroups: new Set<string>(), // Group keys that are expanded
    defaultExpanded: true,
    indentSize: 20 // px per level
  },
  
  // Aggregation settings per group level
  aggregations: {} as Record<string, Array<{
    field: string
    operation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last'
    label?: string
  }>>
})

// Computed: Grouped data structure
const groupedData$ = computed(() => {
  const data = sortedData$.get()
  const groups = tableGrouping$.groups.get()
  
  if (groups.length === 0) return { flat: data, grouped: null }
  
  // Build nested group structure
  const grouped = buildGroupHierarchy(data, groups, 0)
  
  return { flat: data, grouped }
})

// Recursive grouping with Legend State
function buildGroupHierarchy(data: any[], groups: any[], level: number): GroupNode {
  if (level >= groups.length) {
    return { type: 'leaf', data, children: null }
  }
  
  const currentGroup = groups[level]
  const groupMap = new Map<string, any[]>()
  
  // Group data by current field
  data.forEach(row => {
    const groupKey = getGroupKey(row, currentGroup)
    
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, [])
    }
    groupMap.get(groupKey)!.push(row)
  })
  
  // Recursively group child levels
  const children = new Map<string, GroupNode>()
  
  groupMap.forEach((groupData, groupKey) => {
    children.set(groupKey, buildGroupHierarchy(groupData, groups, level + 1))
  })
  
  return {
    type: 'group',
    level,
    field: currentGroup.field,
    data,
    children,
    aggregations: calculateGroupAggregations(data, level)
  }
}

interface GroupNode {
  type: 'group' | 'leaf'
  level?: number
  field?: string
  data: any[]
  children: Map<string, GroupNode> | null
  aggregations?: Record<string, any>
}

// Group key generation with custom functions
function getGroupKey(row: any, group: any): string {
  const value = row[group.field]
  
  switch (group.type) {
    case 'custom':
      return group.customFn ? group.customFn(value) : String(value)
      
    case 'formula':
      // Could implement formula-based grouping
      return String(value)
      
    default: // field
      // Handle common grouping patterns
      if (value instanceof Date) {
        return value.toLocaleDateString()
      }
      if (typeof value === 'number') {
        return value.toString()
      }
      return String(value || 'Ungrouped')
  }
}
```

### 5.2 Real-Time Aggregations

**Current**: No aggregations
**Target**: Live computed aggregations per group

```typescript
// Aggregation calculation engine
const aggregationEngine$ = observable({
  cache: {} as Record<string, Record<string, any>>, // groupKey -> field -> result
  isCalculating: false,
  lastUpdate: 0
})

// Computed aggregations for each group
function calculateGroupAggregations(data: any[], level: number): Record<string, any> {
  const aggregations = tableGrouping$.aggregations[level].get() || []
  const results: Record<string, any> = {}
  
  aggregations.forEach(agg => {
    const values = data.map(row => row[agg.field]).filter(v => v != null)
    
    switch (agg.operation) {
      case 'sum':
        results[agg.field] = values.reduce((acc, val) => acc + (parseFloat(val) || 0), 0)
        break
        
      case 'avg':
        const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n))
        results[agg.field] = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
        break
        
      case 'count':
        results[agg.field] = values.length
        break
        
      case 'min':
        results[agg.field] = Math.min(...values.map(v => parseFloat(v)).filter(n => !isNaN(n)))
        break
        
      case 'max':
        results[agg.field] = Math.max(...values.map(v => parseFloat(v)).filter(n => !isNaN(n)))
        break
        
      case 'first':
        results[agg.field] = values[0]
        break
        
      case 'last':
        results[agg.field] = values[values.length - 1]
        break
    }
  })
  
  return results
}

// Reactive aggregation updates
when(() => [tableData$.get(), tableGrouping$.get()], () => {
  // Recalculate all aggregations when data or grouping changes
  recalculateAggregations()
})

function recalculateAggregations() {
  const grouped = groupedData$.get()
  
  if (!grouped.grouped) return
  
  batch(() => {
    aggregationEngine$.isCalculating.set(true)
    
    // Clear cache
    aggregationEngine$.cache.set({})
    
    // Recalculate recursively
    updateGroupAggregations(grouped.grouped, '')
    
    aggregationEngine$.assign({
      isCalculating: false,
      lastUpdate: Date.now()
    })
  })
}

function updateGroupAggregations(node: GroupNode, groupPath: string) {
  if (node.type === 'leaf') return
  
  node.children?.forEach((child, groupKey) => {
    const childPath = groupPath ? `${groupPath}/${groupKey}` : groupKey
    
    // Calculate aggregations for this group
    const aggregations = calculateGroupAggregations(child.data, node.level || 0)
    aggregationEngine$.cache[childPath].set(aggregations)
    
    // Recurse into child groups
    if (child.type === 'group') {
      updateGroupAggregations(child, childPath)
    }
  })
}
```

### 5.3 Collapsible Group UI

**Current**: Flat rows
**Target**: Expandable group headers with summaries

```typescript
// Group rendering component
function GroupedTableView() {
  const grouped = groupedData$.use()
  const grouping = tableGrouping$.use()
  
  if (!grouped.grouped) {
    // Fallback to flat view
    return <FlatTableView data={grouped.flat} />
  }
  
  return (
    <div className="grouped-table-view">
      <GroupNodeRenderer 
        node={grouped.grouped}
        path=""
        level={0}
      />
    </div>
  )
}

function GroupNodeRenderer({ 
  node, 
  path, 
  level 
}: { 
  node: GroupNode
  path: string
  level: number 
}) {
  const grouping = tableGrouping$.display.use()
  
  if (node.type === 'leaf') {
    return (
      <>
        {node.data.map((row, index) => (
          <TableRow 
            key={row.id || index}
            row={row}
            rowIndex={index}
            level={level}
          />
        ))}
      </>
    )
  }
  
  return (
    <>
      {Array.from(node.children?.entries() || []).map(([groupKey, childNode]) => {
        const groupPath = path ? `${path}/${groupKey}` : groupKey
        const isExpanded = grouping.expandedGroups.has(groupPath)
        const aggregations = aggregationEngine$.cache[groupPath].use() || {}
        
        return (
          <div key={groupPath}>
            {/* Group header */}
            <GroupHeader
              groupKey={groupKey}
              groupPath={groupPath}
              level={level}
              data={childNode.data}
              aggregations={aggregations}
              isExpanded={isExpanded}
              onToggle={() => toggleGroupExpansion(groupPath)}
            />
            
            {/* Group content */}
            {isExpanded && (
              <div style={{ marginLeft: grouping.indentSize * (level + 1) }}>
                <GroupNodeRenderer
                  node={childNode}
                  path={groupPath}
                  level={level + 1}
                />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

function GroupHeader({
  groupKey,
  groupPath,
  level,
  data,
  aggregations,
  isExpanded,
  onToggle
}: {
  groupKey: string
  groupPath: string
  level: number
  data: any[]
  aggregations: Record<string, any>
  isExpanded: boolean
  onToggle: () => void
}) {
  const grouping = tableGrouping$.display.use()
  
  return (
    <div 
      className={cn(
        'group-header flex items-center gap-2 py-2 px-3',
        'bg-muted/50 border-y cursor-pointer hover:bg-muted/70',
        `level-${level}`
      )}
      onClick={onToggle}
      style={{ marginLeft: grouping.indentSize * level }}
    >
      {/* Expand/collapse icon */}
      <div className="w-4 h-4 flex items-center justify-center">
        {isExpanded ? '▼' : '▶'}
      </div>
      
      {/* Group label */}
      <div className="font-medium">
        {groupKey}
      </div>
      
      {/* Row count */}
      {grouping.showCounts && (
        <Badge variant="secondary" className="text-xs">
          {data.length} rows
        </Badge>
      )}
      
      {/* Aggregation summaries */}
      {grouping.showSummaries && Object.keys(aggregations).length > 0 && (
        <div className="flex gap-3 ml-auto text-sm text-muted-foreground">
          {Object.entries(aggregations).map(([field, value]) => (
            <span key={field}>
              {field}: {formatAggregationValue(value, field)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Group expansion management
function toggleGroupExpansion(groupPath: string) {
  const expanded = tableGrouping$.display.expandedGroups.get()
  
  if (expanded.has(groupPath)) {
    expanded.delete(groupPath)
  } else {
    expanded.add(groupPath)
  }
  
  tableGrouping$.display.expandedGroups.set(new Set(expanded))
}
```

### 5.4 Pivot Table Support

**Current**: Linear grouping
**Target**: Excel-style pivot tables

```typescript
// Pivot table configuration
const pivotConfig$ = observable({
  isActive: false,
  
  // Pivot structure
  rows: [] as string[], // Row grouping fields
  columns: [] as string[], // Column grouping fields  
  values: [] as Array<{
    field: string
    operation: 'sum' | 'count' | 'avg' | 'min' | 'max'
    label?: string
  }>,
  
  // Filters
  filters: {} as Record<string, {
    type: 'include' | 'exclude'
    values: Set<any>
  }>,
  
  // Display options
  showTotals: true,
  showSubtotals: true,
  showGrandTotal: true
})

// Computed: Pivot table data
const pivotData$ = computed(() => {
  const config = pivotConfig$.get()
  const data = filteredData$.get()
  
  if (!config.isActive || config.rows.length === 0) {
    return null
  }
  
  return buildPivotTable(data, config)
})

// Pivot table builder
function buildPivotTable(data: any[], config: any) {
  // Apply filters first
  const filteredData = data.filter(row => {
    return Object.entries(config.filters).every(([field, filter]) => {
      const value = row[field]
      return filter.type === 'include' ? 
        filter.values.has(value) : 
        !filter.values.has(value)
    })
  })
  
  // Build row groups
  const rowGroups = buildPivotGroups(filteredData, config.rows)
  
  // Build column groups (if any)
  const columnGroups = config.columns.length > 0 ? 
    buildPivotGroups(filteredData, config.columns) : null
  
  // Calculate pivot values
  const pivotMatrix = calculatePivotMatrix(rowGroups, columnGroups, config.values)
  
  return {
    rowGroups,
    columnGroups,
    matrix: pivotMatrix,
    totals: calculatePivotTotals(pivotMatrix, config)
  }
}

// Pivot table UI component
function PivotTableView() {
  const pivotData = pivotData$.use()
  const config = pivotConfig$.use()
  
  if (!pivotData) return null
  
  return (
    <div className="pivot-table-container">
      {/* Pivot configuration panel */}
      <PivotConfigPanel />
      
      {/* Pivot table */}
      <div className="pivot-table overflow-auto">
        <table className="w-full border-collapse">
          {/* Column headers */}
          <PivotColumnHeaders 
            columnGroups={pivotData.columnGroups}
            values={config.values}
          />
          
          {/* Row data with grouping */}
          <tbody>
            <PivotRowGroups 
              rowGroups={pivotData.rowGroups}
              matrix={pivotData.matrix}
              level={0}
            />
            
            {/* Grand totals */}
            {config.showGrandTotal && (
              <PivotGrandTotals 
                totals={pivotData.totals}
                columnCount={getColumnCount(pivotData)}
              />
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

### 5.5 Advanced Aggregation Functions

**Current**: Basic counting
**Target**: Comprehensive statistical operations

```typescript
// Advanced aggregation library
const aggregationFunctions = {
  // Basic operations
  sum: (values: number[]) => values.reduce((a, b) => a + b, 0),
  count: (values: any[]) => values.length,
  avg: (values: number[]) => values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
  min: (values: number[]) => Math.min(...values),
  max: (values: number[]) => Math.max(...values),
  
  // Statistical operations
  median: (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? 
      (sorted[mid - 1] + sorted[mid]) / 2 : 
      sorted[mid]
  },
  
  mode: (values: any[]) => {
    const frequency = new Map()
    let maxCount = 0
    let mode = values[0]
    
    values.forEach(value => {
      const count = (frequency.get(value) || 0) + 1
      frequency.set(value, count)
      
      if (count > maxCount) {
        maxCount = count
        mode = value
      }
    })
    
    return mode
  },
  
  stddev: (values: number[]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length
    return Math.sqrt(variance)
  },
  
  // Text aggregations
  concat: (values: any[], separator = ', ') => values.join(separator),
  unique: (values: any[]) => [...new Set(values)],
  
  // Date aggregations  
  earliest: (values: Date[]) => new Date(Math.min(...values.map(d => d.getTime()))),
  latest: (values: Date[]) => new Date(Math.max(...values.map(d => d.getTime()))),
  
  // Conditional aggregations
  countIf: (values: any[], condition: (value: any) => boolean) => {
    return values.filter(condition).length
  },
  
  sumIf: (values: number[], condition: (value: number, index: number) => boolean) => {
    return values.reduce((sum, val, index) => 
      condition(val, index) ? sum + val : sum, 0
    )
  }
}

// Dynamic aggregation with Legend State computed
const dynamicAggregations$ = computed(() => {
  const grouped = groupedData$.get()
  const config = tableGrouping$.get()
  
  if (!grouped.grouped) return {}
  
  const results: Record<string, Record<string, any>> = {}
  
  // Calculate aggregations for each group
  calculateGroupAggregationsRecursive(grouped.grouped, '', results)
  
  return results
})

function calculateGroupAggregationsRecursive(
  node: GroupNode, 
  path: string, 
  results: Record<string, Record<string, any>>
) {
  if (node.type === 'leaf') return
  
  node.children?.forEach((child, groupKey) => {
    const childPath = path ? `${path}/${groupKey}` : groupKey
    
    // Calculate aggregations for this group
    const groupAggregations = tableGrouping$.aggregations[node.level || 0].get() || []
    const aggregationResults: Record<string, any> = {}
    
    groupAggregations.forEach(agg => {
      const values = child.data.map(row => row[agg.field]).filter(v => v != null)
      const fn = aggregationFunctions[agg.operation]
      
      if (fn) {
        aggregationResults[agg.field] = fn(values)
      }
    })
    
    results[childPath] = aggregationResults
    
    // Recurse into child groups
    if (child.type === 'group') {
      calculateGroupAggregationsRecursive(child, childPath, results)
    }
  })
}
```

### 5.6 Group Management UI

**Current**: No grouping controls
**Target**: Drag-and-drop group configuration

```typescript
// Group configuration panel
function GroupingPanel() {
  const grouping = tableGrouping$.use()
  const columns = tableColumns$.use()
  const availableFields = columns.filter(col => 
    !grouping.groups.some(g => g.field === col.field)
  )
  
  return (
    <div className="grouping-panel border-b p-4 bg-muted/30">
      <div className="flex items-center gap-4">
        {/* Group by label */}
        <span className="text-sm font-medium">Group by:</span>
        
        {/* Active groups */}
        <div className="flex gap-2 flex-wrap">
          {grouping.groups.map((group, index) => (
            <GroupChip
              key={`${group.field}-${index}`}
              group={group}
              index={index}
              onRemove={() => removeGroup(index)}
              onReorder={(newIndex) => reorderGroup(index, newIndex)}
            />
          ))}
          
          {/* Add group dropdown */}
          {availableFields.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  + Add Group
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {availableFields.map(field => (
                  <DropdownMenuItem
                    key={field.field}
                    onClick={() => addGroup(field.field)}
                  >
                    {field.header}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {/* Group options */}
        <div className="flex gap-2 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => expandAllGroups()}
          >
            Expand All
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => collapseAllGroups()}
          >
            Collapse All
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearGrouping()}
          >
            Clear
          </Button>
        </div>
      </div>
      
      {/* Aggregation settings */}
      {grouping.groups.length > 0 && (
        <AggregationSettings />
      )}
    </div>
  )
}

function GroupChip({ 
  group, 
  index, 
  onRemove, 
  onReorder 
}: {
  group: any
  index: number
  onRemove: () => void
  onReorder: (newIndex: number) => void
}) {
  return (
    <div 
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-md border',
        'bg-primary/10 text-primary text-xs font-medium',
        'cursor-grab active:cursor-grabbing'
      )}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', index.toString())
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'))
        onReorder(sourceIndex)
      }}
    >
      <span>{getColumnHeader(group.field)}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="hover:text-destructive"
      >
        ×
      </button>
    </div>
  )
}

// Group management functions
function addGroup(field: string) {
  tableGrouping$.groups.push({
    field,
    direction: 'asc',
    type: 'field'
  })
}

function removeGroup(index: number) {
  const groups = tableGrouping$.groups.get()
  tableGrouping$.groups.set(groups.filter((_, i) => i !== index))
}

function reorderGroup(fromIndex: number, toIndex: number) {
  const groups = [...tableGrouping$.groups.get()]
  const [moved] = groups.splice(fromIndex, 1)
  groups.splice(toIndex, 0, moved)
  tableGrouping$.groups.set(groups)
}

function expandAllGroups() {
  const grouped = groupedData$.get()
  if (!grouped.grouped) return
  
  const allPaths = getAllGroupPaths(grouped.grouped, '')
  tableGrouping$.display.expandedGroups.set(new Set(allPaths))
}

function collapseAllGroups() {
  tableGrouping$.display.expandedGroups.set(new Set())
}
```

### 5.7 Performance Optimization for Large Groups

**Current**: Not applicable
**Target**: Handle 10k+ groups efficiently

```typescript
// Virtual grouping for performance
const virtualGrouping$ = observable({
  enabled: false,
  threshold: 1000, // Enable when > 1000 groups
  visibleRange: { start: 0, end: 100 },
  groupHeight: 32,
  estimatedTotalHeight: 0
})

// Computed: Virtualized group list
const virtualizedGroups$ = computed(() => {
  const grouped = groupedData$.get()
  const virtual = virtualGrouping$.get()
  
  if (!virtual.enabled || !grouped.grouped) {
    return { items: [], totalHeight: 0 }
  }
  
  const flatGroups = flattenGroupHierarchy(grouped.grouped)
  const visibleGroups = flatGroups.slice(virtual.visibleRange.start, virtual.visibleRange.end)
  
  return {
    items: visibleGroups,
    totalHeight: flatGroups.length * virtual.groupHeight
  }
})

// Group virtualization component
function VirtualizedGroupView() {
  const virtualized = virtualizedGroups$.use()
  const virtual = virtualGrouping$.use()
  
  return (
    <div 
      className="virtual-group-container"
      style={{ height: virtualized.totalHeight }}
    >
      <div 
        className="virtual-group-content"
        style={{ 
          transform: `translateY(${virtual.visibleRange.start * virtual.groupHeight}px)` 
        }}
      >
        {virtualized.items.map((group, index) => (
          <VirtualGroupItem
            key={group.path}
            group={group}
            index={virtual.visibleRange.start + index}
          />
        ))}
      </div>
    </div>
  )
}

// Optimized group calculations with memoization
const memoizedAggregations = new Map<string, Record<string, any>>()

function calculateAggregationsMemoized(groupData: any[], groupPath: string, aggregations: any[]) {
  const cacheKey = `${groupPath}-${groupData.length}-${aggregations.map(a => a.field).join(',')}`
  
  if (memoizedAggregations.has(cacheKey)) {
    return memoizedAggregations.get(cacheKey)!
  }
  
  const results = calculateGroupAggregations(groupData, 0)
  memoizedAggregations.set(cacheKey, results)
  
  return results
}

// Clear aggregation cache when data changes
when(() => tableData$.get(), () => {
  memoizedAggregations.clear()
})
```

## Implementation Priority

### High Priority (Week 5)
1. ✅ Multi-level grouping with collapsible UI
2. ✅ Real-time aggregations using computed observables
3. ✅ Group management panel with drag-and-drop
4. ✅ Performance optimization for large group counts

### Medium Priority (Week 6)
1. Pivot table support with cross-tabulation
2. Advanced aggregation functions
3. Group export/import configurations
4. Custom grouping functions

### Lower Priority (Week 7)
1. Group-based filtering and search
2. Group styling and customization
3. Group-level permissions and access
4. Integration with chart/visualization libraries

## Performance Targets

### Grouping Performance
- **1k groups**: Render in <100ms
- **10k groups**: Virtual scrolling active
- **100k rows**: Group calculation <500ms
- **Memory usage**: <50MB for 10k groups

### Aggregation Performance
- **Real-time updates**: <50ms after data change
- **Complex aggregations**: <200ms for statistical functions
- **Batch operations**: Process 1000+ rows without blocking UI
- **Cache efficiency**: 90%+ cache hit rate for repeated calculations

## Testing Strategy

### Grouping Tests
- Single-level grouping with various data types
- Multi-level grouping (3+ levels deep)
- Large group counts (1000+ unique groups)
- Group expansion/collapse performance

### Aggregation Tests
- All aggregation functions with edge cases
- Real-time updates when underlying data changes
- Performance with large datasets
- Memory usage with complex group structures

### UI Tests
- Drag-and-drop group reordering
- Group configuration persistence
- Keyboard navigation in grouped view
- Export/import of grouped data

This phase delivers enterprise-level grouping and aggregation capabilities using only Legend State's reactive system, providing real-time performance that exceeds traditional spreadsheet applications.
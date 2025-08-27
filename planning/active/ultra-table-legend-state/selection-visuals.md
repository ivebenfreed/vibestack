# Selection Visual System (Professional Grade)

## Overview

Excel/Google Sheets-quality selection visuals using CSS-in-JS, SVG overlays, and animated feedback. All rendered via React Portals for zero table performance impact.

## Visual Components

### 1.1 Multi-Layer Selection Rendering

**Current**: Basic blue border
**Target**: Professional multi-layer visual system

```typescript
// Selection visual state
const selectionVisuals$ = observable({
  // Visual layers
  layers: {
    cellBorders: true,
    rangeFills: true,
    activeCell: true,
    fillHandle: true,
    marching_ants: false // Excel-style animated borders
  },
  
  // Visual themes
  theme: {
    primary: 'rgb(59, 130, 246)', // Blue-500
    primaryAlpha: 'rgba(59, 130, 246, 0.1)',
    secondary: 'rgb(168, 85, 247)', // Purple-500
    fill: 'rgb(34, 197, 94)', // Green-500
    error: 'rgb(239, 68, 68)', // Red-500
    
    // Animation settings
    animationDuration: 200,
    marchingAntsSpeed: 1000,
    fillHandleSize: 6
  },
  
  // Performance settings
  performance: {
    useCSS: true, // CSS transforms vs JS positioning
    useCanvas: false, // Canvas overlay for complex selections
    maxOverlays: 50 // Limit concurrent overlays
  }
})

// Primary selection overlay system
function SelectionVisualsOverlay() {
  const visuals = selectionVisuals$.use()
  const selection = tableSelection$.use()
  
  return createPortal(
    <div className="selection-overlay-container absolute inset-0 pointer-events-none z-30">
      {/* Cell borders layer */}
      {visuals.layers.cellBorders && (
        <CellBordersLayer />
      )}
      
      {/* Range fills layer */}
      {visuals.layers.rangeFills && (
        <RangeFillsLayer />
      )}
      
      {/* Active cell indicator */}
      {visuals.layers.activeCell && selection.activeCell && (
        <ActiveCellIndicator cell={selection.activeCell} />
      )}
      
      {/* Fill handle */}
      {visuals.layers.fillHandle && selection.activeCell && (
        <FillHandle cell={selection.activeCell} />
      )}
      
      {/* Marching ants for large selections */}
      {visuals.layers.marching_ants && (
        <MarchingAntsLayer />
      )}
    </div>,
    document.querySelector('[data-table-container]') || document.body
  )
}
```

### 1.2 Advanced Cell Border System

**Current**: Simple border overlay
**Target**: Excel-style precise borders with corner indicators

```typescript
// Cell borders with precise positioning
function CellBordersLayer() {
  const ranges = tableSelection$.ranges.use()
  const theme = selectionVisuals$.theme.use()
  
  return (
    <svg className="absolute inset-0 w-full h-full overflow-visible">
      {ranges.map(range => (
        <SelectionBorderSVG
          key={range.id}
          range={range}
          color={theme.primary}
          thickness={2}
          style="solid"
        />
      ))}
    </svg>
  )
}

function SelectionBorderSVG({ 
  range, 
  color, 
  thickness = 2, 
  style = 'solid' 
}: {
  range: { start: { row: number; col: number }; end: { row: number; col: number } }
  color: string
  thickness: number
  style: 'solid' | 'dashed' | 'dotted'
}) {
  const startCell = getCellRect(range.start.row, range.start.col)
  const endCell = getCellRect(range.end.row, range.end.col)
  
  if (!startCell || !endCell) return null
  
  const rect = {
    x: startCell.left,
    y: startCell.top,
    width: endCell.right - startCell.left,
    height: endCell.bottom - startCell.top
  }
  
  return (
    <g>
      {/* Main border rectangle */}
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeDasharray={style === 'dashed' ? '5,5' : style === 'dotted' ? '2,2' : 'none'}
        className="selection-border"
      />
      
      {/* Corner resize handles */}
      <SelectionCorners rect={rect} color={color} />
      
      {/* Range info tooltip */}
      <SelectionTooltip range={range} position={rect} />
    </g>
  )
}

// Corner indicators for resize operations
function SelectionCorners({ 
  rect, 
  color 
}: { 
  rect: { x: number; y: number; width: number; height: number }
  color: string 
}) {
  const cornerSize = 6
  const corners = [
    { x: rect.x - cornerSize/2, y: rect.y - cornerSize/2, position: 'top-left' },
    { x: rect.x + rect.width - cornerSize/2, y: rect.y - cornerSize/2, position: 'top-right' },
    { x: rect.x - cornerSize/2, y: rect.y + rect.height - cornerSize/2, position: 'bottom-left' },
    { x: rect.x + rect.width - cornerSize/2, y: rect.y + rect.height - cornerSize/2, position: 'bottom-right' }
  ]
  
  return (
    <>
      {corners.map(corner => (
        <rect
          key={corner.position}
          x={corner.x}
          y={corner.y}
          width={cornerSize}
          height={cornerSize}
          fill={color}
          className="selection-corner cursor-nw-resize"
          data-corner={corner.position}
        />
      ))}
    </>
  )
}
```

### 1.3 Range Fill Visualization

**Current**: No fill background
**Target**: Semi-transparent fills with gradients

```typescript
// Range fills with visual hierarchy
function RangeFillsLayer() {
  const ranges = tableSelection$.ranges.use()
  const dragRange = dragRange$.use()
  const theme = selectionVisuals$.theme.use()
  
  return (
    <>
      {/* Committed selection fills */}
      {ranges.map((range, index) => (
        <SelectionFill
          key={range.id}
          range={range}
          fillColor={theme.primaryAlpha}
          opacity={0.1 + (index * 0.05)} // Layer different ranges
          zIndex={10 + index}
        />
      ))}
      
      {/* Active drag fill */}
      {dragRange && (
        <SelectionFill
          range={dragRange}
          fillColor={theme.primaryAlpha}
          opacity={0.15}
          zIndex={20}
          animated={true}
        />
      )}
    </>
  )
}

function SelectionFill({ 
  range, 
  fillColor, 
  opacity = 0.1, 
  zIndex = 10,
  animated = false 
}: {
  range: { start: { row: number; col: number }; end: { row: number; col: number } }
  fillColor: string
  opacity: number
  zIndex: number
  animated?: boolean
}) {
  const startCell = getCellRect(range.start.row, range.start.col)
  const endCell = getCellRect(range.end.row, range.end.col)
  
  if (!startCell || !endCell) return null
  
  return (
    <div
      className={cn(
        'absolute pointer-events-none',
        animated && 'animate-pulse'
      )}
      style={{
        top: startCell.top,
        left: startCell.left,
        width: endCell.right - startCell.left,
        height: endCell.bottom - startCell.top,
        backgroundColor: fillColor,
        opacity,
        zIndex,
        borderRadius: '2px'
      }}
    />
  )
}
```

### 1.4 Active Cell Visual Indicator

**Current**: Basic border
**Target**: Excel-style thick border with corner fill handle

```typescript
// Active cell with professional styling
function ActiveCellIndicator({ cell }: { cell: { row: number; col: number } }) {
  const theme = selectionVisuals$.theme.use()
  const cellRect = getCellRect(cell.row, cell.col)
  
  if (!cellRect) return null
  
  return (
    <>
      {/* Thick border around active cell */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: cellRect.top - 2,
          left: cellRect.left - 2,
          width: cellRect.width + 4,
          height: cellRect.height + 4,
          border: `3px solid ${theme.primary}`,
          borderRadius: '3px',
          boxShadow: `0 0 0 1px white, 0 0 8px ${theme.primary}40`,
          zIndex: 25
        }}
      />
      
      {/* Active cell content highlight */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: cellRect.top,
          left: cellRect.left,
          width: cellRect.width,
          height: cellRect.height,
          backgroundColor: `${theme.primary}08`,
          zIndex: 24
        }}
      />
      
      {/* Cell coordinate indicator */}
      <ActiveCellCoordinate cell={cell} position={cellRect} />
    </>
  )
}

function ActiveCellCoordinate({ 
  cell, 
  position 
}: { 
  cell: { row: number; col: number }
  position: { top: number; left: number; width: number; height: number }
}) {
  const cellRef = `${indexToColumnLetter(cell.col)}${cell.row + 1}`
  
  return (
    <div
      className="absolute pointer-events-none bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-mono shadow-lg"
      style={{
        top: position.top - 32,
        left: position.left,
        zIndex: 30,
        animation: 'fadeIn 200ms ease-out'
      }}
    >
      {cellRef}
    </div>
  )
}
```

### 1.5 Fill Handle with Visual Feedback

**Current**: Basic square handle
**Target**: Excel-style fill handle with preview

```typescript
// Professional fill handle
function FillHandle({ cell }: { cell: { row: number; col: number } }) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragPreview, setDragPreview] = useState<{ row: number; col: number } | null>(null)
  const theme = selectionVisuals$.theme.use()
  
  const cellRect = getCellRect(cell.row, cell.col)
  if (!cellRect) return null
  
  const handleSize = theme.fillHandleSize
  const handlePosition = {
    top: cellRect.bottom - handleSize/2,
    left: cellRect.right - handleSize/2
  }
  
  return (
    <>
      {/* Fill handle dot */}
      <div
        className="absolute cursor-crosshair z-40"
        style={{
          top: handlePosition.top,
          left: handlePosition.left,
          width: handleSize,
          height: handleSize,
          backgroundColor: theme.primary,
          border: '2px solid white',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
        onMouseDown={(e) => startFillDrag(e, cell)}
        onMouseEnter={() => setShowFillCursor(true)}
        onMouseLeave={() => setShowFillCursor(false)}
      />
      
      {/* Fill preview during drag */}
      {isDragging && dragPreview && (
        <FillPreviewOverlay
          startCell={cell}
          endCell={dragPreview}
          pattern={detectFillPattern(cell)}
        />
      )}
    </>
  )
}

// Fill preview overlay
function FillPreviewOverlay({ 
  startCell, 
  endCell, 
  pattern 
}: {
  startCell: { row: number; col: number }
  endCell: { row: number; col: number }
  pattern: string
}) {
  const startRect = getCellRect(startCell.row, startCell.col)
  const endRect = getCellRect(endCell.row, endCell.col)
  const theme = selectionVisuals$.theme.use()
  
  if (!startRect || !endRect) return null
  
  const fillRect = {
    top: Math.min(startRect.top, endRect.top),
    left: Math.min(startRect.left, endRect.left),
    right: Math.max(startRect.right, endRect.right),
    bottom: Math.max(startRect.bottom, endRect.bottom)
  }
  
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: fillRect.top,
        left: fillRect.left,
        width: fillRect.right - fillRect.left,
        height: fillRect.bottom - fillRect.top,
        border: `2px dashed ${theme.fill}`,
        backgroundColor: `${theme.fill}20`,
        zIndex: 35,
        animation: 'dashOffset 1s linear infinite'
      }}
    >
      {/* Pattern indicator */}
      <div 
        className="absolute -top-8 left-0 bg-background border rounded px-2 py-1 text-xs font-medium shadow-lg"
        style={{ color: theme.fill }}
      >
        Fill: {pattern}
      </div>
    </div>
  )
}
```

### 1.6 Column/Row Selection Visuals

**Current**: No column/row selection
**Target**: Full column/row highlighting

```typescript
// Column and row selection overlays
function ColumnRowSelectionLayer() {
  const columnSelection = tableSelection$.columnSelection.use()
  const rowSelection = tableSelection$.rowSelection.use()
  const theme = selectionVisuals$.theme.use()
  
  return (
    <>
      {/* Selected columns */}
      {columnSelection.map(colIndex => (
        <ColumnHighlight 
          key={`col-${colIndex}`}
          columnIndex={colIndex}
          color={theme.secondary}
        />
      ))}
      
      {/* Selected rows */}
      {rowSelection.map(rowIndex => (
        <RowHighlight
          key={`row-${rowIndex}`}
          rowIndex={rowIndex}
          color={theme.secondary}
        />
      ))}
    </>
  )
}

function ColumnHighlight({ 
  columnIndex, 
  color 
}: { 
  columnIndex: number
  color: string 
}) {
  const tableContainer = document.querySelector('[data-table-container]')
  if (!tableContainer) return null
  
  const containerRect = tableContainer.getBoundingClientRect()
  const firstCell = getCellRect(0, columnIndex)
  
  if (!firstCell) return null
  
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: 0,
        left: firstCell.left,
        width: firstCell.width,
        height: containerRect.height,
        backgroundColor: `${color}15`,
        borderLeft: `3px solid ${color}`,
        borderRight: `3px solid ${color}`,
        zIndex: 15
      }}
    />
  )
}

function RowHighlight({ 
  rowIndex, 
  color 
}: { 
  rowIndex: number
  color: string 
}) {
  const tableContainer = document.querySelector('[data-table-container]')
  if (!tableContainer) return null
  
  const containerRect = tableContainer.getBoundingClientRect()
  const firstCell = getCellRect(rowIndex, 0)
  
  if (!firstCell) return null
  
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: firstCell.top,
        left: 0,
        width: containerRect.width,
        height: firstCell.height,
        backgroundColor: `${color}15`,
        borderTop: `3px solid ${color}`,
        borderBottom: `3px solid ${color}`,
        zIndex: 15
      }}
    />
  )
}
```

### 1.7 Animated Selection Feedback

**Current**: No animations
**Target**: Smooth transitions and micro-interactions

```typescript
// Selection animation system
const selectionAnimations$ = observable({
  // Animation states
  expanding: new Set<string>(), // Range IDs currently expanding
  contracting: new Set<string>(), // Range IDs currently contracting
  pulsing: new Set<string>(), // Active elements
  
  // Animation settings
  settings: {
    expandDuration: 200,
    contractDuration: 150,
    pulseInterval: 1000,
    easeType: 'cubic-bezier(0.4, 0, 0.2, 1)' // Tailwind's ease-out
  }
})

// Animated selection range
function AnimatedSelectionRange({ 
  range, 
  type 
}: { 
  range: any
  type: 'committed' | 'dragging' | 'new' 
}) {
  const [isVisible, setIsVisible] = useState(false)
  const animations = selectionAnimations$.use()
  
  // Entrance animation
  useEffect(() => {
    if (type === 'new') {
      setIsVisible(true)
      selectionAnimations$.expanding.get().add(range.id)
      
      setTimeout(() => {
        selectionAnimations$.expanding.get().delete(range.id)
      }, animations.settings.expandDuration)
    } else {
      setIsVisible(true)
    }
  }, [])
  
  const startCell = getCellRect(range.start.row, range.start.col)
  const endCell = getCellRect(range.end.row, range.end.col)
  
  if (!startCell || !endCell || !isVisible) return null
  
  const isExpanding = animations.expanding.has(range.id)
  const isContracting = animations.contracting.has(range.id)
  const isPulsing = animations.pulsing.has(range.id)
  
  return (
    <div
      className={cn(
        'absolute pointer-events-none',
        'border-2 border-primary',
        isExpanding && 'animate-in zoom-in duration-200',
        isContracting && 'animate-out zoom-out duration-150',
        isPulsing && 'animate-pulse'
      )}
      style={{
        top: startCell.top,
        left: startCell.left,
        width: endCell.right - startCell.left,
        height: endCell.bottom - startCell.top,
        backgroundColor: type === 'dragging' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
        borderRadius: '3px',
        boxShadow: '0 0 0 1px white, 0 2px 8px rgba(59, 130, 246, 0.3)',
        zIndex: type === 'dragging' ? 25 : 20,
        transition: `all ${animations.settings.expandDuration}ms ${animations.settings.easeType}`
      }}
    />
  )
}

// Marching ants animation for large selections
function MarchingAntsLayer() {
  const ranges = tableSelection$.ranges.use()
  const largeRanges = ranges.filter(range => {
    const cellCount = (range.end.row - range.start.row + 1) * (range.end.col - range.start.col + 1)
    return cellCount > 100 // Only for large selections
  })
  
  if (largeRanges.length === 0) return null
  
  return (
    <svg className="absolute inset-0 w-full h-full overflow-visible">
      <defs>
        <pattern 
          id="marching-ants" 
          patternUnits="userSpaceOnUse" 
          width="8" 
          height="8"
        >
          <rect width="8" height="8" fill="none" stroke="black" strokeWidth="1" strokeDasharray="4,4">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 8,0; 0,0"
              dur="1s"
              repeatCount="indefinite"
            />
          </rect>
        </pattern>
      </defs>
      
      {largeRanges.map(range => (
        <MarchingAntsRect key={range.id} range={range} />
      ))}
    </svg>
  )
}

function MarchingAntsRect({ range }: { range: any }) {
  const startCell = getCellRect(range.start.row, range.start.col)
  const endCell = getCellRect(range.end.row, range.end.col)
  
  if (!startCell || !endCell) return null
  
  return (
    <rect
      x={startCell.left}
      y={startCell.top}
      width={endCell.right - startCell.left}
      height={endCell.bottom - startCell.top}
      fill="none"
      stroke="url(#marching-ants)"
      strokeWidth="2"
      className="selection-marching-ants"
    />
  )
}
```

### 1.8 Selection Information Tooltips

**Current**: No selection info
**Target**: Floating info panels with selection details

```typescript
// Selection information overlay
function SelectionInfoOverlay() {
  const ranges = tableSelection$.ranges.use()
  const activeCell = tableSelection$.activeCell.use()
  const [showInfo, setShowInfo] = useState(false)
  
  // Show info for large selections or when requested
  const shouldShowInfo = ranges.some(range => {
    const cellCount = (range.end.row - range.start.row + 1) * (range.end.col - range.start.col + 1)
    return cellCount > 10
  })
  
  if (!shouldShowInfo && !showInfo) return null
  
  return createPortal(
    <div className="fixed top-4 right-4 z-50">
      <Card className="w-64 p-3 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Selection Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {/* Active cell info */}
          {activeCell && (
            <div className="flex justify-between">
              <span>Active Cell:</span>
              <span className="font-mono">
                {indexToColumnLetter(activeCell.col)}{activeCell.row + 1}
              </span>
            </div>
          )}
          
          {/* Range information */}
          {ranges.map((range, index) => {
            const cellCount = (range.end.row - range.start.row + 1) * (range.end.col - range.start.col + 1)
            const startRef = `${indexToColumnLetter(range.start.col)}${range.start.row + 1}`
            const endRef = `${indexToColumnLetter(range.end.col)}${range.end.row + 1}`
            
            return (
              <div key={range.id} className="space-y-1">
                <div className="flex justify-between">
                  <span>Range {index + 1}:</span>
                  <span className="font-mono text-xs">
                    {startRef}:{endRef}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cells:</span>
                  <span>{cellCount.toLocaleString()}</span>
                </div>
              </div>
            )
          })}
          
          {/* Selection statistics */}
          <SelectionStatistics />
        </CardContent>
      </Card>
    </div>,
    document.body
  )
}

// Live selection statistics
function SelectionStatistics() {
  const selectedData = tableComputed.selectedData$.use()
  const [stats, setStats] = useState<any>({})
  
  useEffect(() => {
    if (selectedData.length === 0) return
    
    // Calculate statistics for numeric columns
    const numericColumns = tableColumns$.get().filter(col => col.type === 'number')
    const newStats: any = {}
    
    numericColumns.forEach(column => {
      const values = selectedData
        .map(row => parseFloat(row[column.field]))
        .filter(val => !isNaN(val))
      
      if (values.length > 0) {
        newStats[column.field] = {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values)
        }
      }
    })
    
    setStats(newStats)
  }, [selectedData])
  
  if (Object.keys(stats).length === 0) return null
  
  return (
    <div className="pt-2 border-t space-y-2">
      <div className="font-medium text-xs">Statistics:</div>
      {Object.entries(stats).map(([field, fieldStats]: [string, any]) => (
        <div key={field} className="space-y-1">
          <div className="font-medium text-xs">{field}:</div>
          <div className="pl-2 space-y-0.5 text-xs">
            <div className="flex justify-between">
              <span>Sum:</span>
              <span>{fieldStats.sum.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg:</span>
              <span>{fieldStats.avg.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Count:</span>
              <span>{fieldStats.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

### 1.9 Visual Themes & Customization

**Current**: Fixed blue theme
**Target**: Multiple professional themes

```typescript
// Selection visual themes
const selectionThemes = {
  excel: {
    primary: '#1f4e79',
    primaryAlpha: 'rgba(31, 78, 121, 0.1)',
    activeCell: '#1f4e79',
    fillHandle: '#1f4e79',
    contextMenu: '#f8f9fa'
  },
  
  google_sheets: {
    primary: '#1a73e8',
    primaryAlpha: 'rgba(26, 115, 232, 0.08)',
    activeCell: '#1a73e8', 
    fillHandle: '#1a73e8',
    contextMenu: '#ffffff'
  },
  
  notion: {
    primary: '#2eaadc',
    primaryAlpha: 'rgba(46, 170, 220, 0.1)',
    activeCell: '#2eaadc',
    fillHandle: '#2eaadc',
    contextMenu: '#f7f6f3'
  },
  
  vibestack: {
    primary: 'hsl(var(--primary))',
    primaryAlpha: 'hsl(var(--primary) / 0.1)',
    activeCell: 'hsl(var(--primary))',
    fillHandle: 'hsl(var(--primary))',
    contextMenu: 'hsl(var(--background))'
  }
}

// Theme application
function applySelectionTheme(themeName: keyof typeof selectionThemes) {
  const theme = selectionThemes[themeName]
  
  selectionVisuals$.theme.assign(theme)
  
  // Apply CSS custom properties for consistent theming
  document.documentElement.style.setProperty('--selection-primary', theme.primary)
  document.documentElement.style.setProperty('--selection-primary-alpha', theme.primaryAlpha)
  document.documentElement.style.setProperty('--selection-active', theme.activeCell)
  document.documentElement.style.setProperty('--selection-fill', theme.fillHandle)
}

// CSS for selection visuals
const selectionCSS = `
  .selection-border {
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
  }
  
  .selection-corner:hover {
    transform: scale(1.2);
    transition: transform 150ms ease-out;
  }
  
  .fill-handle-dot:hover {
    transform: scale(1.3);
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    transition: all 150ms ease-out;
  }
  
  @keyframes dashOffset {
    0% { stroke-dashoffset: 0; }
    100% { stroke-dashoffset: 16; }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .selection-info-tooltip {
    animation: fadeIn 200ms ease-out;
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .selection-border {
      stroke-width: 3px;
    }
    
    .selection-fill {
      opacity: 0.3 !important;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .selection-border,
    .fill-handle-dot,
    .selection-corner {
      transition: none !important;
      animation: none !important;
    }
  }
`

// Dynamic CSS injection
function injectSelectionCSS() {
  const styleId = 'ultra-table-selection-styles'
  
  if (document.getElementById(styleId)) return
  
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = selectionCSS
  document.head.appendChild(style)
}
```

### 1.10 Canvas-Based High Performance Rendering

**Current**: DOM overlays
**Target**: Canvas rendering for complex selections (optional)

```typescript
// Canvas selection renderer for extreme performance
const canvasRenderer$ = observable({
  enabled: false,
  canvas: null as HTMLCanvasElement | null,
  context: null as CanvasRenderingContext2D | null,
  devicePixelRatio: window.devicePixelRatio || 1,
  
  // Performance thresholds
  thresholds: {
    enableCanvas: 1000, // > 1000 selected cells
    maxDOMOverlays: 50  // Switch to canvas after 50 overlays
  }
})

// Canvas selection overlay
function CanvasSelectionOverlay() {
  const canvasState = canvasRenderer$.use()
  const ranges = tableSelection$.ranges.use()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Auto-enable canvas for large selections
  useEffect(() => {
    const totalCells = ranges.reduce((total, range) => {
      return total + (range.end.row - range.start.row + 1) * (range.end.col - range.start.col + 1)
    }, 0)
    
    const shouldUseCanvas = totalCells > canvasState.thresholds.enableCanvas || 
                           ranges.length > canvasState.thresholds.maxDOMOverlays
    
    if (shouldUseCanvas !== canvasState.enabled) {
      canvasRenderer$.enabled.set(shouldUseCanvas)
    }
  }, [ranges])
  
  // Canvas rendering
  useEffect(() => {
    if (!canvasState.enabled || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Set up canvas
    const containerRect = canvas.parentElement!.getBoundingClientRect()
    canvas.width = containerRect.width * canvasState.devicePixelRatio
    canvas.height = containerRect.height * canvasState.devicePixelRatio
    canvas.style.width = `${containerRect.width}px`
    canvas.style.height = `${containerRect.height}px`
    
    ctx.scale(canvasState.devicePixelRatio, canvasState.devicePixelRatio)
    
    // Clear and render selections
    ctx.clearRect(0, 0, containerRect.width, containerRect.height)
    
    ranges.forEach((range, index) => {
      renderSelectionToCanvas(ctx, range, index)
    })
  }, [ranges, canvasState.enabled])
  
  if (!canvasState.enabled) return null
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-20"
      style={{ mixBlendMode: 'multiply' }}
    />
  )
}

function renderSelectionToCanvas(
  ctx: CanvasRenderingContext2D, 
  range: any, 
  index: number
) {
  const startCell = getCellRect(range.start.row, range.start.col)
  const endCell = getCellRect(range.end.row, range.end.col)
  
  if (!startCell || !endCell) return
  
  const theme = selectionVisuals$.theme.get()
  
  // Fill
  ctx.fillStyle = theme.primaryAlpha
  ctx.fillRect(
    startCell.left,
    startCell.top,
    endCell.right - startCell.left,
    endCell.bottom - startCell.top
  )
  
  // Border
  ctx.strokeStyle = theme.primary
  ctx.lineWidth = 2
  ctx.strokeRect(
    startCell.left,
    startCell.top,
    endCell.right - startCell.left,
    endCell.bottom - startCell.top
  )
  
  // Corner indicators
  const cornerSize = 6
  ctx.fillStyle = theme.primary
  
  // Top-left corner
  ctx.fillRect(
    startCell.left - cornerSize/2,
    startCell.top - cornerSize/2,
    cornerSize,
    cornerSize
  )
  
  // Bottom-right corner  
  ctx.fillRect(
    endCell.right - cornerSize/2,
    endCell.bottom - cornerSize/2,
    cornerSize,
    cornerSize
  )
}
```

## Visual System Summary

### **Selection Visuals Stack:**
1. **Canvas Layer** (optional, for 1000+ cells) - High performance rendering
2. **SVG Layer** - Precise borders, marching ants, geometric shapes
3. **DOM Layer** - Standard overlays, tooltips, info panels
4. **Portal Layer** - Context menus, floating panels outside table

### **Key Visual Components:**
- **Cell borders** - SVG-based precise borders with corner handles
- **Range fills** - Semi-transparent backgrounds with gradients
- **Active cell** - Thick border with glow effect and coordinate tooltip
- **Fill handle** - Crosshair cursor with drag preview
- **Column/row selection** - Full-height/width highlighting
- **Marching ants** - Animated borders for large selections
- **Selection info** - Floating statistics panel
- **Context menu** - Professional right-click menu

### **Performance Features:**
- **Automatic Canvas fallback** for large selections (1000+ cells)
- **Portal rendering** outside table DOM tree
- **CSS animations** with reduced motion support
- **Theme system** supporting Excel, Google Sheets, Notion styles

This provides Excel/Google Sheets-level visual feedback while maintaining optimal performance!
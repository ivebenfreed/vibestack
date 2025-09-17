# VibeGrid Coordinate System Unification Plan

**Problem**: VibeGrid has 4 separate coordinate systems causing instability, visual jumping, and positioning errors.

**Solution**: Hybrid DOM-reactive + minimal virtual coordinate architecture.

## Current State Analysis

### Identified Coordinate Systems
1. **VibeGridXCoordinateManager** (`coordinates/VibeGridXCoordinateManager.ts`)
2. **CoordinateSystem** (`overlays/CoordinateSystem.ts`)
3. **OverlayManager.CoordinateMapping** (`renderers/modules/OverlayManager.ts`)
4. **visual-state ColumnLayout** (`stores/visual-state.ts`)

### Critical Issues Found
- **Height inconsistencies**: 4 different `ROW_HEIGHT = 40` constants
- **Interface conflicts**: `xOffset` vs `offset`, incompatible coordinate mapping types
- **Race conditions**: Systems update independently, creating timing windows with invalid coordinates
- **Performance issues**: `createCompleteGridState$` runs on every change with heavy computation
- **Magic numbers**: Hardcoded `70px` offsets, viewport calculations with no single source

### Root Cause
**Architectural fragmentation** - multiple systems calculating the same positions independently without synchronization.

## Proposed Architecture: Hybrid DOM-Reactive System

### Core Principle
- **DOM cells**: Use actual DOM positions via `getBoundingClientRect()`
- **Virtual cells**: Minimal coordinate calculations only for virtualization
- **Reactive**: Legend State observables bridge DOM changes to overlays

### Architecture Components

#### 1. Minimal Virtual Coordinate System
```typescript
// Only for virtualization - no overlays depend on this
interface VirtualBounds {
  rowHeight: number;           // Single constant: 40
  columnWidths: number[];      // Array of actual widths
  totalRows: number;
  totalColumns: number;
}
```

#### 2. DOM Position Observable
```typescript
// Reactive DOM position tracker
const domPositions$ = observable<{
  cellPositions: Map<string, CellPosition>;
  tableContainer: HTMLElement | null;
  lastUpdate: number;
}>();
```

#### 3. Hybrid Position Resolution
```typescript
// Single API for both DOM and virtual cells
function useHybridCellPosition$(cellKey: string) {
  return computed(() => {
    // Try DOM first (for rendered cells)
    const domPosition = domPositions$.cellPositions.get().get(cellKey);
    if (domPosition) return { ...domPosition, source: 'dom' };

    // Fall back to virtual calculation
    return calculateVirtualPosition(cellKey);
  });
}
```

## Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal**: Eliminate height/offset inconsistencies

#### Step 1.1: Create Grid Constants
```typescript
// src/components/custom/vibegrid/constants/grid-dimensions.ts
export const GRID_DIMENSIONS = {
  ROW_HEIGHT: 40,
  HEADER_HEIGHT: 48,
  DEFAULT_COLUMN_WIDTH: 150,
  DRAG_COLUMN_WIDTH: 30,
  ROW_HEADER_WIDTH: 40,

  get CONTENT_OFFSET_X() {
    return this.DRAG_COLUMN_WIDTH + this.ROW_HEADER_WIDTH; // 70px
  }
} as const;
```

#### Step 1.2: Replace All Constants
- `SimplePassiveRenderer.ts:42` → `GRID_DIMENSIONS.ROW_HEIGHT`
- `OverlayManager.ts:19` → `GRID_DIMENSIONS.ROW_HEIGHT`
- `VibeGridXCoordinateManager.ts:222` → `GRID_DIMENSIONS.ROW_HEIGHT`
- `visual-state.ts:110,139,262` → `GRID_DIMENSIONS.*`

**Success Metric**: All height calculations use single constant

### Phase 2: DOM Position Tracking (Week 2)
**Goal**: Implement reactive DOM position system

#### Step 2.1: DOM Position Observable
```typescript
// src/components/custom/vibegrid/stores/dom-position-state.ts
export const domPositions$ = observable({
  cellPositions: new Map<string, CellPosition>(),
  tableContainer: null as HTMLElement | null,
  lastUpdate: 0
});

class ReactivePositionTracker {
  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver;

  initialize(container: HTMLElement) {
    domPositions$.tableContainer.set(container);
    this.setupObservers(container);
  }

  private updateAllPositions() {
    // RAF-batched position updates
    // ResizeObserver triggers reactive updates
  }
}
```

#### Step 2.2: Position Hooks
```typescript
// src/components/custom/vibegrid/hooks/use-cell-position.ts
export function useCellPosition$(cellKey: string) {
  return computed(() => {
    const positions = domPositions$.cellPositions.get();
    return positions.get(cellKey) || null;
  });
}
```

**Success Metric**: DOM position changes trigger reactive updates

### Phase 3: Virtual Scrolling Integration (Week 3)
**Goal**: Minimal coordinate calculations for virtualization only

#### Step 3.1: Virtual Scroll Manager
```typescript
// src/components/custom/vibegrid/virtualization/VirtualScrollManager.ts
export const virtualBounds$ = observable<VirtualBounds>({
  rowHeight: GRID_DIMENSIONS.ROW_HEIGHT,
  columnWidths: [],
  totalRows: 0,
  totalColumns: 0
});

export const virtualizedRange$ = computed(() => {
  // Calculate only what needs to be rendered
  // Buffer rows/columns for smooth scrolling
});
```

#### Step 3.2: Hybrid Position Hook
```typescript
export function useHybridCellPosition$(cellKey: string) {
  return computed(() => {
    // DOM position (for rendered cells)
    const domPosition = domPositions$.cellPositions.get().get(cellKey);
    if (domPosition) return { ...domPosition, source: 'dom' };

    // Virtual position (for non-rendered cells)
    return calculateVirtualPosition(cellKey);
  });
}
```

**Success Metric**: Virtual and DOM cells use same position API

### Phase 4: Overlay Migration (Week 4)
**Goal**: Convert overlays to use hybrid positioning

#### Step 4.1: Reactive Selection Overlay
```typescript
export const ReactiveSelectionOverlay = observer(() => {
  const selectedCells = tableInteraction$.selectedCells.get();
  const cellKeys = Array.from(selectedCells);

  return (
    <div className="selection-overlay">
      {cellKeys.map(cellKey => {
        const position$ = useHybridCellPosition$(cellKey);
        const position = position$.get();

        return position ? (
          <div key={cellKey} style={{
            position: 'absolute',
            left: position.x,
            top: position.y,
            width: position.width,
            height: position.height,
            // ... selection styling
          }} />
        ) : null;
      })}
    </div>
  );
});
```

#### Step 4.2: Replace Canvas Overlays
- Convert `CanvasOverlayDOM` to React components
- Use `useHybridCellPosition$` for positioning
- Remove coordinate calculation logic

**Success Metric**: All overlays position using hybrid system

### Phase 5: Legacy System Removal (Week 5)
**Goal**: Remove deprecated coordinate systems

#### Step 5.1: Remove Coordinate Classes
- Delete `CoordinateSystem.ts`
- Delete `VibeGridXCoordinateManager.ts`
- Remove coordinate logic from `visual-state.ts`

#### Step 5.2: Update Component Dependencies
- Remove coordinate manager dependencies
- Update imports to use new system
- Clean up unused coordinate interfaces

**Success Metric**: Only hybrid system remains

## Performance Optimizations

### 1. RAF Batching
```typescript
private updateAllPositions() {
  if (this.rafId) cancelAnimationFrame(this.rafId);

  this.rafId = requestAnimationFrame(() => {
    // Batch all position updates
    const newPositions = new Map();
    // ... calculate positions

    batch(() => {
      domPositions$.cellPositions.set(newPositions);
      domPositions$.lastUpdate.set(Date.now());
    });
  });
}
```

### 2. Selective Tracking
```typescript
// Only track positions for visible/selected cells
export function trackCellPosition$(cellKey: string) {
  return computed(() => {
    const position = domPositions$.cellPositions.get().get(cellKey);
    return position?.isVisible ? position : null;
  });
}
```

### 3. Throttled Updates
```typescript
// Throttle virtual position calculations to 60fps
const throttledVirtualUpdate$ = computed(() => {
  const viewport = virtualViewport$.get();
  return {
    scrollTop: Math.floor(viewport.scrollTop / 16) * 16,
    scrollLeft: Math.floor(viewport.scrollLeft / 16) * 16,
    // ...
  };
});
```

## Implementation Strategy: Clean Break

### Direct Migration Approach
1. **Week 1**: Create new hybrid system completely
2. **Week 2**: Replace all components in one go
3. **Week 3**: Delete old coordinate systems entirely
4. **Week 4**: Testing and bug fixes

### No Feature Flags or Compatibility Layers
- Build the new system from scratch
- Switch components over in atomic commits
- Delete old files immediately after replacement
- Cleaner codebase, no technical debt

## Success Metrics

### Stability
- **Zero positioning errors**: Overlays align perfectly with DOM cells
- **No visual jumping**: Smooth scrolling and interaction
- **Consistent measurements**: Single source for all dimensions

### Performance
- **<1ms coordinate calculations**: Minimal computational overhead
- **60fps scrolling**: No jank during virtual scrolling
- **Memory efficiency**: No coordinate calculation leaks

### Maintainability
- **Single constant file**: All dimensions in one place
- **Type safety**: Full TypeScript integration
- **Debuggability**: Observable dev tools show position changes

### Developer Experience
- **Simple API**: `useHybridCellPosition$(cellKey)` works everywhere
- **Reactive**: Automatic updates when positions change
- **Testable**: Easy to mock DOM positions for testing

## Testing Strategy

### 1. Visual Regression Tests
```bash
# Compare screenshots before/after migration
./scripts/visual-regression-test.sh
```

### 2. Performance Benchmarks
```typescript
// Measure coordinate calculation performance
const startTime = performance.now();
const position = useHybridCellPosition$(cellKey).get();
const duration = performance.now() - startTime;
expect(duration).toBeLessThan(1); // <1ms
```

### 3. Integration Tests
```typescript
// Test virtual + DOM position consistency
test('hybrid positioning matches expectations', () => {
  const domPosition = getDOMPosition(cellKey);
  const hybridPosition = useHybridCellPosition$(cellKey).get();

  expect(hybridPosition).toEqual(domPosition);
});
```

## Rollback Plan

If issues arise:

1. **Git revert**: Clean atomic commits make rollback simple
2. **Branch strategy**: Keep working branch until fully tested
3. **No complexity**: No feature flags or adapters to maintain

## Conclusion

This hybrid DOM-reactive approach eliminates coordinate instability by:

1. **Reducing coordination overhead**: DOM is single source of truth for rendered cells
2. **Minimizing calculations**: Virtual coordinates only for virtualization
3. **Ensuring accuracy**: DOM positions always reflect reality
4. **Enabling reactivity**: Legend State observables bridge DOM to UI
5. **Improving performance**: Selective tracking and RAF batching

The result is a stable, performant, and maintainable coordinate system that scales with VibeGrid's complexity.
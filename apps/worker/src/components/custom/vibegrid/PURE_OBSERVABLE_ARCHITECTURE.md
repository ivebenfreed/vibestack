# VibeGrid Pure Observable Architecture

## Executive Summary

Complete migration from XState + Legend State + Renderer to a pure **Legend State + Passive Renderer** architecture. This eliminates all unnecessary rendering, removes complex event systems, and creates the simplest possible reactive table implementation.

## Current Problems

### 1. Excessive Rendering
- **Scroll triggers full render**: `handleScroll` → `updateVisibleRange` → `renderRows` → DOM manipulation
- **State changes cascade**: Any state change triggers complete re-render
- **No granular updates**: Selection change re-renders all rows

### 2. Complex Architecture
- **XState overhead**: 1500+ lines in table-machine
- **Multiple actors**: renderer, canvas, edit, drag actors
- **Window functions**: Global bridging with `__vibegrid_send_data_to_table_machine`
- **Event mapping**: Complex routing through multiple layers

### 3. State Coupling
- **Data and UI mixed**: Selection state mixed with data processing
- **Scroll affects state**: Viewport changes trigger state recalculation
- **No isolation**: Every change potentially affects everything

## New Architecture: Pure Observables

### Core Principle: Separation of Concerns

```
User Events → Observable Methods → State Updates → Passive Rendering
```

### Three Observable Layers

#### 1. Table Core (Data & Configuration)
```typescript
const tableCore$ = observable({
  // Source data from Legend State
  entities: () => getEntity$(entityType).get(),
  
  // Table configuration
  columns: [],
  columnOrder: [],
  columnWidths: {},
  columnVisibility: {},
  
  // Data transformations
  sortBy: [],
  filters: [],
  groupConfig: null,
  
  // Computed processed data (lazy)
  processedRows: function() {
    const data = this.entities.get();
    const sortBy = this.sortBy.get();
    const filters = this.filters.get();
    const groupConfig = this.groupConfig.get();
    
    let rows = Object.values(data || {});
    rows = applyFilters(rows, filters);
    rows = applySorting(rows, sortBy);
    if (groupConfig) {
      rows = applyGrouping(rows, groupConfig);
    }
    return rows;
  },
  
  // Direct manipulation methods
  toggleSort(field: string) {
    const current = this.sortBy.get();
    const index = current.findIndex(s => s.field === field);
    if (index === -1) {
      this.sortBy.set([...current, { field, direction: 'asc' }]);
    } else if (current[index].direction === 'asc') {
      current[index].direction = 'desc';
      this.sortBy.set([...current]);
    } else {
      this.sortBy.set(current.filter((_, i) => i !== index));
    }
  },
  
  setFilter(field: string, value: any, operator: string) {
    const filters = this.filters.get();
    this.filters.set([...filters, { field, value, operator }]);
  },
  
  toggleColumn(columnId: string) {
    const visibility = this.columnVisibility.get();
    this.columnVisibility.set({
      ...visibility,
      [columnId]: !visibility[columnId]
    });
  }
});
```

#### 2. Table Interaction (UI State - Isolated)
```typescript
const tableInteraction$ = observable({
  // Selection state (doesn't affect data processing)
  selectedCells: new Set<string>(),
  selectedRows: new Set<string>(),
  anchorCell: null,
  selectionMode: 'cell', // 'cell' | 'row' | 'range' | 'multi'
  isSelecting: false,
  
  // Editing state (isolated from data)
  editingCell: null,
  editValue: null,
  isEditing: false,
  editValidation: null,
  
  // Hover state (pure UI)
  hoveredCell: null,
  hoveredRow: null,
  
  // Drag state (independent)
  isDragging: false,
  dragSource: null,
  dragTarget: null,
  
  // Direct manipulation methods
  selectCell(cellId: string, isMulti: boolean = false) {
    batch(() => {
      const cells = new Set(this.selectedCells.get());
      if (!isMulti) cells.clear();
      cells.add(cellId);
      this.selectedCells.set(cells);
      this.selectionMode.set('cell');
    });
  },
  
  selectRow(rowId: string, isMulti: boolean = false) {
    batch(() => {
      const rows = new Set(this.selectedRows.get());
      if (!isMulti) rows.clear();
      rows.add(rowId);
      this.selectedRows.set(rows);
      this.selectionMode.set('row');
    });
  },
  
  startEdit(cellId: string, initialValue: any) {
    batch(() => {
      this.editingCell.set(cellId);
      this.editValue.set(initialValue);
      this.isEditing.set(true);
    });
  },
  
  saveEdit() {
    batch(() => {
      // Trigger entity update
      const [rowId, columnId] = this.editingCell.get().split(':');
      const value = this.editValue.get();
      updateEntity$(rowId, { [columnId]: value });
      
      // Clear editing state
      this.editingCell.set(null);
      this.editValue.set(null);
      this.isEditing.set(false);
    });
  },
  
  cancelEdit() {
    batch(() => {
      this.editingCell.set(null);
      this.editValue.set(null);
      this.isEditing.set(false);
    });
  }
});
```

#### 3. Table Viewport (Scroll State - Completely Independent)
```typescript
const tableViewport$ = observable({
  // Scroll position (pure DOM state)
  scrollTop: 0,
  scrollLeft: 0,
  
  // Viewport dimensions
  viewportWidth: 0,
  viewportHeight: 0,
  
  // Content dimensions
  contentWidth: 0,
  contentHeight: 0,
  
  // Visible range (computed from scroll)
  visibleRange: function() {
    const top = this.scrollTop.get();
    const height = this.viewportHeight.get();
    const rowHeight = 40;
    
    const start = Math.floor(top / rowHeight);
    const end = Math.ceil((top + height) / rowHeight);
    
    return { 
      start: Math.max(0, start - 5), // 5 row buffer
      end: end + 5 
    };
  },
  
  // Direct scroll update (called by DOM event)
  updateScroll(top: number, left: number) {
    batch(() => {
      this.scrollTop.set(top);
      this.scrollLeft.set(left);
    });
  },
  
  updateViewport(width: number, height: number) {
    batch(() => {
      this.viewportWidth.set(width);
      this.viewportHeight.set(height);
    });
  }
});
```

### Passive Renderer (Reusing Existing Components)

```typescript
class PassiveTableRenderer {
  private container: HTMLElement;
  private viewport: HTMLElement;
  private disposers: (() => void)[] = [];
  
  // REUSED: Existing overlay components
  private overlays = {
    editing: EditingOverlay | null,
    selection: SelectionOverlayDOM | null,
    contextMenu: ContextMenuRenderer | null,
    columnResize: ColumnResizeOverlayDOM | null,
    dragPreview: DragPreviewOverlayDOM | null
  };
  
  // REUSED: Core rendering methods from UnifiedTableRenderer
  private renderMethods = {
    renderRow: null,      // Extract from UnifiedTableRenderer
    renderCell: null,     // Extract from UnifiedTableRenderer
    renderGroupRow: null, // Extract from UnifiedTableRenderer
    cellPipeline: null    // CellPipeline for formatting
  };
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.setupDOM();
    this.initializeReusableComponents();
    this.setupObservers();
    this.attachDOMEvents();
  }
  
  private initializeReusableComponents() {
    // REUSE: EditingOverlay with observable callbacks
    this.overlays.editing = new EditingOverlay(this.container, {
      onCommit: (value) => tableInteraction$.saveEdit(value),
      onCancel: () => tableInteraction$.cancelEdit(),
      zIndex: 1000
    });
    
    // REUSE: SelectionOverlayDOM for selection visualization
    this.overlays.selection = new SelectionOverlayDOM(this.container, {
      selectionColor: 'rgba(59, 130, 246, 0.1)',
      selectionBorderColor: 'rgb(59, 130, 246)',
      borderWidth: 2,
      cellHeight: 40
    });
    
    // REUSE: Context menu
    this.overlays.contextMenu = new ContextMenuRenderer({
      container: this.container,
      onAction: (action) => this.handleContextMenuAction(action)
    });
    
    // REUSE: Column resize overlay
    this.overlays.columnResize = new ColumnResizeOverlayDOM(this.container);
    
    // REUSE: Drag preview for drag & drop
    this.overlays.dragPreview = new DragPreviewOverlayDOM(this.container);
    
    // REUSE: Core rendering logic from UnifiedTableRenderer
    const renderer = new UnifiedTableRenderer(this.container, {});
    this.renderMethods = {
      renderRow: renderer.renderRowContent.bind(renderer),
      renderCell: renderer.renderDataRowContent.bind(renderer),
      renderGroupRow: renderer.renderGroupRowContent.bind(renderer),
      cellPipeline: new CellPipeline()
    };
  }
  
  private setupObservers() {
    // Observe visible data changes - REUSE UnifiedTableRenderer logic
    this.disposers.push(
      observe(() => {
        const rows = tableCore$.processedRows.get();
        const range = tableViewport$.visibleRange.get();
        const visibleRows = rows.slice(range.start, range.end);
        this.renderVisibleRows(visibleRows, range.start);
      })
    );
    
    // REUSE: SelectionOverlayDOM for selection visualization
    this.disposers.push(
      observe(() => {
        const selectedCells = tableInteraction$.selectedCells.get();
        const viewport = tableViewport$.visibleRange.get();
        const coordinateMapping = this.getCoordinateMapping();
        
        this.overlays.selection?.updateSelectionWithMapping(
          selectedCells,
          viewport,
          coordinateMapping
        );
      })
    );
    
    // REUSE: EditingOverlay for cell editing
    this.disposers.push(
      observe(() => {
        const editingCell = tableInteraction$.editingCell.get();
        const editValue = tableInteraction$.editValue.get();
        
        if (editingCell && this.overlays.editing) {
          const [rowId, columnId] = editingCell.split(':');
          const column = this.getColumn(columnId);
          const position = this.getCellPosition(rowId, columnId);
          
          this.overlays.editing.show(
            { rowId, columnId },
            column,
            editValue,
            position
          );
        } else {
          this.overlays.editing?.hide();
        }
      })
    );
    
    // REUSE: Column resize overlay
    this.disposers.push(
      observe(() => {
        const resizingColumn = tableInteraction$.resizingColumn.get();
        if (resizingColumn && this.overlays.columnResize) {
          this.overlays.columnResize.show(resizingColumn);
        } else {
          this.overlays.columnResize?.hide();
        }
      })
    );
    
    // REUSE: Drag preview overlay
    this.disposers.push(
      observe(() => {
        const dragState = tableInteraction$.dragState.get();
        if (dragState && this.overlays.dragPreview) {
          this.overlays.dragPreview.show(dragState);
        } else {
          this.overlays.dragPreview?.hide();
        }
      })
    );
  }
  
  private attachDOMEvents() {
    // Scroll events update viewport observable
    this.viewport.addEventListener('scroll', (e) => {
      tableViewport$.updateScroll(
        e.target.scrollTop,
        e.target.scrollLeft
      );
    });
    
    // Click events update selection
    this.container.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-cell-id]');
      if (cell) {
        const cellId = cell.dataset.cellId;
        tableInteraction$.selectCell(cellId, e.ctrlKey);
      }
    });
    
    // Double click starts edit
    this.container.addEventListener('dblclick', (e) => {
      const cell = e.target.closest('[data-cell-id]');
      if (cell) {
        const cellId = cell.dataset.cellId;
        const value = cell.textContent;
        tableInteraction$.startEdit(cellId, value);
      }
    });
    
    // Keyboard events
    this.container.addEventListener('keydown', (e) => {
      if (tableInteraction$.isEditing.get()) {
        if (e.key === 'Enter') {
          tableInteraction$.saveEdit();
        } else if (e.key === 'Escape') {
          tableInteraction$.cancelEdit();
        }
      }
    });
  }
  
  private renderVisibleRows(rows: any[], startIndex: number) {
    // Efficient row rendering with recycling
    const fragment = document.createDocumentFragment();
    
    rows.forEach((row, i) => {
      const rowEl = this.getOrCreateRow(startIndex + i);
      this.updateRowContent(rowEl, row);
      fragment.appendChild(rowEl);
    });
    
    this.viewport.innerHTML = '';
    this.viewport.appendChild(fragment);
  }
  
  private updateSelectionStyles(cells: Set<string>, rows: Set<string>) {
    // Just toggle CSS classes, no re-rendering
    document.querySelectorAll('.selected').forEach(el => {
      el.classList.remove('selected');
    });
    
    cells.forEach(cellId => {
      document.querySelector(`[data-cell-id="${cellId}"]`)
        ?.classList.add('selected');
    });
    
    rows.forEach(rowId => {
      document.querySelector(`[data-row-id="${rowId}"]`)
        ?.classList.add('selected');
    });
  }
  
  destroy() {
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
  }
}
```

## Migration Plan

### Phase 1: Create Observable Foundation (Day 1-2)
1. Create `tableCore$`, `tableInteraction$`, `tableViewport$` observables
2. Implement computed `processedRows` with sort/filter/group
3. Add direct manipulation methods to observables
4. Test observable reactivity independently

### Phase 2: Build Passive Renderer (Day 3-4)
1. Create `PassiveTableRenderer` class
2. Implement granular observers for each concern
3. Add efficient DOM update methods (no full re-renders)
4. Implement row recycling for performance

### Phase 3: Connect DOM Events (Day 5)
1. Attach scroll listener → `tableViewport$.updateScroll()`
2. Attach click listener → `tableInteraction$.selectCell()`
3. Attach keyboard listeners for editing
4. Remove all XState event dispatching

### Phase 4: Remove XState (Day 6)
1. Delete table-machine directory
2. Remove all actors (renderer, canvas, edit, drag)
3. Delete event handlers and slices
4. Remove window function bridges

### Phase 5: Optimize Performance (Day 7)
1. Implement virtual scrolling with fixed heights
2. Add row recycling pool
3. Use CSS containment for row isolation
4. Add intersection observer for lazy loading

## Benefits Achieved

### 1. Performance
- **No excess rendering**: Scroll only updates visible range
- **Granular updates**: Selection only changes CSS classes
- **Lazy computation**: Processed rows only compute when accessed
- **Efficient DOM**: Row recycling and fragment updates

### 2. Simplicity
- **Two systems**: Legend State + Renderer (that's it!)
- **Direct manipulation**: Click → Method → State → Render
- **No event mapping**: DOM events call observable methods directly
- **No bridging**: Observables directly observed by renderer

### 3. Maintainability
- **Clear separation**: Data, interaction, and viewport isolated
- **Predictable flow**: State changes always flow one direction
- **Easy debugging**: Can inspect any observable state
- **Simple testing**: Pure functions and observable methods

## Reusable Components

### Components We Keep (90% Reusability)

| Component | Location | Reusability | Integration Method |
|-----------|----------|-------------|-------------------|
| **EditingOverlay** | `overlays/EditingOverlay.tsx` | 100% | Observe `editingCell` state |
| **SelectionOverlayDOM** | `overlays/SelectionOverlayDOM.ts` | 100% | Observe `selectedCells` state |
| **ContextMenu** | `components/ContextMenu.tsx` | 90% | Convert events to observable calls |
| **ColumnResizeOverlayDOM** | `overlays/ColumnResizeOverlayDOM.ts` | 100% | Observe resize state |
| **DragPreviewOverlayDOM** | `overlays/DragPreviewOverlayDOM.ts` | 100% | Observe drag state |
| **CellPipeline** | `renderers/core/CellPipeline.ts` | 100% | Pure formatting functions |
| **Row Rendering** | `UnifiedTableRenderer.renderRowContent()` | 80% | Extract methods |
| **Cell Rendering** | `UnifiedTableRenderer.renderDataRowContent()` | 80% | Extract methods |
| **Group Rendering** | `UnifiedTableRenderer.renderGroupRowContent()` | 80% | Extract methods |
| **Virtual Scrolling** | `UnifiedTableRenderer.updateVisibleRange()` | 70% | Adapt for observables |

### Integration Example

```typescript
// Before: XState + Complex Event System
const editActor = spawn(editMachine);
editActor.send({ type: 'START_EDIT', cell });

// After: Direct Observable + Reused Overlay
tableInteraction$.startEdit(cellId, value);
// EditingOverlay automatically shows via observe()
```

## Code Comparison

### Before (XState + Complex Bridging)
```typescript
// 1500+ lines of state machine
const tableMachine = setup({...});

// Complex event routing
window.__vibegrid_send_data_to_table_machine({
  type: 'PROCESS_GROUPS_WITH_DATA',
  entities: entities,
  rows: rows
});

// Multiple actors and coordination
const rendererActor = spawn(...);
const canvasActor = spawn(...);

// Cascading renders
handleScroll → updateVisibleRange → renderRows → full DOM update
```

### After (Pure Observables)
```typescript
// Simple observables
const tableCore$ = observable({...});
const tableInteraction$ = observable({...});
const tableViewport$ = observable({...});

// Direct manipulation
<div onClick={() => tableInteraction$.selectCell(cellId)} />

// Passive observation
observe(() => renderer.updateVisibleRows(
  tableCore$.processedRows.get(),
  tableViewport$.visibleRange.get()
));

// Granular updates
scroll → updates range → renders only visible rows
selection → updates CSS → no re-render
```

## Implementation Checklist

- [ ] Create `tableCore$` observable with data and configuration
- [ ] Create `tableInteraction$` observable with selection/editing
- [ ] Create `tableViewport$` observable with scroll state
- [ ] Build `PassiveTableRenderer` with granular observers
- [ ] Connect DOM events to observable methods
- [ ] Test scroll independence (no data recomputation)
- [ ] Test selection efficiency (CSS only updates)
- [ ] Remove XState machine and actors
- [ ] Delete bridge code and window functions
- [ ] Optimize with virtual scrolling
- [ ] Add row recycling for performance
- [ ] Document new architecture
- [ ] Update tests for new structure

## Success Metrics

1. **Scroll Performance**: 60 FPS scrolling with 10,000 rows
2. **Selection Speed**: < 16ms to update selection state
3. **Sort/Filter**: < 100ms for 10,000 rows
4. **Memory**: < 50MB for 10,000 rows
5. **Code Reduction**: 70% less code than XState version
6. **Test Coverage**: 90%+ with simple unit tests

## Conclusion

This pure observable architecture achieves the ultimate simplification:
- **Legend State** handles all state management
- **Passive Renderer** observes and updates DOM
- **Direct manipulation** without event systems
- **Perfect decoupling** for optimal performance

The result is a table component that is faster, simpler, and more maintainable than any traditional architecture.
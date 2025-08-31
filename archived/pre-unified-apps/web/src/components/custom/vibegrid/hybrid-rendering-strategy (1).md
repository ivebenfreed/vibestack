### React 19 Enhanced Performance Targets

| Operation | React 18 Target | React 19 Target | Improvement |
|-----------|-----------------|-----------------|-------------|
| Initial render (10k rows) | < 100ms | < 70ms | 30% faster |
| Scroll frame rate | 60 FPS | 60+ FPS | Smoother |
| Cell update | < 1ms | < 0.5ms | 50% faster |
| Optimistic update | N/A | < 0.1ms | New feature |
| Sort/filter (10k rows) | < 200ms | < 150ms | 25% faster |
| Memory usage (100k rows) | < 500MB | < 400MB | 20% reduction |
| Selection update | < 5ms | < 3ms | 40% faster |

### React 19 Performance Monitoring

```typescript
// Enhanced monitoring with React 19 features
class React19PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.setupReact19Monitoring();
  }
  
  setupReact19Monitoring() {
    // React 19: Enhanced performance entries
    this.observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        if (entry.name.startsWith('table-')) {
          this.recordMetric(entry.name, entry.duration);
          
          // React 19: Automatic optimization suggestions
          if (entry.duration > this.getThreshold(entry.name)) {
            this.suggestOptimization(entry.name, entry.duration);
          }
        }
      });
    });
    
    this.observer.observe({ 
      entryTypes: ['measure', 'navigation', 'paint', 'layout-shift'] 
    });
  }
  
  measureWithTransition(operation, fn) {
    const [isPending, startTransition] = useTransition();
    
    return startTransition(() => {
      performance.mark(`${operation}-start`);
      const result = fn();
      performance.mark(`${operation}-en# React 19 Enhanced Hybrid Rendering Strategy for High-Performance Tables

## Architecture Overview with React 19 Optimizations

React 19 revolutionizes the hybrid rendering approach with the **React Compiler**, automatic optimizations, and new hooks that significantly improve ergonomics. The compiler automatically handles memoization, eliminating manual `useMemo`/`useCallback` usage, while new hooks like `use`, `useActionState`, and `useOptimistic` streamline async operations and state management.

```
┌─────────────────────────────────────────────────┐
│              React 19 Layer                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────┐  │
│  │   XState    │  │ React 19    │  │   UI    │  │
│  │   Logic     │  │ Compiler +  │  │ Chrome  │  │
│  │             │  │ New Hooks   │  │         │  │
│  └─────────────┘  └─────────────┘  └─────────┘  │
└─────────────────────┬───────────────────────────┘
                      │ Enhanced Bridge (Actions/use hook)
┌─────────────────────┴───────────────────────────┐
│              Direct DOM Layer                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────┐  │
│  │   Virtual   │  │   Canvas    │  │  Object │  │
│  │  Renderer   │  │  Overlays   │  │ Pooling │  │
│  └─────────────┘  └─────────────┘  └─────────┘  │
└─────────────────────────────────────────────────┘
```

## React 19 Revolutionary Features for Hybrid Rendering

### 1. **React Compiler - Automatic Optimization**

The React Compiler automatically optimizes your code, eliminating the need for manual memoization and reducing the coordination overhead between React and direct DOM rendering.

## Core Strategy

### 1. **Rendering Separation**

**React Handles:**
- Business logic and state management (XState)
- Event coordination and delegation
- UI chrome (toolbars, dialogs, status bars)
- Layout and positioning
- Component lifecycle management

**Direct DOM Handles:**
- Table cell rendering and updates
- Virtual scrolling implementation
- Selection overlays and highlights
- Drag and drop visual feedback
- High-frequency animations

### 2. **Performance Boundaries**

```typescript
// React 19: No manual memoization needed!
const TableContainer = ({ config }) => {
  const table = useDataTable(config);  // XState logic
  const rendererRef = useRef<TableRenderer>();
  
  // React Compiler automatically optimizes this
  const handleStateChange = (state) => {
    rendererRef.current?.render(state);
  };
  
  // No useCallback needed - React Compiler handles it
  const handleCellClick = (rowId, columnId, modifiers) => {
    table.actions.selectCell(rowId, columnId, modifiers);
  };
  
  // No useMemo needed - React Compiler optimizes
  const toolbarProps = {
    onAddRow: table.actions.addRow,
    onDeleteRows: table.actions.deleteSelectedRows,
    hasSelection: table.state.selectedRows.length > 0
  };
  
  return (
    <div className="table-container">
      <TableToolbar {...toolbarProps} />
      <div 
        ref={el => {
          if (el && !rendererRef.current) {
            rendererRef.current = new TableRenderer(el, {
              onCellClick: handleCellClick,
              onStateChange: handleStateChange
            });
          }
        }}
        className="table-viewport" 
      />
      <TableStatusBar stats={table.state.stats} />
    </div>
  );
};
```

### 2. **Actions API for Seamless State Updates**

React 19's Actions API integrates perfectly with XState and direct DOM rendering:

```typescript
// React 19: use hook for data fetching
const TableDataLoader = ({ tableId }) => {
  // use hook handles suspense automatically
  const tableData = use(fetchTableData(tableId));
  const tableSchema = use(fetchTableSchema(tableId));
  
  // Direct DOM renderer gets initialized with data
  useEffect(() => {
    if (tableData && tableSchema) {
      const renderer = new TableRenderer(containerRef.current);
      renderer.initialize(tableData, tableSchema);
    }
  }, [tableData, tableSchema]);
  
  return <div ref={containerRef} className="table-viewport" />;
};

// Suspense boundary handles loading states
const TableWithSuspense = ({ tableId }) => {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <TableDataLoader tableId={tableId} />
    </Suspense>
  );
};
```

### 4. **Enhanced Form Handling with React 19**

React 19's form features integrate seamlessly with table operations:

```typescript
// React 19: Built-in form actions
const InlineRowEditor = ({ rowId, onComplete }) => {
  const [formState, formAction, isPending] = useActionState(
    async (prevState, formData) => {
      const updates = Object.fromEntries(formData);
      
      // Direct DOM optimistic update
      directRenderer.updateRowOptimistic(rowId, updates);
      
      try {
        const result = await saveRowToServer(rowId, updates);
        directRenderer.confirmRowUpdate(rowId, result.data);
        onComplete(result);
        return { success: true, data: result.data };
      } catch (error) {
        directRenderer.rollbackRowUpdate(rowId);
        return { success: false, error: error.message };
      }
    },
    { success: false, error: null }
  );
  
  return (
    <form action={formAction}>
      <input name="name" required />
      <input name="email" type="email" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
      {formState.error && <div className="error">{formState.error}</div>}
    </form>
  );
};

// useFormStatus for nested components
const SaveButton = () => {
  const { pending, data } = useFormStatus();
  
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Saving...' : 'Save'}
    </button>
  );
};
```

## React 19 Enhanced Library Ecosystem

### React 19 Optimized Libraries

#### 1. **React Compiler Integration**
```bash
npm install babel-plugin-react-compiler
# or with Vite
npm install vite-plugin-react-compiler
```

**Configuration:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { reactCompiler } from 'vite-plugin-react-compiler';

export default defineConfig({
  plugins: [
    react(),
    reactCompiler({
      target: '19' // Target React 19
    })
  ]
});

// Table component - no manual memoization needed
class TableRenderer {
  // React Compiler automatically optimizes this
  updateCells(cells) {
    cells.forEach(cell => this.updateCell(cell));
  }
  
  // No need for useCallback in React components
  handleCellClick = (rowId, columnId) => {
    this.onCellClick?.(rowId, columnId);
  };
}
```

#### 2. **Enhanced Virtual Scrolling with React 19**
```bash
npm install @tanstack/virtual
```

**Why**: Battle-tested virtual scrolling with excellent performance and flexibility.

```bash
npm install @tanstack/virtual
```

**React 19 Integration:**
```typescript
import { useVirtualizer } from '@tanstack/virtual';

class React19TableRenderer {
  constructor(container, options) {
    this.container = container;
    this.virtualizer = this.setupVirtualizer();
    this.actionHandler = options.actionHandler; // React 19 action
  }
  
  setupVirtualizer() {
    // React Compiler optimizes this automatically
    return useVirtualizer({
      count: this.totalRows,
      getScrollElement: () => this.container,
      estimateSize: () => 40,
      overscan: 10,
      // React 19: Enhanced with concurrent features
      enableSmoothScrolling: true,
      scrollPaddingStart: 0,
      scrollPaddingEnd: 0,
    });
  }
  
  // Actions API integration
  async handleRowUpdate(rowIndex, data) {
    // Use React 19 action for state management
    await this.actionHandler({ 
      type: 'UPDATE_ROW', 
      index: rowIndex, 
      data 
    });
  }
  
  render(state) {
    const virtualItems = this.virtualizer.getVirtualItems();
    
    // React Compiler optimizes this loop
    virtualItems.forEach(virtualRow => {
      this.renderRow(virtualRow.index, virtualRow.start, state.rows[virtualRow.index]);
    });
  }
}
```

#### 3. **React 19 Optimistic Updates with Canvas**
```bash
npm install konva
# or use custom canvas for lighter weight
```

**Why**: Hardware-accelerated selection rendering with complex shapes support.

```bash
npm install konva
# Enhanced for React 19
npm install @react-spring/konva
```

**React 19 Optimistic Selection Overlay:**
```typescript
import Konva from 'konva';
import { useOptimistic } from 'react';

class React19SelectionOverlay {
  constructor(container) {
    this.stage = new Konva.Stage({
      container,
      width: container.offsetWidth,
      height: container.offsetHeight,
    });
    this.layer = new Konva.Layer();
    this.stage.add(this.layer);
  }
  
  // React 19: Optimistic selection updates
  updateSelectionOptimistic(selectedCells, optimisticCells = new Set()) {
    this.layer.removeChildren();
    
    // Merge actual and optimistic selections
    const allSelected = new Set([...selectedCells, ...optimisticCells]);
    
    allSelected.forEach(cellKey => {
      const rect = this.getCellRect(cellKey);
      const isOptimistic = optimisticCells.has(cellKey);
      
      const selection = new Konva.Rect({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        fill: isOptimistic 
          ? 'rgba(255, 193, 7, 0.2)'  // Yellow for optimistic
          : 'rgba(66, 165, 245, 0.2)', // Blue for confirmed
        stroke: isOptimistic ? '#ffc107' : '#42a5f5',
        strokeWidth: 2,
        opacity: isOptimistic ? 0.7 : 1,
      });
      
      this.layer.add(selection);
    });
    
    this.layer.batchDraw();
  }
}

// React component using optimistic selection
const TableSelectionManager = ({ tableActor }) => {
  const [actualSelection, setActualSelection] = useState(new Set());
  const [optimisticSelection, setOptimisticSelection] = useOptimistic(
    actualSelection,
    (current, optimisticUpdate) => new Set([...current, ...optimisticUpdate])
  );
  
  const [, selectAction] = useActionState(async (prevState, cellKeys) => {
    // Server selection update
    const result = await updateSelectionOnServer(cellKeys);
    if (result.success) {
      setActualSelection(new Set(result.selectedCells));
    }
    return result;
  }, null);
  
  const handleOptimisticSelect = (cellKeys) => {
    // Immediate optimistic update
    setOptimisticSelection(cellKeys);
    // Trigger server update
    selectAction(cellKeys);
  };
  
  return { optimisticSelection, handleOptimisticSelect };
};
```

#### 4. **React 19 Enhanced Event Delegation**
```bash
npm install delegate
# Enhanced with React 19 actions
```

**React 19 Action-Driven Events:**
```typescript
class React19EventManager {
  constructor(container, actionHandler) {
    this.container = container;
    this.actionHandler = actionHandler; // React 19 action function
    this.setupEventDelegation();
  }
  
  setupEventDelegation() {
    // Single event listener with React 19 actions
    this.container.addEventListener('click', async (e) => {
      const cell = e.target.closest('[data-cell]');
      if (cell) {
        const cellKey = cell.getAttribute('data-cell');
        const [rowId, columnId] = cellKey.split(':');
        
        // Use React 19 action for state management
        await this.actionHandler({
          type: 'CELL_CLICK',
          rowId,
          columnId,
          modifiers: {
            shift: e.shiftKey,
            ctrl: e.ctrlKey,
            meta: e.metaKey
          }
        });
      }
    });
    
    // Optimistic drag handling
    this.container.addEventListener('dragstart', (e) => {
      const row = e.target.closest('[data-row]');
      if (row) {
        const rowId = row.getAttribute('data-row-id');
        this.actionHandler({
          type: 'ROW_DRAG_START',
          rowId,
          optimistic: true // Optimistic update flag
        });
      }
    });
  }
}
```

#### 5. **React 19 Concurrent Data Structures**
```bash
npm install immer
# React 19: Enhanced with concurrent features
```

**React 19 Concurrent-Safe Data Management:**
```typescript
import { produce } from 'immer';
import { useOptimistic, useTransition } from 'react';

class React19TableDataStore {
  constructor(initialData) {
    this.data = initialData;
    this.optimisticUpdates = new Map();
  }
  
  // React 19: Concurrent-safe updates
  updateWithOptimistic(rowId, field, value, isOptimistic = false) {
    if (isOptimistic) {
      this.optimisticUpdates.set(`${rowId}:${field}`, value);
      return this.getMergedData();
    }
    
    // Confirmed update - clear optimistic and update actual
    this.optimisticUpdates.delete(`${rowId}:${field}`);
    this.data = produce(this.data, draft => {
      const row = draft.find(r => r.id === rowId);
      if (row) {
        row[field] = value;
      }
    });
    
    return this.data;
  }
  
  getMergedData() {
    // Merge actual data with optimistic updates
    return produce(this.data, draft => {
      this.optimisticUpdates.forEach((value, key) => {
        const [rowId, field] = key.split(':');
        const row = draft.find(r => r.id === rowId);
        if (row) {
          row[field] = value;
        }
      });
    });
  }
  
  // React 19: Rollback optimistic updates
  rollbackOptimistic(rowId, field) {
    this.optimisticUpdates.delete(`${rowId}:${field}`);
    return this.getMergedData();
  }
}

// React component integration
const useTableData = (initialData) => {
  const [dataStore] = useState(() => new React19TableDataStore(initialData));
  const [isPending, startTransition] = useTransition();
  
  const [actualData, setActualData] = useState(initialData);
  const [optimisticData, setOptimisticData] = useOptimistic(
    actualData,
    (current, { rowId, field, value, type }) => {
      switch (type) {
        case 'update':
          return dataStore.updateWithOptimistic(rowId, field, value, true);
        case 'rollback':
          return dataStore.rollbackOptimistic(rowId, field);
        default:
          return current;
      }
    }
  );
  
  const updateCell = (rowId, field, value) => {
    // Immediate optimistic update
    setOptimisticData({ rowId, field, value, type: 'update' });
    
    // Concurrent server update
    startTransition(async () => {
      try {
        const result = await updateCellOnServer(rowId, field, value);
        setActualData(dataStore.updateWithOptimistic(rowId, field, result.value));
      } catch (error) {
        setOptimisticData({ rowId, field, type: 'rollback' });
      }
    });
  };
  
  return { data: optimisticData, updateCell, isPending };
};
```

#### 6. **React 19 Enhanced Animations**
```bash
npm install framer-motion
# React 19: Enhanced with concurrent features
```

**React 19 Concurrent Animations:**
```typescript
import { animate, AnimatePresence } from 'framer-motion';
import { useTransition } from 'react';

class React19TableAnimations {
  constructor() {
    this.activeAnimations = new Map();
  }
  
  // React 19: Concurrent-safe animations
  animateRowInsertOptimistic(rowElement, index, isPending) {
    const animationId = `insert-${index}`;
    
    // Cancel existing animation if any
    this.activeAnimations.get(animationId)?.cancel();
    
    const animation = animate(rowElement, {
      opacity: [0, isPending ? 0.7 : 1],
      y: [-20, 0],
      scale: [0.95, 1],
    }, {
      duration: 0.3,
      ease: 'easeOut',
    });
    
    this.activeAnimations.set(animationId, animation);
    
    animation.finished.then(() => {
      this.activeAnimations.delete(animationId);
    });
  }
  
  // Optimistic sort animation
  animateSortOptimistic(rows, newOrder, isOptimistic = false) {
    rows.forEach((row, index) => {
      const targetPosition = newOrder[index];
      const currentY = row.offsetTop;
      const targetY = targetPosition * 40;
      
      if (currentY !== targetY) {
        const animation = animate(row, {
          y: [0, targetY - currentY],
          opacity: isOptimistic ? [1, 0.8, 1] : 1,
        }, {
          duration: isOptimistic ? 0.2 : 0.3,
          ease: isOptimistic ? 'easeInOut' : 'easeOut',
        });
        
        animation.finished.then(() => {
          row.style.transform = '';
        });
      }
    });
  }
}

// React component with concurrent animations
const AnimatedTableRow = ({ row, index, isOptimistic }) => {
  const [isPending, startTransition] = useTransition();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={row.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ 
          opacity: isOptimistic ? 0.7 : 1, 
          y: 0,
          scale: isPending ? 0.98 : 1
        }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ 
          duration: 0.2,
          ease: 'easeOut'
        }}
        className={`table-row ${isOptimistic ? 'optimistic' : ''}`}
      >
        {/* Row content */}
      </motion.div>
    </AnimatePresence>
  );
};
```

## React 19 Implementation Strategy

### Phase 1: React 19 Foundation Setup
```bash
npm install comlink
```

**Why**: Move heavy computations off the main thread.

```typescript
// worker.ts
import * as Comlink from 'comlink';

const TableWorker = {
  async computeGrouping(rows: any[], groupBy: string[]) {
    // Heavy grouping computation in worker
    return performGrouping(rows, groupBy);
  },
  
  async applyFilters(rows: any[], filters: any[]) {
    // Filter computation in worker
    return rows.filter(row => evaluateFilters(row, filters));
  },
  
  async calculateFormulas(formulas: any[], data: any[]) {
    // Formula evaluation in worker
    return evaluateFormulas(formulas, data);
  }
};

Comlink.expose(TableWorker);

// main.ts
import * as Comlink from 'comlink';

const worker = Comlink.wrap(
  new Worker(new URL('./worker.ts', import.meta.url))
);

class TableComputation {
  async updateGrouping(rows: any[], groupBy: string[]) {
    const result = await worker.computeGrouping(rows, groupBy);
    this.applyGroupingResult(result);
  }
}
```

#### 7. **Gesture Recognition: `hammer.js`**
```bash
npm install hammerjs @types/hammerjs
```

**Why**: Touch gestures for mobile table interaction.

```typescript
import Hammer from 'hammerjs';

class TableGestures {
  private hammer: HammerManager;
  
  constructor(container: HTMLElement, actions: TableActions) {
    this.hammer = new Hammer(container);
    this.setupGestures(actions);
  }
  
  private setupGestures(actions: TableActions) {
    // Pinch to zoom
    this.hammer.get('pinch').set({ enable: true });
    this.hammer.on('pinch', (e) => {
      actions.setZoom(e.scale);
    });
    
    // Pan for scrolling
    this.hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL });
    this.hammer.on('pan', (e) => {
      actions.scroll(e.deltaX, e.deltaY);
    });
    
    // Swipe for navigation
    this.hammer.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });
    this.hammer.on('swipeleft', () => actions.nextPage());
    this.hammer.on('swiperight', () => actions.previousPage());
  }
}
```

#### 8. **Memory Management: `weak-lru-cache`**
```bash
npm install weak-lru-cache
```

**Why**: Automatic memory management for cached computations.

```typescript
import LRU from 'weak-lru-cache';

class TableCache {
  private renderCache = new LRU<string, HTMLElement>(1000);
  private computationCache = new LRU<string, any>(500);
  
  getCachedCell(cellKey: string): HTMLElement | undefined {
    return this.renderCache.get(cellKey);
  }
  
  setCachedCell(cellKey: string, element: HTMLElement) {
    this.renderCache.set(cellKey, element);
  }
  
  getCachedComputation(key: string): any {
    return this.computationCache.get(key);
  }
  
  setCachedComputation(key: string, result: any) {
    this.computationCache.set(key, result);
  }
}
```

## Implementation Strategy

```typescript
// 1. React 19 Compiler setup
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { reactCompiler } from 'vite-plugin-react-compiler';

export default defineConfig({
  plugins: [
    react(),
    reactCompiler({
      target: '19',
      compilationMode: 'annotation', // or 'all'
    })
  ]
});

// 2. Enhanced renderer with React 19 features
class React19TableRenderer {
  constructor(container, actionHandler) {
    this.container = container;
    this.actionHandler = actionHandler; // React 19 action function
    this.optimisticState = new Map();
    this.setupContainer();
  }
  
  setupContainer() {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';
    this.container.style.willChange = 'scroll-position';
    this.container.style.contain = 'layout style paint';
    
    // React 19: Enhanced performance hints
    this.container.style.contentVisibility = 'auto';
    this.container.style.containIntrinsicSize = '1000px';
  }
  
  // React 19: Optimistic rendering
  renderOptimistic(state, optimisticUpdates = new Map()) {
    if (state.version === this.lastVersion && optimisticUpdates.size === 0) return;
    
    const mergedState = this.mergeOptimisticState(state, optimisticUpdates);
    this.renderVisibleRows(mergedState.visibleRows);
    this.updateSelectionOverlay(mergedState.selectedCells);
    
    this.lastVersion = state.version;
    this.optimisticState = optimisticUpdates;
  }
  
  mergeOptimisticState(actualState, optimisticUpdates) {
    // Merge actual state with optimistic updates
    const mergedRows = actualState.visibleRows.map(row => {
      const optimisticRow = optimisticUpdates.get(row.id);
      return optimisticRow ? { ...row, ...optimisticRow } : row;
    });
    
    return {
      ...actualState,
      visibleRows: mergedRows
    };
  }
}

// 3. XState integration with React 19 actions
const useReact19TableState = (config) => {
  const [state, send] = useMachine(tableBaseMachine, { input: config });
  
  // React 19: Actions for state management
  const [, updateAction, isUpdating] = useActionState(
    async (prevState, { type, ...payload }) => {
      send({ type, ...payload });
      return prevState;
    },
    null
  );
  
  // React 19: Optimistic state
  const [optimisticState, setOptimisticState] = useOptimistic(
    state.context,
    (current, optimisticUpdate) => ({
      ...current,
      rows: new Map([...current.rows, ...optimisticUpdate.rows])
    })
  );
  
  const actions = {
    updateCellOptimistic: (rowId, columnId, value) => {
      // Immediate optimistic update
      setOptimisticState({
        rows: new Map([[rowId, { [columnId]: value }]])
      });
      
      // Trigger actual update via action
      updateAction({
        type: 'UPDATE_CELL',
        rowId,
        columnId,
        value
      });
    }
  };
  
  return {
    state: optimisticState,
    actions,
    isUpdating
  };
};
```

### Phase 2: React 19 Advanced Integration

```typescript
// 4. React 19 form integration for table operations
const React19TableForm = ({ onSubmit, children }) => {
  const [formState, formAction, isPending] = useActionState(
    async (prevState, formData) => {
      try {
        const result = await onSubmit(Object.fromEntries(formData));
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    { success: false, error: null }
  );
  
  return (
    <form action={formAction}>
      {children}
      <FormSubmitButton />
      {formState.error && <div className="error">{formState.error}</div>}
    </form>
  );
};

// useFormStatus for nested form components
const FormSubmitButton = () => {
  const { pending, data } = useFormStatus();
  
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Saving...' : 'Save'}
    </button>
  );
};

// 5. React 19 enhanced virtual scrolling
class React19VirtualScroller {
  constructor(container, options) {
    this.container = container;
    this.options = options;
    this.isScrolling = false;
    this.setupEnhancedScrolling();
  }
  
  setupEnhancedScrolling() {
    // React 19: Concurrent scroll handling
    let scrollTimeout;
    
    this.container.addEventListener('scroll', () => {
      if (!this.isScrolling) {
        this.isScrolling = true;
        this.container.style.pointerEvents = 'none'; // Improve scroll performance
      }
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.isScrolling = false;
        this.container.style.pointerEvents = 'auto';
        this.finalizeScroll();
      }, 150);
      
      this.handleScroll();
    }, { passive: true });
  }
  
  handleScroll() {
    // React 19: Use scheduler for non-urgent updates
    scheduler.postTask(() => {
      this.updateViewport();
    }, { priority: 'user-blocking' });
  }
  
  finalizeScroll() {
    // React 19: Background tasks for optimization
    scheduler.postTask(() => {
      this.optimizeRenderedElements();
      this.preloadNearbyContent();
    }, { priority: 'background' });
  }
}

// 6. React 19 Web Worker integration
class React19WorkerManager {
  constructor() {
    this.worker = new Worker(new URL('./table-worker.js', import.meta.url), {
      type: 'module'
    });
    this.setupWorkerIntegration();
  }
  
  setupWorkerIntegration() {
    // React 19: Enhanced worker communication
    this.worker.addEventListener('message', (event) => {
      const { type, data, requestId } = event.data;
      
      // Handle different types of worker responses
      switch (type) {
        case 'COMPUTATION_COMPLETE':
          this.handleComputationComplete(data, requestId);
          break;
        case 'BATCH_UPDATE_COMPLETE':
          this.handleBatchUpdateComplete(data, requestId);
          break;
      }
    });
  }
  
  async computeWithAction(actionType, data) {
    const requestId = crypto.randomUUID();
    
    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      
      this.worker.postMessage({
        type: actionType,
        data,
        requestId
      });
    });
  }
}
```

### Phase 3: React 19 Performance Optimization

```typescript
// 7. React 19 Compiler optimized object pooling
class React19ObjectPool {
  constructor(factory, reset, initialSize = 100) {
    this.factory = factory;
    this.reset = reset;
    this.available = [];
    this.inUse = new WeakSet(); // React 19: WeakSet for better GC
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory());
    }
  }
  
  acquire() {
    const obj = this.available.pop() || this.factory();
    this.inUse.add(obj);
    return obj;
  }
  
  release(obj) {
    if (this.inUse.has(obj)) {
      this.reset(obj);
      this.inUse.delete(obj);
      this.available.push(obj);
    }
  }
  
  // React 19: Automatic cleanup with FinalizationRegistry
  setupAutoCleanup() {
    const registry = new FinalizationRegistry((obj) => {
      this.release(obj);
    });
    
    return (obj) => {
      registry.register(obj, obj);
      return obj;
    };
  }
}

// 8. React 19 enhanced batched updates
class React19BatchedUpdater {
  constructor() {
    this.readQueue = [];
    this.writeQueue = [];
    this.scheduled = false;
    this.controller = new AbortController(); // React 19: AbortController support
  }
  
  async read(fn) {
    return new Promise((resolve, reject) => {
      const operation = { fn, resolve, reject };
      this.readQueue.push(operation);
      this.schedule();
    });
  }
  
  write(fn) {
    return new Promise((resolve, reject) => {
      const operation = { fn, resolve, reject };
      this.writeQueue.push(operation);
      this.schedule();
    });
  }
  
  schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    
    // React 19: Use scheduler.postTask when available
    const scheduleCallback = scheduler?.postTask || requestAnimationFrame;
    
    scheduleCallback(() => {
      if (this.controller.signal.aborted) return;
      
      try {
        // Batch all reads first
        this.readQueue.forEach(({ fn, resolve, reject }) => {
          try {
            resolve(fn());
          } catch (error) {
            reject(error);
          }
        });
        
        // Then batch all writes
        this.writeQueue.forEach(({ fn, resolve, reject }) => {
          try {
            resolve(fn());
          } catch (error) {
            reject(error);
          }
        });
      } finally {
        this.readQueue.length = 0;
        this.writeQueue.length = 0;
        this.scheduled = false;
      }
    }, { priority: 'user-blocking' });
  }
  
  abort() {
    this.controller.abort();
    this.readQueue.length = 0;
    this.writeQueue.length = 0;
    this.scheduled = false;
  }
}

// 9. React 19 enhanced visibility management
class React19VisibilityManager {
  constructor(root) {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const element = entry.target;
          const cellKey = element.getAttribute('data-cell');
          
          if (entry.isIntersecting) {
            this.handleCellVisible(element, cellKey);
          } else {
            this.handleCellHidden(element, cellKey);
          }
        });
      },
      {
        root,
        rootMargin: '50px', // React 19: Smaller buffer for better performance
        threshold: [0, 0.5, 1], // Multiple thresholds for gradual loading
      }
    );
    
    // React 19: Performance observer for monitoring
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.duration > 16) { // Slower than 60fps
          console.warn(`Slow visibility update: ${entry.duration}ms`);
        }
      });
    });
    
    this.performanceObserver.observe({ entryTypes: ['measure'] });
  }
  
  handleCellVisible(element, cellKey) {
    performance.mark('cell-visible-start');
    
    // React 19: Concurrent cell initialization
    scheduler.postTask(() => {
      this.initializeCell(element, cellKey);
      performance.mark('cell-visible-end');
      performance.measure('cell-visible', 'cell-visible-start', 'cell-visible-end');
    }, { priority: 'background' });
  }
  
  handleCellHidden(element, cellKey) {
    // React 19: Deferred cleanup
    scheduler.postTask(() => {
      this.poolElement(element);
    }, { priority: 'background' });
  }
}
```

## React 19 Performance Benchmarks & Monitoring

### Target Performance Metrics

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Initial render (10k rows) | < 100ms | First contentful paint |
| Scroll frame rate | 60 FPS | requestAnimationFrame |
| Cell update | < 1ms | Time to DOM change |
| Sort/filter (10k rows) | < 200ms | Web Worker + render |
| Memory usage (100k rows) | < 500MB | Chrome DevTools |
| Selection update | < 5ms | Canvas redraw |

### Monitoring Setup

```typescript
// Performance monitoring
class PerformanceMonitor {
  private metrics = new Map<string, number[]>();
  
  measure<T>(operation: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    const duration = end - start;
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);
    
    // Log slow operations
    if (duration > 16) { // Slower than 60fps
      console.warn(`Slow operation: ${operation} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  }
  
  getAverageTime(operation: string): number {
    const times = this.metrics.get(operation) || [];
    return times.reduce((a, b) => a + b, 0) / times.length;
  }
  
  getPercentile(operation: string, percentile: number): number {
    const times = this.metrics.get(operation) || [];
    const sorted = times.sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[index];
  }
}

const monitor = new PerformanceMonitor();

// Usage
const renderTime = monitor.measure('cell-render', () => {
  renderer.renderCells(visibleCells);
});
```

## Migration Strategy

### Step 1: Replace Table Body Only
Start by replacing just the table body rendering while keeping React for headers and UI.

### Step 2: Add Virtual Scrolling
Implement virtual scrolling for the direct DOM section.

### Step 3: Canvas Overlays
Add canvas-based selection and highlighting.

### Step 4: Web Workers
Move heavy computations to web workers.

### Step 5: Full Optimization
Implement object pooling, batched updates, and advanced caching.

## Testing Strategy

```typescript
// Performance regression tests
describe('Table Performance', () => {
  it('should render 10k rows in under 100ms', async () => {
    const start = performance.now();
    await renderTable(generateRows(10000));
    const end = performance.now();
    
    expect(end - start).toBeLessThan(100);
  });
  
  it('should maintain 60fps during scrolling', async () => {
    const frameRates: number[] = [];
    let lastTime = performance.now();
    
    const measureFrame = () => {
      const currentTime = performance.now();
      const fps = 1000 / (currentTime - lastTime);
      frameRates.push(fps);
      lastTime = currentTime;
    };
    
    // Simulate scrolling
    for (let i = 0; i < 60; i++) {
      measureFrame();
      await simulateScroll(i * 10);
    }
    
    const averageFps = frameRates.reduce((a, b) => a + b) / frameRates.length;
    expect(averageFps).toBeGreaterThan(55); // Allow some margin
  });
});
```

This hybrid strategy provides the ultimate performance for large-scale table rendering while maintaining React's development experience and XState's state management capabilities. The key is strategic separation of concerns: React for coordination, direct DOM for performance-critical rendering.

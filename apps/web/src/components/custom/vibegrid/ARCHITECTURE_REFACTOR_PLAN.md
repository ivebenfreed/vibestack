# VibeGridX XState Architecture Refactoring Plan

## Current State Analysis

### Problems Identified
1. **XState Anti-Patterns**: Direct method calls between external systems violate actor model
2. **Multiple Sources of Truth**: Row data duplicated across TableMachine, CoordinateManager, SelectionManager
3. **Hackery Issues**: Renderer directly calls `coordinateManager.updateRows()` bypassing XState events
4. **Race Conditions**: Mixed sync/async update patterns create timing dependencies
5. **Brittle Coordination**: Selection state can get out of sync with actual rendered DOM

### Current Architecture Issues

```
Renderer → CoordinateManager (DIRECT CALL - BAD!)
    ↓
SelectionManager (stale data - BAD!)
    ↓
CanvasOverlay (wrong positions - BAD!)
```

**The Core Problem**: We have event-driven XState alongside direct imperative calls, creating an inconsistent hybrid that's prone to bugs.

## XState Best Practices (From Documentation)

### Actor Model Principles
- "Actors communicate via asynchronous message passing"
- "Cannot directly modify each other's internal state"
- "Process one message at a time" in sequential order
- Use callback actors for external system integration

### Recommended Patterns
- **Single Source of Truth**: State lives in machine context
- **Event-Driven**: All updates flow through events
- **Callback Actors**: For DOM/Canvas external systems
- **Immutable Context**: Use `assign()` for all updates

## Refactoring Strategy

### Phase 1: Convert External Systems to Callback Actors

#### 1.1 Renderer Actor
```typescript
// NEW: apps/web/src/components/custom/vibegridx/actors/renderer-actor.ts
export const rendererActor = fromCallback(({ sendBack, receive }) => {
  let renderer: AtomicTableRenderer | null = null;
  
  receive((event) => {
    switch (event.type) {
      case 'INITIALIZE':
        renderer = new AtomicTableRenderer(event.options);
        sendBack({ type: 'RENDERER_READY' });
        break;
        
      case 'RENDER_ROWS':
        if (renderer) {
          renderer.render(event.state);
          // Report back what was actually rendered
          sendBack({ 
            type: 'ROWS_RENDERED',
            actualOrder: renderer.getRenderedRowOrder(),
            viewport: renderer.getViewportInfo()
          });
        }
        break;
        
      case 'UPDATE_VIEWPORT':
        if (renderer) {
          renderer.updateViewport(event.viewport);
          sendBack({ 
            type: 'VIEWPORT_UPDATED',
            viewport: event.viewport
          });
        }
        break;
    }
  });
  
  return () => {
    renderer?.destroy();
    renderer = null;
  };
});
```

#### 1.2 Canvas Actor
```typescript
// NEW: apps/web/src/components/custom/vibegridx/actors/canvas-actor.ts
export const canvasActor = fromCallback(({ sendBack, receive }) => {
  let canvas: CanvasOverlay | null = null;
  
  receive((event) => {
    switch (event.type) {
      case 'INITIALIZE':
        canvas = new CanvasOverlay(event.container, event.config);
        sendBack({ type: 'CANVAS_READY' });
        break;
        
      case 'UPDATE_SELECTION':
        if (canvas) {
          canvas.updateSelection(event.selection);
        }
        break;
        
      case 'UPDATE_COORDINATES':
        if (canvas) {
          canvas.updateCoordinates(event.mapping);
        }
        break;
        
      case 'UPDATE_VIEWPORT':
        if (canvas) {
          canvas.updateViewport(event.viewport);
        }
        break;
    }
  });
  
  return () => {
    canvas?.destroy();
    canvas = null;
  };
});
```

#### 1.3 Coordinate Service Actor
```typescript
// NEW: apps/web/src/components/custom/vibegridx/actors/coordinate-actor.ts
export const coordinateActor = fromCallback(({ sendBack, receive }) => {
  const coordinator = new VibeGridXCoordinateManager();
  
  receive((event) => {
    switch (event.type) {
      case 'UPDATE_ROWS':
        coordinator.updateRows(event.rows, event.sortBy);
        sendBack({ 
          type: 'COORDINATES_UPDATED',
          mapping: coordinator.getMapping(),
          version: coordinator.getVersion()
        });
        break;
        
      case 'UPDATE_COLUMNS':
        coordinator.updateColumns(event.columns);
        sendBack({ 
          type: 'COORDINATES_UPDATED',
          mapping: coordinator.getMapping(),
          version: coordinator.getVersion()
        });
        break;
        
      case 'GET_CELL_POSITION':
        const position = coordinator.getCellPosition(event.rowId, event.columnId);
        sendBack({
          type: 'CELL_POSITION_RESULT',
          requestId: event.requestId,
          position
        });
        break;
    }
  });
});
```

### Phase 2: Refactor TableMachine as Orchestrator

#### 2.1 New TableMachine Structure
```typescript
// MODIFIED: table-machine.ts
export const tableBaseMachine = setup({
  actors: {
    rendererActor,
    canvasActor,
    coordinateActor,
    // Remove selectionCoordinator, editCoordinator, etc.
  }
}).createMachine({
  context: {
    // SINGLE SOURCE OF TRUTH
    rows: [],
    columns: [],
    sortBy: [],
    selectedCells: new Set<string>(),
    coordinateMapping: null,
    viewport: null,
    
    // Actor references
    actors: {
      renderer: null,
      canvas: null,
      coordinator: null
    }
  },
  
  states: {
    initializing: {
      entry: [
        // Spawn all external system actors
        assign({
          actors: ({ spawn }) => ({
            renderer: spawn('rendererActor', { systemId: 'renderer' }),
            canvas: spawn('canvasActor', { systemId: 'canvas' }),
            coordinator: spawn('coordinateActor', { systemId: 'coordinator' })
          })
        })
      ],
      on: {
        ACTORS_READY: 'ready'
      }
    },
    
    ready: {
      on: {
        // Data updates flow through proper event chain
        SET_VISIBLE_ENTITIES: {
          actions: [
            assign({ rows: ({ event }) => event.entityIds }),
            sendTo('coordinator', ({ context }) => ({
              type: 'UPDATE_ROWS',
              rows: context.rows,
              sortBy: context.sortBy
            }))
          ]
        },
        
        COORDINATES_UPDATED: {
          actions: [
            assign({ coordinateMapping: ({ event }) => event.mapping }),
            sendTo('renderer', ({ context }) => ({
              type: 'RENDER_ROWS',
              state: {
                rows: context.rows,
                columns: context.columns,
                coordinateMapping: context.coordinateMapping
              }
            }))
          ]
        },
        
        ROWS_RENDERED: {
          actions: [
            assign({ viewport: ({ event }) => event.viewport }),
            sendTo('canvas', ({ context }) => ({
              type: 'UPDATE_COORDINATES',
              mapping: context.coordinateMapping
            }))
          ]
        },
        
        // Selection events update context first, then notify canvas
        'selection.cell.select': {
          actions: [
            assign({
              selectedCells: ({ context, event }) => {
                const cellKey = `${event.rowId}:${event.columnId}`;
                if (event.ctrlKey) {
                  const newSelection = new Set(context.selectedCells);
                  if (newSelection.has(cellKey)) {
                    newSelection.delete(cellKey);
                  } else {
                    newSelection.add(cellKey);
                  }
                  return newSelection;
                } else {
                  return new Set([cellKey]);
                }
              }
            }),
            sendTo('canvas', ({ context }) => ({
              type: 'UPDATE_SELECTION',
              selection: context.selectedCells
            }))
          ]
        }
      }
    }
  }
});
```

### Phase 3: Simplify Managers to Pure Functions

#### 3.1 Stateless SelectionManager
```typescript
// MODIFIED: selection/VibeGridXSelectionManager.ts
export class VibeGridXSelectionManager {
  // Remove all internal state arrays!
  // No more: selectedCells, visibleRowIds, columns
  
  // Pure functions only
  static calculateRangeSelection(
    start: CellRef, 
    end: CellRef, 
    coordinateMapping: CoordinateMapping
  ): Set<string> {
    const startPos = this.getPositionFromMapping(start, coordinateMapping);
    const endPos = this.getPositionFromMapping(end, coordinateMapping);
    
    if (!startPos || !endPos) return new Set();
    
    const selection = new Set<string>();
    const minRow = Math.min(startPos.rowIndex, endPos.rowIndex);
    const maxRow = Math.max(startPos.rowIndex, endPos.rowIndex);
    const minCol = Math.min(startPos.columnIndex, endPos.columnIndex);
    const maxCol = Math.max(startPos.columnIndex, endPos.columnIndex);
    
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cellRef = this.getPositionFromMapping({ rowIndex: row, columnIndex: col }, coordinateMapping);
        if (cellRef) {
          selection.add(`${cellRef.rowId}:${cellRef.columnId}`);
        }
      }
    }
    
    return selection;
  }
  
  static moveSelection(
    currentCell: CellRef,
    direction: 'up' | 'down' | 'left' | 'right',
    coordinateMapping: CoordinateMapping
  ): CellRef | null {
    // Pure function using coordinate mapping
  }
}
```

### Phase 4: Update Event Handling

#### 4.1 Remove Direct Manager Usage
```typescript
// REMOVE from VibeGridXEvents.tsx:
// All direct SelectionManager calls

// REPLACE with pure XState events:
const handleCellClick = useCallback((rowId: string, columnId: string, event: MouseEvent) => {
  tableSend({
    type: 'selection.cell.select',
    rowId,
    columnId,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey
  });
}, [tableSend]);

const handleDragMove = useCallback((rowId: string, columnId: string) => {
  tableSend({
    type: 'selection.drag.move',
    currentCell: { rowId, columnId }
  });
}, [tableSend]);
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Create actor files (renderer-actor.ts, canvas-actor.ts, coordinate-actor.ts)
- [ ] Basic callback actor implementations
- [ ] Test actor spawning and basic communication

### Week 2: TableMachine Refactor
- [ ] Update TableMachine to use actors
- [ ] Implement event-driven update flow
- [ ] Remove direct method calls
- [ ] Test data flow through events

### Week 3: Manager Simplification
- [ ] Convert SelectionManager to pure functions
- [ ] Remove duplicate state from managers
- [ ] Update event handlers to use pure XState events
- [ ] Test selection functionality

### Week 4: Polish & Performance
- [ ] Optimize event batching for high-frequency updates
- [ ] Add proper error handling in actors
- [ ] Performance testing with large datasets
- [ ] Clean up old code

## Benefits of New Architecture

### ✅ Solves Current Problems
- **No More Hackery**: All updates flow through XState events
- **Single Source of Truth**: TableMachine context is canonical
- **No Race Conditions**: XState guarantees event processing order
- **Consistent State**: All external systems stay in sync

### ✅ XState Best Practices
- **Actor Model Compliance**: Proper message passing
- **Debuggable**: XState dev tools see all state changes
- **Testable**: Pure event-driven architecture
- **Maintainable**: Clear separation of concerns

### ✅ Performance Benefits
- **Efficient Updates**: Batch DOM operations in actors
- **Reduced Re-renders**: Context updates only when needed
- **Better Memory Usage**: No duplicate state storage
- **Predictable Performance**: Controlled update flow

## Migration Strategy

### Backward Compatibility
- Keep existing APIs during transition
- Add feature flags for new vs old behavior
- Gradual migration of event handlers
- Maintain existing test suite

### Risk Mitigation
- Implement in feature branch
- Extensive testing with large datasets
- Performance benchmarking
- Rollback plan if issues arise

### Success Metrics
- [ ] All selection operations work correctly
- [ ] No console errors or warnings
- [ ] Performance equal or better than current
- [ ] XState dev tools show clean event flow
- [ ] No direct method calls between systems

---

## Next Steps

1. **Create actor files** in `apps/web/src/components/custom/vibegridx/actors/`
2. **Start with renderer-actor** as it's the most critical
3. **Test basic event flow** before moving to complex selection logic
4. **Measure performance** at each step to ensure no regressions

This refactoring will eliminate the current architectural hackery and create a robust, maintainable, and performant VibeGridX implementation that properly follows XState patterns.
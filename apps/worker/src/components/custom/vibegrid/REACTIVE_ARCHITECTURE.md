# VibeGrid Reactive Architecture - Perfect State Sync

## Overview

This document describes the new reactive architecture that achieves perfect synchronization of all table state through Legend State observables, following the optimal patterns from Legend State v3 documentation.

## Core Principle: Everything is Observable

```typescript
// All state in one reactive chain
const tableState$ = observable({
  // UI Configuration (reactive)
  sortBy: [],
  filters: [],
  columnVisibility: {},
  groupConfig: null,
  
  // Selection State (reactive)
  selectedCells: Set<string>,
  selectedRows: Set<string>,
  anchorCell: null,
  selectionMode: 'cell',
  isSelecting: false,
  
  // Editing State (reactive)
  editingCell: null,
  editValue: null,
  isEditing: false,
  editValidation: null,
  
  // Data (lazy computed from Legend State)
  data: () => getEntity$(entityType).get(),
  
  // Perfect Synchronized View (lazy computed)
  view: function() {
    // All dependencies tracked automatically
    const data = this.data.get();
    const sortBy = this.sortBy.get();
    const filters = this.filters.get();
    // ... all other state
    
    // Transform and return complete view
    return completeTableView;
  }
});
```

## Key Files

### 1. `unified-table-state.ts`
- **Purpose**: Core reactive state management
- **Features**:
  - All table state as observables (UI, selection, editing)
  - Lazy computed functions following Legend State best practices
  - Single `view` computed that perfectly syncs everything
  - Batched updates for performance

### 2. `reactive-bridge.ts`
- **Purpose**: Simple connection layer
- **Features**:
  - XState events → Update observables
  - Renderer observes computed view
  - No data copying, no window functions
  - Clean event mapping

## Architecture Benefits

### 1. Perfect Synchronization
- Change any state → View updates automatically
- No manual coordination needed
- Selection, editing, sorting, filtering all in sync

### 2. Legend State Best Practices Applied
- **Lazy Computed Functions**: `() => { ... }` instead of `computed(() => { ... })`
- **Automatic Tracking**: Using `get()` tracks dependencies
- **Batching**: Multiple state changes batched for performance
- **Observe for Side Effects**: Renderer uses `observe()` pattern

### 3. No Complex Bridging
- **Eliminated**: Window functions (`__vibegrid_send_data_to_table_machine`)
- **Eliminated**: Manual data passing (`PROCESS_GROUPS_WITH_DATA`)
- **Eliminated**: Hybrid approaches in legend-state-ui-bridge.ts
- **Result**: Direct observable → renderer connection

## Data Flow

```
User Interaction
      ↓
XState Event (e.g., 'selection.cell.select')
      ↓
Update Observable (tableState$.selectedCells.set(...))
      ↓
Computed View Recalculates (automatic)
      ↓
Renderer Re-renders (via observe())
```

## Implementation Example

### Selection State Handling

```typescript
// In unified-table-state.ts
const tableState$ = observable({
  selectedCells: new Set<string>(),
  selectedRows: new Set<string>(),
  anchorCell: null,
  selectionMode: 'cell',
  isSelecting: false,
  
  view: function() {
    // Selection state automatically included in view
    const selectedCells = this.selectedCells.get();
    const selectedRows = this.selectedRows.get();
    // ... transforms data with selection info
    return { rows, selectedCells, selectedRows, ... };
  }
});

// In reactive-bridge.ts
'selection.cell.select': (event) => {
  batch(() => {
    const cells = new Set(tableState$.selectedCells.get());
    cells.add(event.cellId);
    tableState$.selectedCells.set(cells);
    tableState$.selectionMode.set('cell');
  });
}
```

### Editing State Handling

```typescript
// Complete editing state synchronized
startEditing(cell, initialValue) {
  batch(() => {
    tableState$.editingCell.set(cell);
    tableState$.editValue.set(initialValue);
    tableState$.isEditing.set(true);
    tableState$.editValidation.set(null);
  });
}

// View automatically includes editing state
view: function() {
  const editingCell = this.editingCell.get();
  const editValue = this.editValue.get();
  const isEditing = this.isEditing.get();
  // ... perfect sync with data and UI state
}
```

## Migration Path

### Phase 1: Replace Current Bridge
1. Replace `legend-state-ui-bridge.ts` with `reactive-bridge.ts`
2. Initialize `unified-table-state.ts` in VibeGrid
3. Connect renderer to observe the computed view

### Phase 2: Simplify XState
1. Remove complex event handlers
2. XState only dispatches to reactive bridge
3. Remove UI store actor

### Phase 3: Remove Legacy Code
1. Delete window function handlers
2. Remove PROCESS_GROUPS_WITH_DATA events
3. Clean up redundant data passing

## Performance Optimizations

1. **Lazy Evaluation**: Computed functions only run when accessed
2. **Fine-Grained Updates**: Only affected parts recalculate
3. **Batching**: Multiple state changes in single update cycle
4. **No Data Duplication**: Data stays in Legend State

## Complete State Coverage

The new architecture handles ALL table state reactively:

- ✅ **Data State**: From Legend State entities
- ✅ **Sort State**: Multi-column sorting
- ✅ **Filter State**: Advanced filtering
- ✅ **Column State**: Visibility, order, width
- ✅ **Group State**: Hierarchical grouping
- ✅ **Selection State**: Cell, row, range, multi
- ✅ **Editing State**: Value, validation, mode
- ✅ **UI State**: Loading, errors, pagination

## Conclusion

This reactive architecture achieves the vision of perfect state synchronization where:
- UI state IS part of the observable chain
- Everything updates automatically
- No complex bridging or manual coordination
- Following Legend State v3 best practices

The result is cleaner, more maintainable code with better performance and perfect synchronization of all table state.
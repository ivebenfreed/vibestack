# Unified TableRenderer Architecture Plan

## Overview
Consolidate `CleanTableRenderer` (1540 lines) and `EnhancedTableRenderer` (533 lines) into a single, unified renderer that handles both flat and grouped data with full interactivity.

## Current Problems
1. **Code Duplication**: ~2000+ lines across 2 files with overlapping functionality
2. **Inheritance Complexity**: Enhanced calls `super.render()` but overrides core methods
3. **Interaction Gaps**: Virtual rows have limited interactivity compared to regular rows
4. **Runtime Overhead**: Always creates Enhanced even for simple tables
5. **Maintenance Burden**: Changes to Clean can break Enhanced unexpectedly

## Unified Architecture

### Core Principle
**One renderer, one row model, full interactivity everywhere.**

```typescript
class UnifiedTableRenderer {
  // Single render pipeline handles all row types
  render(state: RenderState): void {
    this.updateDimensions(state);
    this.renderHeader(state);
    this.renderRows(state); // Handles flat + grouped seamlessly
    this.cleanupRows();
    this.syncHeaderScroll();
  }
  
  // Unified row rendering - no virtual vs regular distinction
  private renderRows(state: RenderState): void {
    const rows = state.rows; // Can contain data, group headers, summaries
    
    rows.forEach((row, index) => {
      const rowEl = this.createOrUpdateRow(row, index);
      
      // Every row gets full interactivity
      this.attachRowInteractions(rowEl, row);
      
      // Additive behaviors based on row type
      if (row.type === 'group') {
        this.addGroupHeaderBehavior(rowEl, row);
      }
      
      if (row.type === 'summary') {
        this.addSummaryBehavior(rowEl, row);
      }
    });
  }
}
```

### Unified Row Model

**Single Row Interface**:
```typescript
interface UnifiedTableRow {
  id: string;
  type: 'data' | 'group' | 'summary';
  data: Record<string, any>;
  level?: number;        // Nesting level for groups
  isExpanded?: boolean;  // For group headers
  groupId?: string;      // Parent group reference
  height: number;        // Dynamic row height
}
```

**Full Interactivity for All Row Types**:
- ✅ **Editing**: Click any cell to edit (data, group aggregations, summaries)
- ✅ **Selection**: Individual rows, ranges, entire groups
- ✅ **Drag/Drop**: Reorder within groups, move between groups
- ✅ **Keyboard Navigation**: Tab through all rows consistently
- ✅ **Context Menus**: Right-click works everywhere
- ✅ **Real-time Updates**: Live sync for all row types

### Implementation Strategy

#### Phase 1: Create UnifiedTableRenderer
1. **Start with CleanTableRenderer as base** (proven, stable)
2. **Extract core methods** into shared utilities:
   - `renderRow()` → handles any row type
   - `createCell()` → works for data/group/summary cells
   - `attachInteractions()` → consistent across all rows
3. **Add grouped data support** from Enhanced:
   - Group header rendering with expand/collapse
   - Nested row indentation and styling
   - Aggregation display in group headers
4. **Eliminate inheritance** - direct implementation only

#### Phase 2: Unified Event Handling
1. **Single event delegation system** for all row types
2. **Consistent interaction patterns**:
   - Click: Select row (any type)
   - Double-click: Edit cell (data rows) or toggle group (group headers)
   - Drag: Move rows within/between groups
   - Keyboard: Navigate through mixed row types

#### Phase 3: Migration
1. **Update RendererActor** to use UnifiedTableRenderer
2. **Replace EnhancedTableRenderer imports** across codebase
3. **Remove CleanTableRenderer and EnhancedTableRenderer files**
4. **Update type definitions** to use unified interfaces

### Benefits

#### Performance
- **Single render pipeline** - no inheritance overhead
- **Reduced bundle size** - eliminate duplicate code
- **Better tree shaking** - unused features can be removed
- **Direct method calls** - no virtual method dispatch

#### Developer Experience
- **Single source of truth** - one place to fix bugs
- **Predictable behavior** - same interactions everywhere  
- **Easier testing** - test one renderer with different data shapes
- **Simpler debugging** - clear execution path

#### User Experience
- **Consistent interactions** - editing works in grouped views
- **Full feature parity** - no gaps between flat/grouped modes
- **Seamless transitions** - same UI regardless of grouping
- **Better accessibility** - consistent keyboard navigation

### File Structure

```
renderers/
├── core/
│   ├── UnifiedTableRenderer.ts     # New unified implementation (~1200 lines)
│   ├── CleanTableRenderer.ts       # [DELETE]
│   └── EnhancedTableRenderer.ts    # [DELETE]
├── utils/
│   ├── row-rendering.ts           # Extracted row utilities
│   ├── cell-rendering.ts          # Extracted cell utilities
│   ├── group-behaviors.ts         # Group-specific behaviors
│   └── interaction-handlers.ts    # Event handling utilities
└── index.ts                       # Export UnifiedTableRenderer
```

### Migration Checklist

- [x] Remove deprecated TableRenderer
- [x] Create UnifiedTableRenderer with merged functionality
- [x] Implement unified row model
- [x] Add Legend State integration for clean data flow
- [x] Remove fallback code paths 
- [x] Test with flat data (6 task records, sorting verified)
- [ ] Extract shared utilities from Clean/Enhanced
- [ ] Add full interactivity for all row types (editing, selection, drag/drop)
- [ ] Test with grouped data functionality
- [ ] Update RendererActor to use unified renderer (partially done)
- [ ] Update all imports across codebase
- [ ] Remove CleanTableRenderer and EnhancedTableRenderer
- [ ] Update type definitions and exports

### Success Criteria

1. **Functionality**: All current features work (flat tables, grouping, editing, selection)
2. **Performance**: No regression in render times
3. **Bundle Size**: Reduction in total renderer code size
4. **Consistency**: Same interactions work across all row types
5. **Maintainability**: Single file to maintain instead of two

### Risk Mitigation

1. **Incremental Migration**: Keep existing renderers during development
2. **Feature Parity Testing**: Comprehensive test suite covering all scenarios
3. **Performance Benchmarks**: Ensure no performance regressions
4. **Rollback Plan**: Git branches allow quick revert if needed
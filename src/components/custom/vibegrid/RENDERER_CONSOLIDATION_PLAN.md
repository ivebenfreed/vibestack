# VibeGrid Renderer & Store Consolidation Plan

## Overview
Consolidate from ~51 files to ~25 files while maintaining clarity and keeping files under 800 lines.

---

## PHASE 1: Store Cleanup (9 → 4 files)

### Files to Keep As-Is:
- [x] `stores/data-state.ts` - No changes needed
- [x] `stores/interaction-state.ts` - No changes needed
- [x] `stores/data-loading-stages.ts` - No changes needed

### Files to Merge INTO `stores/visual-state.ts`:
- [ ] Merge `stores/visual-rows-state.ts` INTO `stores/visual-state.ts`
  - Copy `createVisualRows$()` function
  - Copy `visualRowsOperations` object
  - Update imports in visual-state.ts to include GroupProcessor

- [ ] Merge `stores/columns-observable.ts` INTO `stores/visual-state.ts`
  - Copy `columnOperations` object
  - Copy `columns$` observable
  - Copy all column management functions
  - Update visual-state.ts to include column state as visual concern

### Files to Delete:
- [ ] Delete `stores/pure-observables.ts.backup`
- [ ] Delete `stores/pure-observables.ts` (after verifying no remaining imports)
- [ ] Delete `stores/visual-rows-state.ts` (after merging)
- [ ] Delete `stores/columns-observable.ts` (after merging)

### Update Imports:
- [ ] Search and replace all imports of `columns-observable` → `visual-state`
- [ ] Remove all imports of `visual-rows-state` (functionality now in visual-state)
- [ ] Update all `columnOperations.xxx` calls to `visualOperations.xxx`

---

## PHASE 2: Renderer Consolidation (42 → ~20 files)

### 2.1 Components Directory

#### CREATE: `components/BodyRenderer.ts` (~600 lines)
Merge these files in order:

1. **FROM `managers/RowRenderer.ts`:**
   - Copy entire `RowRenderer` class
   - Copy `ROW_HEIGHT` constant
   - Copy `createRowElement()` method
   - Copy `updateRowElement()` method
   - Copy `handleRowClick()` method

2. **FROM `managers/CellRenderer.ts`:**
   - Copy `CellRenderer` class
   - Copy `createCellElement()` method
   - Copy `updateCellElement()` method
   - Copy `getCellValue()` method
   - Copy `handleCellClick()` method
   - Copy `handleCellDoubleClick()` method

3. **FROM `modules/CellFormatter.ts`:**
   - Copy `formatCellValue()` function
   - Copy `getCellDisplayValue()` function
   - Copy all formatting helper functions
   - Copy type formatting logic

#### KEEP AS-IS:
- [x] `components/HeaderRenderer.ts` - Already exists, no changes

#### MOVE:
- [ ] Move `modules/GroupRenderer.ts` → `components/GroupRenderer.ts`

---

### 2.2 Interactions Directory

#### CREATE: `interactions/SelectionHandler.ts` (~400 lines)
Merge these files:

1. **FROM `modules/SelectionController.ts`:**
   - Copy entire `SelectionController` class
   - Copy `handleCellSelection()` method
   - Copy `handleRowSelection()` method
   - Copy `handleRangeSelection()` method
   - Copy `clearSelection()` method
   - Copy selection state management logic

2. **FROM `utils/interaction-handlers.ts`:**
   - Copy `setupRowSelectionHandlers()` function
   - Copy selection-related event listeners
   - Copy multi-select logic (Ctrl/Shift handling)

#### CREATE: `interactions/EditingHandler.ts` (~300 lines)
Merge these files:

1. **FROM `modules/KeyboardNavigationController.ts`:**
   - Copy entire `KeyboardNavigationController` class
   - Copy keyboard event handlers
   - Copy navigation logic (arrow keys)
   - Copy Enter/F2 edit triggers

2. **FROM `utils/interaction-handlers.ts`:**
   - Copy `setupCellEditingHandlers()` function
   - Copy `setupKeyboardHandlers()` function
   - Copy edit mode management

#### CREATE: `interactions/ColumnHandler.ts` (~500 lines)
Merge these files:

1. **FROM `modules/ColumnWidthManager.ts`:**
   - Copy `ColumnWidthManager` class
   - Copy `startResize()` method
   - Copy `updateResize()` method
   - Copy `endResize()` method
   - Copy width calculation logic

2. **FROM `modules/ScrollController.ts`:**
   - Copy `ScrollController` class
   - Copy `syncHeaderScroll()` method
   - Copy `syncBodyScroll()` method
   - Copy scroll event handlers

3. **FROM `utils/interaction-handlers.ts`:**
   - Copy `setupColumnDragHandlers()` function
   - Copy `setupColumnResizeHandlers()` function
   - Copy drag ghost image creation
   - Copy drop zone visualization

---

### 2.3 Utils Directory

#### CREATE: `utils/dom-helpers.ts` (~400 lines)
Merge these files:

1. **FROM `factories/DOMElementFactory.ts`:**
   - Copy `createElement()` method
   - Copy `createContainer()` method
   - Copy `createHeaderCell()` method
   - Copy `createDataCell()` method
   - Copy `createCheckbox()` method
   - Remove class wrapper, make functions standalone

2. **FROM `modules/BadgeRenderer.ts`:**
   - Copy `renderBadge()` function
   - Copy `createBadgeElement()` function
   - Copy badge styling logic

3. **FROM existing `utils/` files:**
   - Keep any pure DOM utility functions
   - Keep className helpers
   - Keep style manipulation helpers

---

### 2.4 Keep As-Is
- [x] `core/TableRenderer.ts` (currently SimplePassiveRenderer)
- [x] `core/ObserverManager.ts`
- [x] `overlays/OverlayManager.ts`
- [x] `cell-renderers/` entire directory (15 files)

---

## PHASE 3: Cleanup

### Delete These Directories:
- [ ] `renderers/managers/` (after copying content)
- [ ] `renderers/modules/` (after copying content)
- [ ] `renderers/factories/` (after copying content)
- [ ] `renderers/utils/` (after consolidating)

### Delete These Individual Files:
- [ ] `managers/EventManager.ts` (logic distributed to interaction handlers)
- [ ] `utils/interaction-handlers.ts` (after splitting into new files)
- [ ] Any remaining empty directories

### Update All Imports:
- [ ] Update SimplePassiveRenderer imports
- [ ] Update VibeGrid.tsx imports
- [ ] Update all component imports
- [ ] Update index.ts exports

---

## PHASE 4: Testing Checklist

### Verify Core Functionality:
- [ ] Table renders correctly
- [ ] Headers display and sort
- [ ] Cell selection works (single, multi, range)
- [ ] Column resizing works
- [ ] Column reordering works
- [ ] Scroll synchronization works
- [ ] Cell editing works
- [ ] Keyboard navigation works
- [ ] Group expand/collapse works

### Verify No Breaking Changes:
- [ ] Run TypeScript compilation
- [ ] Check browser console for errors
- [ ] Test with sample data
- [ ] Test with large datasets
- [ ] Test all cell types render correctly

---

## File Size Estimates

### After Consolidation:
- `stores/` (4 files, ~2,700 lines total)
  - data-state.ts (~600 lines)
  - visual-state.ts (~800 lines) # includes columns + visual-rows + grouping
  - interaction-state.ts (~700 lines)
  - data-loading-stages.ts (~400 lines)

- `renderers/` (~20 files, ~5,000 lines total)
  - core/TableRenderer.ts (~800 lines)
  - core/ObserverManager.ts (~330 lines)
  - components/HeaderRenderer.ts (~400 lines)
  - components/BodyRenderer.ts (~600 lines)
  - components/GroupRenderer.ts (~200 lines)
  - interactions/SelectionHandler.ts (~400 lines)
  - interactions/EditingHandler.ts (~300 lines)
  - interactions/ColumnHandler.ts (~500 lines)
  - overlays/OverlayManager.ts (~300 lines)
  - utils/dom-helpers.ts (~400 lines)
  - cell-renderers/* (15 files, ~1,500 lines total)

**Total Reduction: From 51 files to ~24 files (even better consolidation!)**

---

## Implementation Order

1. **Start with Phase 1** (Store cleanup) - Low risk, immediate benefit
2. **Test thoroughly** after Phase 1
3. **Implement Phase 2.1** (Components) - Test each component
4. **Implement Phase 2.2** (Interactions) - Test interactions
5. **Implement Phase 2.3** (Utils) - Test utilities
6. **Phase 3** (Cleanup) - Remove old files
7. **Phase 4** (Final testing) - Comprehensive testing

---

## Notes

- Each phase can be completed independently
- Test after each major consolidation
- Keep backup of current working state before starting
- Use git commits after each successful phase
- If any file exceeds 800 lines during consolidation, split it
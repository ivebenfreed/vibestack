# Phase 1 Implementation Checklist

## Testing Route: http://localhost:5173/debug/ultra-table

### Week 1: Core Selection System

#### Day 1: Selection Observable Setup
- [ ] Create `tableSelection$` observable with ranges, activeCell, and computed functions
- [ ] Add `selectedCells()` computed function returning Set<string> of "row:col" keys
- [ ] Add `selectedRowIds()` computed function for row-based operations
- [ ] Test basic selection state on debug route
- [ ] Verify selection observable updates correctly

#### Day 2: Cell Click Handlers
- [ ] Implement `handleCellClick()` function with mouse event handling
- [ ] Add support for single cell selection (clear previous, set new)
- [ ] Add support for Ctrl+click multi-selection
- [ ] Add support for Shift+click range extension
- [ ] Test all click modes on debug route

#### Day 3: Mouse Drag Selection
- [ ] Add drag state to selection observable (dragStart, dragCurrent, isDragging)
- [ ] Implement `handleCellMouseDown()` for drag initiation
- [ ] Implement `handleCellMouseMove()` for drag updates
- [ ] Implement `handleMouseUp()` for drag completion
- [ ] Test drag selection creates proper ranges

#### Day 4: Selection Visual Layer
- [ ] Create `SelectionOverlay` component using React Portal
- [ ] Add `SelectionRange` component for individual range visualization
- [ ] Implement border styling with CSS classes
- [ ] Add semi-transparent fill backgrounds
- [ ] Test visual feedback matches selection state

#### Day 5: Selection Integration
- [ ] Add data attributes to table cells (data-row, data-col, data-field)
- [ ] Integrate selection handlers with existing table cells
- [ ] Add selection clearing on empty area clicks
- [ ] Test selection works with virtualized rows
- [ ] Verify no performance impact on table rendering

### Week 2: Copy/Paste & Undo/Redo

#### Day 6: Native Clipboard API
- [ ] Create `clipboard$` observable with data, operation, source fields
- [ ] Implement `copySelectedCells()` using native Clipboard API
- [ ] Add multiple format support (text/plain, text/html, text/csv)
- [ ] Convert selection to TSV format for Excel compatibility
- [ ] Test copy operation preserves data correctly

#### Day 7: Paste Implementation
- [ ] Implement `pasteData()` function with target cell parameter
- [ ] Add clipboard format detection (HTML table, CSV, plain text)
- [ ] Parse TSV/CSV data into row/column structure
- [ ] Apply pasted data using `batch()` for performance
- [ ] Test paste operations maintain data types

#### Day 8: Undo/Redo System
- [ ] Import `undoRedo` from Legend State helpers
- [ ] Setup `undoRedo()` on table data observable
- [ ] Extract `undo`, `redo`, `undos$`, `redos$` functions/observables
- [ ] Create undo/redo button components using `use$(undos$)` and `use$(redos$)`
- [ ] Test undo/redo works with cell edits and paste operations

#### Day 9: Keyboard Shortcuts
- [ ] Create `useTableKeyboardShortcuts()` hook
- [ ] Add Ctrl+C for copy selected cells
- [ ] Add Ctrl+V for paste to active cell
- [ ] Add Ctrl+Z for undo, Ctrl+Shift+Z for redo
- [ ] Add Delete key for clearing selected cells
- [ ] Test keyboard shortcuts work when table has focus

#### Day 10: Copy/Paste Polish
- [ ] Add copy/paste status indicators in UI
- [ ] Implement paste preview before applying
- [ ] Add error handling for invalid clipboard data
- [ ] Add success toast notifications for operations
- [ ] Test edge cases (empty clipboard, large selections)

### Week 2: Bulk Operations & Performance

#### Day 11: Bulk Update System
- [ ] Create `bulkUpdateSelectedCells()` function using `batch()`
- [ ] Add bulk value setting for selected cells
- [ ] Add bulk format application
- [ ] Add bulk deletion of selected cells
- [ ] Test bulk operations with 1000+ selected cells

#### Day 12: Selection Toolbar
- [ ] Create floating selection toolbar component using Portal
- [ ] Add selection count display with Badge component
- [ ] Add "Select All" and "Clear Selection" buttons
- [ ] Add bulk action buttons (Copy, Delete, Format)
- [ ] Position toolbar at bottom center when selection exists

#### Day 13: Performance Optimization
- [ ] Add `Memo` components for individual cells to prevent re-renders
- [ ] Use `observer()` HOC on table components
- [ ] Implement efficient selection checking with Set lookups
- [ ] Add `batch()` for all multi-cell operations
- [ ] Test with 10,000 rows to verify performance targets

#### Day 14: Selection Persistence
- [ ] Add selection state to URL query parameters (optional)
- [ ] Implement selection restoration after page refresh
- [ ] Add selection export/import functionality
- [ ] Test selection persistence across browser sessions
- [ ] Verify selection state survives table data updates

#### Day 15: Testing & Integration
- [ ] Add comprehensive tests for all selection modes
- [ ] Test copy/paste round-trip data integrity
- [ ] Test undo/redo with complex selection operations
- [ ] Verify keyboard navigation works in all browsers
- [ ] Performance test: 10k+ rows with range selection under 100ms

## Debug Route Testing Scenarios

### Test Data Setup
- [ ] Create test data with 1000+ rows for performance testing
- [ ] Include mixed data types (string, number, date, boolean)
- [ ] Add some pre-filled formulas for formula testing later
- [ ] Ensure data has sufficient variety for meaningful selection testing

### Manual Testing Checklist
- [ ] Single cell selection highlights correctly
- [ ] Drag selection creates proper rectangular ranges
- [ ] Ctrl+click adds additional selections
- [ ] Shift+click extends selection from last active cell
- [ ] Copy selection and paste in external app (Excel/Sheets)
- [ ] Copy from external app and paste into table
- [ ] Undo/redo buttons enable/disable correctly
- [ ] Delete key clears selected cell values
- [ ] Selection toolbar appears/disappears correctly
- [ ] All keyboard shortcuts work as expected

### Performance Validation
- [ ] Selection of 1000+ cells completes under 100ms
- [ ] Copy operation with 1000+ cells completes under 200ms
- [ ] Paste operation with 1000+ cells completes under 300ms
- [ ] Undo/redo operations complete under 50ms
- [ ] Table remains responsive during bulk operations
- [ ] Memory usage stays reasonable with large selections

Each item should be tested on the debug route before marking complete. This ensures all functionality works correctly in the actual application environment.
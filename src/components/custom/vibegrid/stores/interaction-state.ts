/**
 * Interaction State - tableInteraction$ observable
 * Extracted from pure-observables.ts lines 872-1437
 *
 * This module handles all UI interaction state including selection, editing,
 * hover, drag, and menu states. This is the most complex layer with ~566 lines
 * of sophisticated interaction logic.
 */

import { observable, computed, batch } from '@legendapp/state';
import { log } from '@/logger';

const fileLog = log('components/custom/vibegrid/stores/interaction-state.ts');

// ====================================
// TYPES
// ====================================

export interface TableInteractionState {
  // Selection state
  selectedCells: Set<string>;
  selectedRows: Set<string>;
  anchorCell: string | null;
  selectionMode: 'cell' | 'row' | 'range' | 'multi';
  isSelecting: boolean;

  // Select all checkbox state
  selectAllCheckboxState: {
    checked: boolean;
    indeterminate: boolean;
  };

  // Editing state
  editingCell: string | null;
  editValue: any;
  isEditing: boolean;
  editValidation: { isValid: boolean; message?: string } | null;

  // Hover state
  hoveredCell: string | null;
  hoveredRow: string | null;

  // Drag state
  isDragging: boolean;
  dragSource: string | null;
  dragTarget: string | null;

  // Resize state
  resizingColumn: string | null;
  resizeStartX: number;
  resizeStartWidth: number;

  // UI Menu/Dropdown State
  headerMenuState: {
    openMenu: string | null; // columnId of open menu
    position: { x: number; y: number };
    menuType: 'filter' | 'sort' | 'settings' | null;
  };

  contextMenuState: {
    isOpen: boolean;
    position: { x: number; y: number };
    context: 'cell' | 'row' | 'column' | 'header' | null;
    targetId: string | null; // cellId, rowId, or columnId
  };

  columnVisibilityMenuState: {
    isOpen: boolean;
    searchValue: string;
  };

  groupConfigMenuState: {
    isOpen: boolean;
  };
}

// Re-export the observable type
export type TableInteraction$ = ReturnType<typeof createTableInteraction$>;

// ====================================
// INTERACTION STATE OBSERVABLE FACTORY
// ====================================

export function createTableInteraction$(tableCore$?: any) {
  fileLog.info('<¯ Creating tableInteraction$ observable');

  const tableInteraction$ = observable({
    // Selection state
    selectedCells: new Set<string>(),
    selectedRows: new Set<string>(),
    anchorCell: null as string | null,
    selectionMode: 'cell' as 'cell' | 'row' | 'range' | 'multi',
    isSelecting: false,

    // Select all checkbox state (computed)
    selectAllCheckboxState: computed(() => {
      if (!tableCore$) {
        return { checked: false, indeterminate: false };
      }

      const selectedCells = tableInteraction$.selectedCells.get();
      const processedRows = tableCore$.processedRows.get();
      const columns = tableCore$.columns.get();
      const visibleColumns = columns.filter((col: any) => {
        const visibility = tableCore$.columnVisibility.get();
        return visibility[col.id] !== false;
      });

      const totalCells = processedRows.length * visibleColumns.length;
      const selectedCount = selectedCells.size;

      if (selectedCount === 0) {
        return { checked: false, indeterminate: false };
      } else if (selectedCount === totalCells) {
        return { checked: true, indeterminate: false };
      } else {
        return { checked: false, indeterminate: true };
      }
    }),

    // Editing state
    editingCell: null as string | null,
    editValue: null as any,
    isEditing: false,
    editValidation: null as { isValid: boolean; message?: string } | null,

    // Hover state
    hoveredCell: null as string | null,
    hoveredRow: null as string | null,

    // Drag state
    isDragging: false,
    dragSource: null as { row: string; column: string } | null,
    dragTarget: null as { row: string; column: string } | null,

    // Drag selection state (for drag-to-select ranges)
    isDragSelecting: false,
    dragSelectStart: null as string | null,
    dragSelectCurrent: null as string | null,

    // Resize state
    resizingColumn: null as string | null,
    resizeStartX: 0,
    resizeStartWidth: 0,

    // Column resize state for overlay
    columnResize: null as {
      isResizing: boolean;
      columnId: string;
      startWidth: number;
      newWidth: number;
    } | null,

    // UI Menu/Dropdown State
    headerMenuState: {
      openMenu: null as string | null, // columnId of open menu
      position: { x: 0, y: 0 },
      menuType: null as 'filter' | 'sort' | 'settings' | null
    },

    contextMenuState: {
      isOpen: false,
      position: { x: 0, y: 0 },
      context: null as 'cell' | 'row' | 'column' | 'header' | null,
      targetId: null as string | null // cellId, rowId, or columnId
    },

    columnVisibilityMenuState: {
      isOpen: false,
      searchValue: ''
    },

    groupConfigMenuState: {
      isOpen: false
    },

    // Direct manipulation methods
    selectCell(cellId: string, isMulti: boolean = false) {
      batch(() => {
        const selected = tableInteraction$.selectedCells.get();

        if (!isMulti) {
          // Clear existing selection if not multi-select
          tableInteraction$.selectedCells.set(new Set());
        }

        // Toggle cell selection
        const newSelected = new Set(tableInteraction$.selectedCells.get());
        if (newSelected.has(cellId)) {
          newSelected.delete(cellId);
        } else {
          newSelected.add(cellId);
        }

        tableInteraction$.selectedCells.set(newSelected);
        tableInteraction$.anchorCell.set(cellId);
      });

      fileLog.info('<¯ Cell selected', { cellId, isMulti, selectionCount: tableInteraction$.selectedCells.get().size });
    },

    selectRow(rowId: string, isMulti: boolean = false) {
      batch(() => {
        if (!isMulti) {
          // Clear existing selection if not multi-select
          tableInteraction$.selectedRows.set(new Set());
        }

        // Toggle row selection
        const newSelected = new Set(tableInteraction$.selectedRows.get());
        if (newSelected.has(rowId)) {
          newSelected.delete(rowId);
        } else {
          newSelected.add(rowId);
        }

        tableInteraction$.selectedRows.set(newSelected);
      });

      fileLog.info('<¯ Row selected', { rowId, isMulti, selectionCount: tableInteraction$.selectedRows.get().size });
    },

    selectAll() {
      if (!tableCore$) return;

      batch(() => {
        const processedRows = tableCore$.processedRows.get();
        const columns = tableCore$.columns.get();
        const visibleColumns = columns.filter((col: any) => {
          const visibility = tableCore$.columnVisibility.get();
          return visibility[col.id] !== false;
        });

        const allCells = new Set<string>();
        for (const row of processedRows) {
          for (const column of visibleColumns) {
            allCells.add(`${row.id}:${column.id}`);
          }
        }

        tableInteraction$.selectedCells.set(allCells);
      });

      fileLog.info('<¯ All cells selected', { totalCells: tableInteraction$.selectedCells.get().size });
    },

    clearSelection() {
      batch(() => {
        tableInteraction$.selectedCells.set(new Set());
        tableInteraction$.selectedRows.set(new Set());
        tableInteraction$.anchorCell.set(null);
      });

      fileLog.info('<¯ Selection cleared');
    },

    startEdit(cellId: string, initialValue?: any) {
      batch(() => {
        tableInteraction$.editingCell.set(cellId);
        tableInteraction$.editValue.set(initialValue ?? null);
        tableInteraction$.isEditing.set(true);
        tableInteraction$.editValidation.set(null);
      });

      fileLog.info('<¯ Edit started', { cellId, initialValue });
    },

    updateEditValue(value: any) {
      tableInteraction$.editValue.set(value);
      // Clear validation on value change
      tableInteraction$.editValidation.set(null);
    },

    saveEdit(finalValue?: any) {
      const editingCell = tableInteraction$.editingCell.get();
      const editValue = finalValue !== undefined ? finalValue : tableInteraction$.editValue.get();

      if (!editingCell) {
        fileLog.warn('  saveEdit called but no cell is being edited');
        return;
      }

      // The actual saving logic would be handled by the component
      // This just updates the editing state

      batch(() => {
        tableInteraction$.editingCell.set(null);
        tableInteraction$.editValue.set(null);
        tableInteraction$.isEditing.set(false);
        tableInteraction$.editValidation.set(null);
      });

      fileLog.info('<¯ Edit saved', { cellId: editingCell, value: editValue });
    },

    cancelEdit() {
      const editingCell = tableInteraction$.editingCell.get();

      batch(() => {
        tableInteraction$.editingCell.set(null);
        tableInteraction$.editValue.set(null);
        tableInteraction$.isEditing.set(false);
        tableInteraction$.editValidation.set(null);
      });

      fileLog.info('<¯ Edit cancelled', { cellId: editingCell });
    },

    setHover(cellId: string | null, rowId: string | null = null) {
      batch(() => {
        tableInteraction$.hoveredCell.set(cellId);
        tableInteraction$.hoveredRow.set(rowId);
      });
    },

    clearHover() {
      batch(() => {
        tableInteraction$.hoveredCell.set(null);
        tableInteraction$.hoveredRow.set(null);
      });
    },

    startDrag(source: { row: string; column: string }) {
      batch(() => {
        tableInteraction$.isDragging.set(true);
        tableInteraction$.dragSource.set(source);
        tableInteraction$.dragTarget.set(null);
      });

      fileLog.info('<¯ Drag started', { source });
    },

    updateDragTarget(target: { row: string; column: string }) {
      tableInteraction$.dragTarget.set(target);
    },

    endDrag() {
      const source = tableInteraction$.dragSource.get();
      const target = tableInteraction$.dragTarget.get();

      batch(() => {
        tableInteraction$.isDragging.set(false);
        tableInteraction$.dragSource.set(null);
        tableInteraction$.dragTarget.set(null);
      });

      fileLog.info('<¯ Drag ended', { source, target });

      return { source, target };
    },

    startDragSelect(cellId: string) {
      batch(() => {
        tableInteraction$.isDragSelecting.set(true);
        tableInteraction$.dragSelectStart.set(cellId);
        tableInteraction$.dragSelectCurrent.set(cellId);
      });

      fileLog.info('<¯ Drag selection started', { startCell: cellId });
    },

    updateDragSelect(cellId: string) {
      tableInteraction$.dragSelectCurrent.set(cellId);
    },

    endDragSelect() {
      const start = tableInteraction$.dragSelectStart.get();
      const current = tableInteraction$.dragSelectCurrent.get();

      batch(() => {
        tableInteraction$.isDragSelecting.set(false);
        tableInteraction$.dragSelectStart.set(null);
        tableInteraction$.dragSelectCurrent.set(null);
      });

      fileLog.info('<¯ Drag selection ended', { start, end: current });

      return { start, end: current };
    },

    startColumnResize(columnId: string, startX: number, startWidth: number) {
      batch(() => {
        tableInteraction$.resizingColumn.set(columnId);
        tableInteraction$.resizeStartX.set(startX);
        tableInteraction$.resizeStartWidth.set(startWidth);
        tableInteraction$.columnResize.set({
          isResizing: true,
          columnId,
          startWidth,
          newWidth: startWidth
        });
      });

      fileLog.info('<¯ Column resize started', { columnId, startX, startWidth });
    },

    updateColumnResize(currentX: number) {
      const resizingColumn = tableInteraction$.resizingColumn.get();
      const startX = tableInteraction$.resizeStartX.get();
      const startWidth = tableInteraction$.resizeStartWidth.get();

      if (!resizingColumn) return;

      const deltaX = currentX - startX;
      const newWidth = Math.max(50, startWidth + deltaX); // Minimum width of 50px

      const currentResize = tableInteraction$.columnResize.get();
      if (currentResize) {
        tableInteraction$.columnResize.set({
          ...currentResize,
          newWidth
        });
      }

      return { columnId: resizingColumn, newWidth };
    },

    endColumnResize() {
      const resizingColumn = tableInteraction$.resizingColumn.get();
      const newWidth = tableInteraction$.columnResize.get()?.newWidth;

      batch(() => {
        tableInteraction$.resizingColumn.set(null);
        tableInteraction$.resizeStartX.set(0);
        tableInteraction$.resizeStartWidth.set(0);
        tableInteraction$.columnResize.set(null);
      });

      fileLog.info('<¯ Column resize ended', { columnId: resizingColumn, newWidth });

      return { columnId: resizingColumn, newWidth };
    },

    openHeaderMenu(columnId: string, position: { x: number; y: number }, menuType: 'filter' | 'sort' | 'settings') {
      batch(() => {
        // Close other menus first
        tableInteraction$.contextMenuState.isOpen.set(false);
        tableInteraction$.columnVisibilityMenuState.isOpen.set(false);
        tableInteraction$.groupConfigMenuState.isOpen.set(false);

        // Open header menu
        tableInteraction$.headerMenuState.openMenu.set(columnId);
        tableInteraction$.headerMenuState.position.set(position);
        tableInteraction$.headerMenuState.menuType.set(menuType);
      });

      fileLog.info('<¯ Header menu opened', { columnId, position, menuType });
    },

    closeHeaderMenu() {
      batch(() => {
        tableInteraction$.headerMenuState.openMenu.set(null);
        tableInteraction$.headerMenuState.position.set({ x: 0, y: 0 });
        tableInteraction$.headerMenuState.menuType.set(null);
      });

      fileLog.info('<¯ Header menu closed');
    },

    openContextMenu(position: { x: number; y: number }, context: 'cell' | 'row' | 'column' | 'header', targetId: string) {
      batch(() => {
        // Close other menus first
        tableInteraction$.headerMenuState.openMenu.set(null);
        tableInteraction$.columnVisibilityMenuState.isOpen.set(false);
        tableInteraction$.groupConfigMenuState.isOpen.set(false);

        // Open context menu
        tableInteraction$.contextMenuState.isOpen.set(true);
        tableInteraction$.contextMenuState.position.set(position);
        tableInteraction$.contextMenuState.context.set(context);
        tableInteraction$.contextMenuState.targetId.set(targetId);
      });

      fileLog.info('<¯ Context menu opened', { position, context, targetId });
    },

    closeContextMenu() {
      batch(() => {
        tableInteraction$.contextMenuState.isOpen.set(false);
        tableInteraction$.contextMenuState.position.set({ x: 0, y: 0 });
        tableInteraction$.contextMenuState.context.set(null);
        tableInteraction$.contextMenuState.targetId.set(null);
      });

      fileLog.info('<¯ Context menu closed');
    },

    openColumnVisibilityMenu() {
      batch(() => {
        // Close other menus first
        tableInteraction$.headerMenuState.openMenu.set(null);
        tableInteraction$.contextMenuState.isOpen.set(false);
        tableInteraction$.groupConfigMenuState.isOpen.set(false);

        // Open column visibility menu
        tableInteraction$.columnVisibilityMenuState.isOpen.set(true);
        tableInteraction$.columnVisibilityMenuState.searchValue.set('');
      });

      fileLog.info('<¯ Column visibility menu opened');
    },

    closeColumnVisibilityMenu() {
      batch(() => {
        tableInteraction$.columnVisibilityMenuState.isOpen.set(false);
        tableInteraction$.columnVisibilityMenuState.searchValue.set('');
      });

      fileLog.info('<¯ Column visibility menu closed');
    },

    setColumnVisibilitySearch(searchValue: string) {
      tableInteraction$.columnVisibilityMenuState.searchValue.set(searchValue);
    },

    openGroupConfigMenu() {
      batch(() => {
        // Close other menus first
        tableInteraction$.headerMenuState.openMenu.set(null);
        tableInteraction$.contextMenuState.isOpen.set(false);
        tableInteraction$.columnVisibilityMenuState.isOpen.set(false);

        // Open group config menu
        tableInteraction$.groupConfigMenuState.isOpen.set(true);
      });

      fileLog.info('<¯ Group config menu opened');
    },

    closeGroupConfigMenu() {
      batch(() => {
        tableInteraction$.groupConfigMenuState.isOpen.set(false);
      });

      fileLog.info('<¯ Group config menu closed');
    }
  });

  return tableInteraction$;
}
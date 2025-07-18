// ====================================
// OVERLAY SLICE - State Management for Canvas Overlays
// ====================================

import { assign } from 'xstate';
import type { CellRef, ViewportInfo } from '../../../types';

// ====================================
// STATE INTERFACE
// ====================================

export interface OverlayState {
  // Viewport information
  viewport: ViewportInfo | null;
  
  // Coordinate mapping from table machine (single source of truth)
  coordinateMapping: any | null;
  
  // Selection state (also managed by selection slice, but overlay needs its own copy)
  selectedCells: Set<string>;
  selectionBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  anchorCell: { key: string; row: number; column: number } | null;
  
  // Editing state (also managed by edit slice)
  editingCell: CellRef | null;
  
  // Fill state
  fillState: {
    isActive: boolean;
    direction: 'vertical' | 'horizontal' | null;
    originalSelection: Set<string>;
    previewCells: Set<string>;
  } | null;
  
  // Clipboard state
  clipboardState: {
    copiedCells: Set<string>;
    isCut: boolean;
  } | null;
  
  // Shape visibility flags
  shapesVisible: {
    selection: boolean;
    editing: boolean;
    dragPreview: boolean;
    fillHandle: boolean;
    fillPreview: boolean;
    copyIndicator: boolean;
  };
  
  // Performance metrics
  lastRenderTime: number;
  renderCount: number;
}

// ====================================
// INITIAL STATE
// ====================================

export const createInitialOverlayState = (initialViewport?: ViewportInfo): OverlayState => ({
  viewport: initialViewport || {
    start: 0,
    end: 50,
    height: 600,
    width: 800,
    scrollTop: 0,
    scrollLeft: 0,
    itemHeight: 40
  } as ViewportInfo,
  coordinateMapping: null,
  selectedCells: new Set(),
  selectionBounds: null,
  anchorCell: null,
  editingCell: null,
  fillState: null,
  clipboardState: null,
  shapesVisible: {
    selection: true,
    editing: true,
    dragPreview: false,
    fillHandle: false,
    fillPreview: false,
    copyIndicator: false
  },
  lastRenderTime: 0,
  renderCount: 0
});

// ====================================
// ACTIONS
// ====================================

export const overlayActions = {
  updateViewport: assign({
    viewport: (_, event: any) => event.viewport
  }),

  updateCoordinateMapping: assign({
    coordinateMapping: (_, event: any) => event.mapping
  }),

  updateSelectedCells: assign({
    selectedCells: (_, event: any) => new Set(event.cells),
    shapesVisible: ({ context }: any) => ({
      ...context.shapesVisible,
      selection: event.cells.size > 0,
      fillHandle: event.cells.size > 0
    })
  }),

  setAnchorCell: assign({
    anchorCell: (_, event: any) => event.anchor
  }),

  updateEditingCell: assign({
    editingCell: (_, event: any) => event.cell,
    shapesVisible: ({ context }: any) => ({
      ...context.shapesVisible,
      editing: !!event.cell
    })
  }),

  startFill: assign({
    fillState: ({ context, event }: any) => ({
      isActive: true,
      direction: event.direction,
      originalSelection: new Set(context.selectedCells),
      previewCells: new Set()
    }),
    shapesVisible: ({ context }: any) => ({
      ...context.shapesVisible,
      fillHandle: false,
      fillPreview: true
    })
  }),

  updateFillPreview: assign({
    fillState: ({ context, event }: any) => context.fillState ? {
      ...context.fillState,
      previewCells: new Set(event.previewCells)
    } : null
  }),

  completeFill: assign({
    fillState: () => null,
    shapesVisible: ({ context }: any) => ({
      ...context.shapesVisible,
      fillHandle: context.selectedCells.size > 0,
      fillPreview: false
    })
  }),

  cancelFill: assign({
    fillState: () => null,
    shapesVisible: ({ context }: any) => ({
      ...context.shapesVisible,
      fillHandle: context.selectedCells.size > 0,
      fillPreview: false
    })
  }),

  setClipboard: assign({
    clipboardState: (_, event: any) => ({
      copiedCells: new Set(event.cells),
      isCut: event.isCut || false
    }),
    shapesVisible: ({ context }: any) => ({
      ...context.shapesVisible,
      copyIndicator: true
    })
  }),

  clearClipboard: assign({
    clipboardState: () => null,
    shapesVisible: ({ context }: any) => ({
      ...context.shapesVisible,
      copyIndicator: false
    })
  }),

  updateShapeVisibility: assign({
    shapesVisible: ({ context, event }: any) => ({
      ...context.shapesVisible,
      ...event.visibility
    })
  }),

  updatePerformanceMetrics: assign({
    lastRenderTime: (_, event: any) => event.duration,
    renderCount: ({ context }: any) => context.renderCount + 1
  })
};
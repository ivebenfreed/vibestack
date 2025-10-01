import { observable } from '@legendapp/state';

/**
 * Process Studio UI State - ALL UI CONCERNS
 * Following VibeGrid pattern: Legend State for ALL reactive state
 *
 * This includes:
 * - Selection state (selected nodes, edges)
 * - Interaction state (hover, drag, resize)
 * - Panel state (properties, palette, entity link dialog)
 * - Canvas state (zoom, pan, viewport)
 * - Dirty tracking (unsaved changes)
 */
export const processStudioUI$ = observable<{
  // Active process
  activeProcessId: string | null;

  // Selection state
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  multiSelectNodeIds: Set<string>;

  // Hover state
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;

  // Interaction state
  isDraggingNode: boolean;
  isConnecting: boolean;
  connectionSource: string | null;

  // Panel visibility
  showPropertiesPanel: boolean;
  showNodePalette: boolean;
  showEntityLinkDialog: boolean;

  // Canvas viewport
  canvasZoom: number;
  canvasPan: { x: number; y: number };

  // Dirty state
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;

  // Context menu
  contextMenu: {
    isOpen: boolean;
    position: { x: number; y: number };
    targetType: 'node' | 'edge' | 'canvas' | null;
    targetId: string | null;
  };

  // Dialogs
  entityLinkDialog: {
    isOpen: boolean;
    nodeId: string | null;
  };

  createProcessDialog: {
    isOpen: boolean;
  };
}>({
  activeProcessId: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  multiSelectNodeIds: new Set(),
  hoveredNodeId: null,
  hoveredEdgeId: null,
  isDraggingNode: false,
  isConnecting: false,
  connectionSource: null,
  showPropertiesPanel: false,
  showNodePalette: true,
  showEntityLinkDialog: false,
  canvasZoom: 1,
  canvasPan: { x: 0, y: 0 },
  hasUnsavedChanges: false,
  lastSavedAt: null,
  contextMenu: {
    isOpen: false,
    position: { x: 0, y: 0 },
    targetType: null,
    targetId: null
  },
  entityLinkDialog: {
    isOpen: false,
    nodeId: null
  },
  createProcessDialog: {
    isOpen: false
  }
});

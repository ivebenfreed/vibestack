import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useSelector } from '@xstate/react';
import { 
  useTableConfiguration, 
  useTableMachine,
  type InitializationRefs 
} from './VibeGridXCore';
import { useChangeDetection, useRenderStateExtractor } from './VibeGridXHooks';
import { createModularTableRenderer, type ModularTableRenderer } from './renderers';
import { CanvasOverlay } from './overlays/CanvasOverlay';
import { EditingOverlayManager, useEditingOverlay } from './editing/EditingOverlayManager';
import { createEventCoordinator, type EventCoordinator } from './events/EventCoordinator';
import type { RenderState, TableRow, CellRef, Column } from './types';
import './vibegridx.css';

// ====================================
// COMPONENT PROPS
// ====================================

interface VibeGridXModularProps<T = any> {
  entityType: 'task' | 'project' | 'user';
  columns: Column<T>[];
  tableId?: string;
  className?: string;
  height?: number;
  width?: number;
  
  // Optional external data
  data?: any[];
  relationshipData?: any;
  
  // Event handlers
  onCellClick?: (rowId: string, columnId: string) => void;
  onCellDoubleClick?: (rowId: string, columnId: string) => void;
  onSelectionChange?: (selectedCells: Set<string>) => void;
  onEditingChange?: (editingCell: CellRef | null) => void;
  onPerformanceUpdate?: (metrics: any) => void;
  
  // Performance options
  enableVirtualScrolling?: boolean;
  enableCanvasOverlays?: boolean;
  bufferSize?: number;
  
  // Feature flags
  enableGrouping?: boolean;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableDragAndDrop?: boolean;
  enableEditing?: boolean;
  
  // Custom renderers
  customCellRenderers?: Array<{
    type: string;
    renderer: any;
  }>;
}

// ====================================
// MAIN COMPONENT
// ====================================

export const VibeGridXModular = <T extends Record<string, any> = any>(
  props: VibeGridXModularProps<T>
): React.ReactElement => {
  const {
    columns,
    className = '',
    height = 600,
    width = '100%',
    relationshipData,
    onCellClick,
    onCellDoubleClick,
    onSelectionChange,
    onEditingChange,
    onPerformanceUpdate,
    enableEditing = true,
    customCellRenderers
  } = props;
  
  // ====================================
  // REFS AND STATE
  // ====================================
  
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ModularTableRenderer | null>(null);
  const canvasOverlayRef = useRef<CanvasOverlay | null>(null);
  const eventCoordinatorRef = useRef<EventCoordinator | null>(null);
  const integrationRef = useRef<EntityIntegrationLayer | null>(null);
  const selectedCellsRef = useRef<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Editing state
  const { editingCell, startEditing, stopEditing, isEditing } = useEditingOverlay();
  
  // ====================================
  // CORE INITIALIZATION
  // ====================================
  
  const { tableConfig, tableId } = useTableConfiguration(props);
  const { tableState, tableSend, tableActor } = useTableMachine(tableConfig);
  
  // Get actor state using useSelector
  const state = useSelector(tableActor, (state) => state);
  
  // Entity integration
  useEntityIntegration(tableActor, props.entityType, integrationRef);
  
  // State extraction hooks
  const { hasDataChanged, getChangedRows, hasSelectionChanged } = useChangeDetection();
  const { extractRenderStateFromActor } = useRenderStateExtractor(integrationRef);
  
  // ====================================
  // EVENT HANDLERS
  // ====================================
  
  const handleCellClick = useCallback((rowId: string, columnId: string) => {
    onCellClick?.(rowId, columnId);
  }, [onCellClick]);
  
  const handleCellDoubleClick = useCallback((rowId: string, columnId: string) => {
    if (enableEditing) {
      startEditing(rowId, columnId);
    }
    onCellDoubleClick?.(rowId, columnId);
  }, [enableEditing, startEditing, onCellDoubleClick]);
  
  const handleSelectionChange = useCallback((selectedCells: Set<string>) => {
    selectedCellsRef.current = selectedCells;
    onSelectionChange?.(selectedCells);
  }, [onSelectionChange]);
  
  const handleEditSave = useCallback((rowId: string, columnId: string, value: any) => {
    // Save through integration layer
    if (integrationRef.current) {
      integrationRef.current.updateEntity(rowId, { [columnId]: value });
    }
    
    stopEditing();
  }, [stopEditing]);
  
  const handleEditCancel = useCallback(() => {
    stopEditing();
    onEditingChange?.(null);
  }, [stopEditing, onEditingChange]);
  
  const handleEditNavigate = useCallback((direction: string) => {
    // Navigate to next cell
    // This would be implemented based on your navigation logic
    console.log('Navigate:', direction);
  }, []);
  
  // ====================================
  // RENDERER INITIALIZATION
  // ====================================
  
  useEffect(() => {
    if (!containerRef.current || isInitialized) return;
    
    // Debug: Check container dimensions
    console.log('VibeGridXModular: Container dimensions before init:', {
      offsetHeight: containerRef.current.offsetHeight,
      offsetWidth: containerRef.current.offsetWidth,
      computedHeight: window.getComputedStyle(containerRef.current).height,
      computedWidth: window.getComputedStyle(containerRef.current).width,
      parentHeight: containerRef.current.parentElement?.offsetHeight,
      parentWidth: containerRef.current.parentElement?.offsetWidth
    });
    
    // Create modular renderer
    const renderer = createModularTableRenderer({
      container: containerRef.current,
      columns: tableConfig.columns,
      relationshipData: relationshipData,
      customCellRenderers,
      onCanvasContainerReady: (canvasContainer) => {
        // TEMPORARILY DISABLED: Canvas overlay is blocking view
        console.log('CanvasOverlay initialization disabled for debugging');
        /*
        // Initialize canvas overlay
        const overlay = new CanvasOverlay(canvasContainer, {
          columns: tableConfig.columns,
          dimensionManager: state.context.dimensionManager,
          overlayActor: state.context.actors.overlayActor
        });
        
        canvasOverlayRef.current = overlay;
        
        // Set callbacks
        overlay.onSelectionChange = handleSelectionChange;
        overlay.onFillComplete = (originalCells, fillCells) => {
          console.log('Fill complete:', { originalCells: originalCells.size, fillCells: fillCells.size });
        };
        */
      },
      onCellClick: (rowId, columnId, event) => {
        eventCoordinatorRef.current?.dispatch({
          type: 'cell:click',
          rowId,
          columnId,
          event
        });
      },
      onCellDoubleClick: (rowId, columnId, event) => {
        eventCoordinatorRef.current?.dispatch({
          type: 'cell:doubleClick',
          rowId,
          columnId,
          event
        });
      },
      onScroll: (viewport) => {
        // canvasOverlayRef.current?.updateViewport(viewport);
        eventCoordinatorRef.current?.dispatch({
          type: 'scroll:viewport',
          viewport
        });
      }
    });
    
    // Set dimension manager
    if (state.context.dimensionManager) {
      renderer.setDimensionManager(state.context.dimensionManager);
    }
    
    // Create event coordinator
    const coordinator = createEventCoordinator({
      tableSend,
      canvasOverlay: canvasOverlayRef.current,
      integration: integrationRef.current,
      columns: tableConfig.columns,
      onCellClick: handleCellClick,
      onCellDoubleClick: handleCellDoubleClick,
      onSelectionChange: handleSelectionChange,
      onEditingChange,
      onPerformanceUpdate
    });
    
    // Connect renderer to event coordinator
    renderer.setEventCoordinator(coordinator);
    
    // Store references
    rendererRef.current = renderer;
    eventCoordinatorRef.current = coordinator;
    
    setIsInitialized(true);
    
    return () => {
      renderer.destroy();
      coordinator.destroy();
      canvasOverlayRef.current?.destroy();
    };
  }, [
    isInitialized,
    tableConfig.columns,
    customCellRenderers,
    state.context.dimensionManager,
    state.context.actors.overlayActor,
    tableSend,
    handleCellClick,
    handleCellDoubleClick,
    handleSelectionChange,
    onEditingChange,
    onPerformanceUpdate
  ]);
  
  // ====================================
  // RENDER STATE UPDATES
  // ====================================
  
  useEffect(() => {
    if (!rendererRef.current || !isInitialized) return;
    
    // Extract render state from XState with columns
    const renderState = extractRenderStateFromActor(state, columns);
    
    // Check if we need to update
    if (renderState && (hasDataChanged(renderState) || hasSelectionChanged(renderState))) {
      console.log('VibeGridXModular: Calling renderer.render with:', {
        rows: renderState.rows.length,
        columns: renderState.columns.length,
        renderer: !!rendererRef.current
      });
      
      // Update renderer
      rendererRef.current.render(renderState);
      
      // Update canvas overlay data mappings
      /*
      if (canvasOverlayRef.current && state.context.visibleRowIds) {
        canvasOverlayRef.current.updateDataMappings(
          state.context.visibleRowIds,
          tableConfig.columns.map(c => c.id)
        );
      }
      */
      
      // Update selected cells
      const selectedCells = state.context.actors.selectionCoordinator?.getSnapshot()?.context.selectedCells;
      if (selectedCells) {
        rendererRef.current.setSelectedCells(selectedCells);
        // canvasOverlayRef.current?.updateSelection(selectedCells);
      }
    }
  }, [
    state,
    isInitialized,
    extractRenderStateFromActor,
    hasDataChanged,
    hasSelectionChanged,
    columns,
    tableConfig.columns
  ]);
  
  // Update relationship data when it changes
  useEffect(() => {
    if (!rendererRef.current || !isInitialized || !relationshipData) return;
    
    rendererRef.current.setRelationshipData(relationshipData);
  }, [relationshipData, isInitialized]);
  
  // ====================================
  // KEYBOARD HANDLING
  // ====================================
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!eventCoordinatorRef.current) return;
    
    // Convert React event to native event type
    const nativeEvent = event.nativeEvent;
    
    // Dispatch keyboard event
    eventCoordinatorRef.current.dispatch({
      type: `keyboard:${event.key.toLowerCase()}` as any,
      event: nativeEvent
    });
  }, []);
  
  // ====================================
  // RENDER
  // ====================================
  
  // Get cell value for editing
  const getCellValue = useCallback((rowId: string, columnId: string) => {
    const entity = integrationRef.current?.getEntity(rowId);
    return entity?.[columnId];
  }, []);
  
  return (
    <div 
      className={`vibegridx-container ${className}`}
      style={{ height, width, position: 'relative' }}
    >
      <div 
        ref={containerRef}
        className="vibegridx-renderer"
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      />
      
      {enableEditing && (
        <EditingOverlayManager
          editingCell={editingCell}
          columns={columns}
          getCellValue={getCellValue}
          onSave={handleEditSave}
          onCancel={handleEditCancel}
          onNavigate={handleEditNavigate}
          container={containerRef.current || undefined}
        />
      )}
    </div>
  );
};

// ====================================
// HOOKS
// ====================================

export function useVibeGridXModular() {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<CellRef | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  
  const gridProps = {
    onSelectionChange: setSelectedCells,
    onEditingChange: setEditingCell,
    onPerformanceUpdate: setPerformanceMetrics
  };
  
  return {
    gridProps,
    selectedCells,
    editingCell,
    performanceMetrics
  };
}
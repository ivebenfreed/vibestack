// ====================================
// VIBEGRIDX COORDINATE ACTOR
// ====================================
//
// XState callback actor that wraps the VibeGridXCoordinateManager
// for proper actor model integration. Handles coordinate calculations
// and position mapping for the entire table system.
//
// This eliminates direct method calls to the coordinate manager
// and ensures all coordinate updates flow through XState events.
//
// ====================================

import { fromCallback } from 'xstate';
import type { VibeGridXCoordinateManager, CoordinateMapping } from '../coordinates/VibeGridXCoordinateManager';
import type { Column, CellRef, SortConfig, TableRow } from '../types';

// ====================================
// EVENT TYPES
// ====================================

export type CoordinateActorEvent = 
  | { type: 'UPDATE_ROWS'; rows: TableRow[]; sortBy: SortConfig[] }
  | { type: 'UPDATE_COLUMNS'; columns: Column[] }
  | { type: 'GET_CELL_POSITION'; requestId: string; rowId: string; columnId: string }
  | { type: 'GET_RANGE_SELECTION'; requestId: string; start: CellRef; end: CellRef }
  | { type: 'GET_MAPPING'; requestId: string }
  | { type: 'CLEAR_MAPPINGS' }
  | { type: 'DESTROY' };

export type CoordinateActorResponse =
  | { type: 'COORDINATES_UPDATED'; mapping: CoordinateMapping; version: number }
  | { type: 'CELL_POSITION_RESULT'; requestId: string; position: { x: number; y: number; row: number; column: number } | null }
  | { type: 'RANGE_SELECTION_RESULT'; requestId: string; selection: Set<string> }
  | { type: 'MAPPING_RESULT'; requestId: string; mapping: CoordinateMapping }
  | { type: 'MAPPINGS_CLEARED' }
  | { type: 'COORDINATE_ERROR'; error: string };

// ====================================
// COORDINATE ACTOR
// ====================================

export const coordinateActor = fromCallback<CoordinateActorEvent, CoordinateActorResponse>(({ sendBack, receive, input, self }) => {
  let coordinator: VibeGridXCoordinateManager | null = null;
  let isInitialized = false;
  let pendingEvents: CoordinateActorEvent[] = [];
  
  console.log('CoordinateActor: Created callback actor');
  
  // Initialize coordinate manager immediately
  import('../coordinates/VibeGridXCoordinateManager').then(({ createVibeGridXCoordinateManager }) => {
    coordinator = createVibeGridXCoordinateManager();
    isInitialized = true;
    console.log('CoordinateActor: Coordinate manager initialized');
    
    // Process any pending events
    if (pendingEvents.length > 0) {
      console.log('CoordinateActor: Processing', pendingEvents.length, 'pending events');
      pendingEvents.forEach(event => processEvent(event));
      pendingEvents = [];
    }
  }).catch((error) => {
    console.error('CoordinateActor: Failed to initialize coordinate manager:', error);
    sendBack({ 
      type: 'COORDINATE_ERROR', 
      error: `Failed to initialize coordinator: ${error.message}` 
    });
  });
  
  const processEvent = (event: CoordinateActorEvent) => {
    console.log('CoordinateActor: Processing event:', event.type, event);
    
    try {
      if (!coordinator) {
        console.warn('CoordinateActor: Coordinator not initialized yet');
        sendBack({ 
          type: 'COORDINATE_ERROR', 
          error: 'Coordinate manager not initialized' 
        });
        return;
      }
      
      switch (event.type) {
        case 'UPDATE_ROWS':
          console.log('CoordinateActor: Updating rows:', {
            rowCount: event.rows.length,
            sortByCount: event.sortBy.length,
            firstRowId: event.rows[0]?.id || 'none'
          });
          
          // Update coordinate manager with new row data
          coordinator.updateRows(event.rows, event.sortBy);
          
          // Send back updated mapping
          const rowMapping = coordinator.getMapping();
          const rowVersion = coordinator.getVersion();
          
          console.log('CoordinateActor: Rows updated, sending back mapping:', {
            version: rowVersion,
            rowCount: rowMapping.rows.length,
            sortBy: rowMapping.sortBy
          });
          
          const response = { 
            type: 'COORDINATES_UPDATED',
            mapping: rowMapping,
            version: rowVersion
          };
          console.log('CoordinateActor: About to sendBack for rows:', response);
          sendBack(response);
          console.log('CoordinateActor: sendBack completed for rows');
          break;
          
        case 'UPDATE_COLUMNS':
          console.log('CoordinateActor: Updating columns:', {
            columnCount: event.columns.length,
            columnIds: event.columns.map(c => c.id)
          });
          
          // Update coordinate manager with new column data
          coordinator.updateColumns(event.columns);
          
          // Send back updated mapping
          const columnMapping = coordinator.getMapping();
          const columnVersion = coordinator.getVersion();
          
          console.log('CoordinateActor: Columns updated, sending back mapping:', {
            version: columnVersion,
            columnCount: columnMapping.columns.length
          });
          
          const columnResponse = { 
            type: 'COORDINATES_UPDATED',
            mapping: columnMapping,
            version: columnVersion
          };
          console.log('CoordinateActor: About to sendBack for columns:', columnResponse);
          sendBack(columnResponse);
          console.log('CoordinateActor: sendBack completed for columns');
          break;
          
        case 'GET_CELL_POSITION':
          console.log('CoordinateActor: Getting cell position:', {
            requestId: event.requestId,
            rowId: event.rowId,
            columnId: event.columnId
          });
          
          // Get cell position from coordinate manager
          const position = coordinator.getCellPosition(event.rowId, event.columnId);
          
          console.log('CoordinateActor: Cell position result:', {
            requestId: event.requestId,
            position
          });
          
          sendBack({
            type: 'CELL_POSITION_RESULT',
            requestId: event.requestId,
            position
          });
          break;
          
        case 'GET_RANGE_SELECTION':
          console.log('CoordinateActor: Getting range selection:', {
            requestId: event.requestId,
            start: event.start,
            end: event.end
          });
          
          // Calculate range selection using coordinate manager
          const selection = coordinator.calculateCellRange(event.start, event.end);
          
          console.log('CoordinateActor: Range selection result:', {
            requestId: event.requestId,
            selectionSize: selection.size
          });
          
          sendBack({
            type: 'RANGE_SELECTION_RESULT',
            requestId: event.requestId,
            selection
          });
          break;
          
        case 'GET_MAPPING':
          console.log('CoordinateActor: Getting current mapping:', {
            requestId: event.requestId
          });
          
          // Get current mapping
          const currentMapping = coordinator.getMapping();
          
          sendBack({
            type: 'MAPPING_RESULT',
            requestId: event.requestId,
            mapping: currentMapping
          });
          break;
          
        case 'CLEAR_MAPPINGS':
          console.log('CoordinateActor: Clearing all mappings');
          
          // Clear coordinate manager
          coordinator.clear();
          
          sendBack({ type: 'MAPPINGS_CLEARED' });
          break;
          
        case 'DESTROY':
          console.log('CoordinateActor: Destroying coordinate manager');
          
          // Coordinate manager doesn't need explicit cleanup
          coordinator = null;
          break;
          
        default:
          console.warn('CoordinateActor: Unknown event type:', event);
      }
    } catch (error) {
      console.error('CoordinateActor: Error processing event:', error);
      sendBack({ 
        type: 'COORDINATE_ERROR', 
        error: `Error processing ${event.type}: ${error.message}` 
      });
    }
  };
  
  receive((event) => {
    console.log('CoordinateActor: Received event:', event.type, event);
    
    if (!isInitialized) {
      console.log('CoordinateActor: Queuing event until initialized:', event.type);
      pendingEvents.push(event);
      return;
    }
    
    processEvent(event);
  });
  
  // Cleanup function - called when actor is stopped
  return () => {
    console.log('CoordinateActor: Cleanup - clearing coordinate manager');
    
    if (coordinator) {
      coordinator.clear();
      coordinator = null;
    }
  };
});

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Type guard to check if an event is a coordinate actor event
 */
export function isCoordinateActorEvent(event: any): event is CoordinateActorEvent {
  return event && typeof event.type === 'string' && 
    [
      'UPDATE_ROWS', 'UPDATE_COLUMNS', 'GET_CELL_POSITION', 'GET_RANGE_SELECTION',
      'GET_MAPPING', 'CLEAR_MAPPINGS', 'DESTROY'
    ].includes(event.type);
}

/**
 * Type guard to check if a response is a coordinate actor response
 */
export function isCoordinateActorResponse(response: any): response is CoordinateActorResponse {
  return response && typeof response.type === 'string' && 
    [
      'COORDINATES_UPDATED', 'CELL_POSITION_RESULT', 'RANGE_SELECTION_RESULT',
      'MAPPING_RESULT', 'MAPPINGS_CLEARED', 'COORDINATE_ERROR'
    ].includes(response.type);
}
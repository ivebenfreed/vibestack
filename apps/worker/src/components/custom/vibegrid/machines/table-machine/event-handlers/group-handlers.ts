// ====================================
// GROUP EVENT HANDLERS
// ====================================
// Handles all group-related events and state transitions

import { assign, raise } from 'xstate';
import { groupActions } from '../slices/group-slice';
import { dimensionActions } from '../slices/dimensions-slice';
import { createLogger, type LogLevel } from '@/logger/simple-logger';

const LOG_LEVEL: LogLevel = 'info';  // DEBUG: Group toggle debugging
const log = createLogger('group-handlers', LOG_LEVEL);

// ====================================
// GROUP EVENT HANDLERS
// ====================================

export const groupHandlers = {
  // Configuration events
  'group.config.set': {
    actions: [
      // Debug the event structure
      ({ event }) => {
        log.info('GroupHandlers: group.config.set event received', {
          event: event,
          hasConfig: 'config' in event,
          eventKeys: Object.keys(event),
          configValue: (event as any).config,
          eventType: typeof event,
          eventConstructor: event.constructor.name
        });
      },
      groupActions.setGroupConfig,
      
      // SIMPLIFIED APPROACH: Let the UI bridge handle the grouping data flow
      ({ context, self }) => {
        log.info('🎯 GroupHandlers: group.config.set - triggering UI bridge to send data');
        
        // The grouping configuration has been set, now we need to ensure the 
        // legend-state-ui-bridge detects this and sends the data.
        // We'll trigger a manual check since the UI change observer might not 
        // have caught the grouping configuration change yet.
        
        // Check if the bridge function exists and trigger it manually
        if (typeof (window as any).__vibegrid_send_data_to_table_machine === 'function') {
          log.info('🎯 GroupHandlers: Bridge function available, requesting data from Legend State');
          
          // Send a custom event to request the data from the UI bridge
          setTimeout(() => {
            // Trigger the UI bridge to re-evaluate and send data
            const event = new CustomEvent('vibegrid-request-grouping-data', {
              detail: { source: 'group_config_set' }
            });
            window.dispatchEvent(event);
          }, 10); // Small delay to ensure group config is fully set
        } else {
          log.warn('🎯 GroupHandlers: Bridge function not available, falling back to PROCESS_GROUPS');
          self.send({ type: 'PROCESS_GROUPS' });
        }
      }
    ]
  },
  
  'group.field.add': {
    actions: [
      groupActions.addGroupField,
      // Trigger group processing
      raise({ type: 'PROCESS_GROUPS' })
    ]
  },
  
  'group.field.remove': {
    actions: [
      groupActions.removeGroupField,
      ({ context }) => {
        // If no group fields left, clear grouping entirely
        const groupConfig = (context as any).groupConfig;
        if (!groupConfig || groupConfig.fields.length === 0) {
          log.info('GroupHandlers: All group fields removed, clearing grouping');
        }
      },
      // Trigger group processing or clear rendering
      ({ context, self }) => {
        const groupConfig = (context as any).groupConfig;
        if (groupConfig && groupConfig.fields.length > 0) {
          self.send({ type: 'PROCESS_GROUPS' });
        } else {
          // Switch back to flat rendering
          self.send({ type: 'CLEAR_GROUPING_RENDER' });
        }
      }
    ]
  },
  
  'group.field.reorder': {
    actions: [
      groupActions.reorderGroupFields,
      // Reorder affects grouping structure, so reprocess
      raise({ type: 'PROCESS_GROUPS' })
    ]
  },
  
  // Group interaction events
  'group.toggle': {
    actions: [
      groupActions.toggleGroup,
      // Regenerate virtual rows with new expand/collapse state
      raise({ type: 'REGENERATE_VIRTUAL_ROWS' })
    ]
  },
  
  'group.expand.all': {
    actions: [
      groupActions.expandAllGroups,
      raise({ type: 'REGENERATE_VIRTUAL_ROWS' })
    ]
  },
  
  'group.collapse.all': {
    actions: [
      groupActions.collapseAllGroups,
      raise({ type: 'REGENERATE_VIRTUAL_ROWS' })
    ]
  },
  
  // Aggregation events
  'group.aggregation.add': {
    actions: [
      groupActions.addAggregation,
      // Aggregations require recalculation of group data
      raise({ type: 'PROCESS_GROUPS' })
    ]
  },
  
  'group.aggregation.remove': {
    actions: [
      groupActions.removeAggregation,
      raise({ type: 'PROCESS_GROUPS' })
    ]
  },
  
  'group.aggregation.update': {
    actions: [
      groupActions.updateAggregation,
      raise({ type: 'PROCESS_GROUPS' })
    ]
  },
  
  // Sorting events
  'group.sort.set': {
    actions: [
      groupActions.setGroupSort,
      // Group sorting affects order, so reprocess
      raise({ type: 'PROCESS_GROUPS' })
    ]
  },
  
  // Data movement events
  'group.move.item': {
    actions: [
      // Handle the move operation
      groupActions.moveItemBetweenGroups,
      // This will trigger entity update which will flow back through normal data updates
      ({ context, event }) => {
        log.info('GroupHandlers: Item moved between groups', {
          itemId: event.itemId,
          fromGroup: event.fromGroupId,
          toGroup: event.toGroupId,
          newValue: event.newValue
        });
      }
    ]
  },
  
  // Internal processing events
  'PROCESS_GROUPS': {
    actions: [
      ({ context, self }) => {
        log.info('🎯 GroupHandlers: PROCESS_GROUPS event received', {
          hasGroupConfig: !!(context as any).groupConfig,
          fieldCount: (context as any).groupConfig?.fields?.length || 0,
          rowCount: (context as any).rows?.length || 0,
          groupConfig: (context as any).groupConfig
        });
        
        const groupConfig = (context as any).groupConfig;
        const rows = (context as any).rows;
        const columns = (context as any).columns;
        
        if (!groupConfig || !rows || !columns) {
          log.warn('🚫 GroupHandlers: Missing required data for group processing', {
            hasGroupConfig: !!groupConfig,
            hasRows: !!rows,
            hasColumns: !!columns,
            rowCount: rows?.length || 0,
            columnCount: columns?.length || 0
          });
          return;
        }
        
        log.info('🔄 GroupHandlers: Starting GroupProcessor import and processing');
        
        // Import and use GroupProcessor
        import('../../../processors/GroupProcessor').then(({ GroupProcessor }) => {
          try {
            log.info('✅ GroupHandlers: GroupProcessor imported, processing data', {
              rowCount: rows.length,
              columnCount: columns.length,
              groupFields: groupConfig.fields.map(f => f.field)
            });
            
            const result = GroupProcessor.processData(rows, columns, groupConfig);
            
            log.info('🎉 GroupHandlers: Group processing completed successfully', {
              groupCount: result.groupCount,
              virtualRowCount: result.virtualRows.length,
              totalHeight: result.totalHeight,
              firstVirtualRow: result.virtualRows[0],
              groupTree: result.groups
            });
            
            // Send results back to machine
            self.send({
              type: 'GROUP_PROCESSING_COMPLETE',
              groupTree: result.groups,
              virtualRows: result.virtualRows,
              totalHeight: result.totalHeight
            });
          } catch (error) {
            log.error('❌ GroupHandlers: Group processing failed', error);
            self.send({ 
              type: 'GROUP_PROCESSING_ERROR', 
              error 
            });
          }
        });
      }
    ]
  },
  
  'REGENERATE_VIRTUAL_ROWS': {
    actions: [
      ({ context, self }) => {
        log.info('GroupHandlers: Regenerating virtual rows');
        
        const groupConfig = (context as any).groupConfig;
        const groupTree = (context as any).groupTree;
        
        if (!groupConfig || !groupTree || groupTree.length === 0) {
          log.warn('GroupHandlers: Cannot regenerate virtual rows - missing group data', {
            hasGroupConfig: !!groupConfig,
            hasGroupTree: !!groupTree,
            groupTreeLength: groupTree?.length || 0
          });
          return;
        }
        
        log.info('GroupHandlers: Starting virtual row regeneration', {
          expandedGroups: Array.from(groupConfig.expandedGroups),
          groupTreeCount: groupTree.length,
          firstGroup: groupTree[0]
        });
        
        // Import and use GroupProcessor for virtual row generation
        import('../../../processors/GroupProcessor').then(({ GroupProcessor }) => {
          try {
            // For regeneration, we can use just the group tree flattening
            // since the group structure itself hasn't changed
            const virtualRows = GroupProcessor.flattenGroupTree(groupTree, groupConfig.expandedGroups);
            const totalHeight = virtualRows.reduce((sum, row) => sum + row.height, 0);
            
            log.info('GroupHandlers: Virtual rows regenerated successfully', {
              inputExpandedGroups: Array.from(groupConfig.expandedGroups),
              virtualRowCount: virtualRows.length,
              totalHeight,
              sampleVirtualRows: virtualRows.slice(0, 5).map(vr => ({
                type: vr.type,
                id: vr.id,
                level: vr.level
              }))
            });
            
            self.send({
              type: 'VIRTUAL_ROWS_REGENERATED',
              virtualRows,
              totalHeight
            });
          } catch (error) {
            log.error('GroupHandlers: Virtual row regeneration failed', error);
          }
        });
      }
    ]
  },
  
  'GROUP_PROCESSING_COMPLETE': {
    actions: [
      // Update group state
      groupActions.completeGroupProcessing,
      
      // Update UI store with group configuration
      ({ context }) => {
        const groupConfig = (context as any).groupConfig;
        const storeActor = (context as any).actors?.storeActor;
        
        log.info('🔄 GroupHandlers: UI store bridge debug', {
          hasGroupConfig: !!groupConfig,
          hasStoreActor: !!storeActor,
          actorsKeys: (context as any).actors ? Object.keys((context as any).actors) : [],
          fieldCount: groupConfig?.fields?.length || 0
        });
        
        if (groupConfig && storeActor) {
          log.info('🔄 GroupHandlers: Updating UI store with group configuration', {
            hasGroupConfig: !!groupConfig,
            fieldCount: groupConfig.fields?.length || 0
          });
          storeActor.send({
            type: 'setGroupConfig',
            groupConfig: groupConfig
          });
        } else {
          log.warn('🔄 GroupHandlers: Cannot update UI store - missing requirements', {
            hasGroupConfig: !!groupConfig,
            hasStoreActor: !!storeActor
          });
        }
      },
      
      // Update coordinate mapping for variable heights
      ({ event, self }) => {
        log.info('🔄 GroupHandlers: Updating coordinate mapping with virtual rows', {
          hasVirtualRows: !!event.virtualRows,
          virtualRowCount: event.virtualRows?.length || 0
        });
        // Pass virtualRows properly to the dimension action
        if (event.virtualRows) {
          self.send({
            type: 'UPDATE_COORDINATE_MAPPING_FROM_VIRTUAL_ROWS',
            virtualRows: event.virtualRows
          });
        }
      },
      
      // Trigger renderer update with grouped data
      ({ context, event }) => {
        log.info('📊 GroupHandlers: GROUP_PROCESSING_COMPLETE - Sending grouped data to renderer', {
          virtualRowCount: event.virtualRows.length,
          totalHeight: event.totalHeight,
          groupTreeCount: event.groupTree?.length || 0,
          isGrouped: (context as any).isGrouped,
          firstVirtualRow: event.virtualRows[0]
        });
        
        if ((context as any).actors.rendererActor) {
          // Get visible columns (same logic as non-grouped rendering)
          const storeSnapshot = (context as any).storeActor?.getSnapshot();
          const columns = storeSnapshot?.context?.columns || (context as any).columns;
          const columnVisibility = storeSnapshot?.context?.columnVisibility || {};
          
          const visibleColumns = columns.filter(col => 
            col.id !== '__selection' && columnVisibility[col.id] !== false
          );
          
          const columnsWithSelection = (context as any).enableSelectionColumn
            ? [{ id: '__selection', field: '__selection', name: 'Select', width: 48 }, ...visibleColumns]
            : visibleColumns;
          
          (context as any).actors.rendererActor.send({
            type: 'RENDER',
            state: {
              rows: (context as any).rows, // Keep original rows for fallback
              virtualRows: event.virtualRows, // Add virtual rows for grouped rendering
              columns: columnsWithSelection,
              groupConfig: (context as any).groupConfig,
              selectedCells: (context as any).selectedCells,
              editingCell: (context as any).editingCell,
              groupedData: event.groupTree,
              optimisticOperations: new Map(),
              version: (context as any).version,
              coordinateMapping: (context as any).coordinateMapping
            }
          });
        }
      }
    ]
  },
  
  'VIRTUAL_ROWS_REGENERATED': {
    actions: [
      // Update virtual rows in group state
      assign({
        virtualRows: ({ context, event }) => {
          const typedEvent = event as { virtualRows?: any[] };
          return typedEvent.virtualRows || [];
        }
      }),
      
      // Update coordinate mapping
      ({ event, self }) => {
        // Pass virtualRows properly to the dimension action
        if (event.virtualRows) {
          self.send({
            type: 'UPDATE_COORDINATE_MAPPING_FROM_VIRTUAL_ROWS',
            virtualRows: event.virtualRows
          });
        }
      },
      
      // Re-render with updated virtual rows
      ({ context, event }) => {
        log.info('GroupHandlers: Re-rendering with regenerated virtual rows');
        
        if ((context as any).actors.rendererActor) {
          const storeSnapshot = (context as any).storeActor?.getSnapshot();
          const columns = storeSnapshot?.context?.columns || (context as any).columns;
          const columnVisibility = storeSnapshot?.context?.columnVisibility || {};
          
          const visibleColumns = columns.filter(col => 
            col.id !== '__selection' && columnVisibility[col.id] !== false
          );
          
          const columnsWithSelection = (context as any).enableSelectionColumn
            ? [{ id: '__selection', field: '__selection', name: 'Select', width: 48 }, ...visibleColumns]
            : visibleColumns;
          
          (context as any).actors.rendererActor.send({
            type: 'RENDER',
            state: {
              rows: (context as any).rows,
              virtualRows: event.virtualRows,
              columns: columnsWithSelection,
              groupConfig: (context as any).groupConfig,
              selectedCells: (context as any).selectedCells,
              editingCell: (context as any).editingCell,
              groupedData: (context as any).groupTree,
              optimisticOperations: new Map(),
              version: (context as any).version,
              coordinateMapping: (context as any).coordinateMapping
            }
          });
        }
      }
    ]
  },
  
  'CLEAR_GROUPING_RENDER': {
    actions: [
      // Clear group state
      groupActions.clearGrouping,
      
      // Reset coordinate mapping to uniform heights
      ({ context, self }) => {
        const rows = (context as any).rows;
        if (rows && rows.length > 0) {
          self.send({
            type: 'RECALCULATE_COORDINATES'
          });
        }
      },
      
      // Render with flat data
      ({ context }) => {
        log.info('GroupHandlers: Switching back to flat rendering');
        
        if ((context as any).actors.rendererActor) {
          const storeSnapshot = (context as any).storeActor?.getSnapshot();
          const columns = storeSnapshot?.context?.columns || (context as any).columns;
          const columnVisibility = storeSnapshot?.context?.columnVisibility || {};
          
          const visibleColumns = columns.filter(col => 
            col.id !== '__selection' && columnVisibility[col.id] !== false
          );
          
          const columnsWithSelection = (context as any).enableSelectionColumn
            ? [{ id: '__selection', field: '__selection', name: 'Select', width: 48 }, ...visibleColumns]
            : visibleColumns;
          
          (context as any).actors.rendererActor.send({
            type: 'RENDER',
            state: {
              rows: (context as any).rows,
              virtualRows: undefined, // Clear virtual rows
              columns: columnsWithSelection,
              groupConfig: null, // Clear group config
              selectedCells: (context as any).selectedCells,
              editingCell: (context as any).editingCell,
              groupedData: [],
              optimisticOperations: new Map(),
              version: (context as any).version,
              coordinateMapping: (context as any).coordinateMapping
            }
          });
        }
      }
    ]
  },
  
  'GROUP_PROCESSING_ERROR': {
    actions: [
      ({ event }) => {
        log.error('GroupHandlers: Group processing error', event.error);
      },
      // Reset processing state
      assign({
        isProcessingGroups: () => false
      })
    ]
  }
};
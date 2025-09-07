// ====================================
// GROUP SLICE
// ====================================
// Manages group-by state and operations

import { assign } from 'xstate';
import type { 
  GroupConfig, 
  GroupField, 
  AggregationConfig,
  VirtualRow,
  GroupNode,
  TableRow
} from '../../../types';
import { createLogger, type LogLevel } from '@/logger/simple-logger';

// File-level log control
const LOG_LEVEL: LogLevel = 'debug';  // DEBUG: Monitoring group slice operations
const log = createLogger('GroupSlice', LOG_LEVEL);

// ====================================
// TYPES
// ====================================

export interface GroupState {
  // Current group configuration
  groupConfig: GroupConfig | null;
  
  // Generated group tree from current configuration
  groupTree: GroupNode[];
  
  // Virtual rows for rendering (flattened group tree + data)
  virtualRows: VirtualRow[];
  
  // Whether grouping is currently active
  isGrouped: boolean;
  
  // Processing state
  isProcessingGroups: boolean;
  
  // Group state version for change detection
  groupVersion: number;
}

// ====================================
// INITIAL STATE
// ====================================

export const createInitialGroupState = (): GroupState => {
  return {
    groupConfig: null,
    groupTree: [],
    virtualRows: [],
    isGrouped: false,
    isProcessingGroups: false,
    groupVersion: 0
  };
};

// ====================================
// ACTIONS
// ====================================

export const groupActions = {
  /**
   * Set group configuration and trigger processing
   */
  setGroupConfig: assign({
    groupConfig: ({ context, event }) => {
      // Cast event to expected type
      const typedEvent = event as { type: string; config?: any };
      
      log.info('GroupSlice: setGroupConfig called', {
        event: typedEvent,
        eventKeys: typedEvent ? Object.keys(typedEvent) : [],
        hasConfig: typedEvent && 'config' in typedEvent,
        configValue: typedEvent ? typedEvent.config : undefined
      });
      
      // Handle the case where event might not have the expected structure
      if (!typedEvent) {
        log.error('GroupSlice: setGroupConfig called with null/undefined event');
        return null;
      }
      if (!typedEvent.config) {
        log.error('GroupSlice: setGroupConfig called without config property', { event: typedEvent });
        return null;
      }
      return typedEvent.config;
    },
    isProcessingGroups: () => true,
    groupVersion: ({ context }) => (context as any).groupVersion + 1
  }),
  
  /**
   * Add a group field
   */
  addGroupField: assign({
    groupConfig: ({ context }, event: { field: GroupField }) => {
      const current = (context as any).groupConfig as GroupConfig;
      if (!current) {
        // Create new group config with this field
        return {
          fields: [event.field],
          sortBy: 'name' as const,
          sortDirection: 'asc' as const,
          aggregations: [],
          expandedGroups: new Set<string>(),
          colorScheme: 'auto' as const
        };
      }
      
      // Add field if not already present
      if (!current.fields.some(f => f.field === event.field.field)) {
        return {
          ...current,
          fields: [...current.fields, event.field]
        };
      }
      
      return current;
    },
    isProcessingGroups: () => true,
    groupVersion: ({ context }) => (context as any).groupVersion + 1
  }),
  
  /**
   * Remove a group field
   */
  removeGroupField: assign({
    groupConfig: ({ context }, event: { field: string }) => {
      const current = (context as any).groupConfig as GroupConfig;
      if (!current) return null;
      
      const newFields = current.fields.filter(f => f.field !== event.field);
      
      // If no fields left, disable grouping
      if (newFields.length === 0) {
        return null;
      }
      
      return {
        ...current,
        fields: newFields
      };
    },
    isGrouped: ({ context }, event: { field: string }) => {
      const current = (context as any).groupConfig as GroupConfig;
      if (!current) return false;
      
      const newFields = current.fields.filter(f => f.field !== event.field);
      return newFields.length > 0;
    },
    isProcessingGroups: () => true,
    groupVersion: ({ context }) => (context as any).groupVersion + 1
  }),
  
  /**
   * Reorder group fields
   */
  reorderGroupFields: assign({
    groupConfig: ({ context }, event: { fromIndex: number; toIndex: number }) => {
      const current = (context as any).groupConfig as GroupConfig;
      if (!current) return null;
      
      const newFields = [...current.fields];
      const [movedField] = newFields.splice(event.fromIndex, 1);
      newFields.splice(event.toIndex, 0, movedField);
      
      return {
        ...current,
        fields: newFields
      };
    },
    isProcessingGroups: () => true,
    groupVersion: ({ context }) => (context as any).groupVersion + 1
  }),
  
  /**
   * Toggle a group's expanded/collapsed state
   */
  toggleGroup: assign({
    groupConfig: ({ context, event }) => {
      // Cast event to expected type and add safety checks
      const typedEvent = event as { type: string; groupId?: string };
      const groupId = typedEvent?.groupId;
      
      log.info('GroupSlice: toggleGroup called', {
        event: typedEvent,
        groupId,
        hasGroupId: !!groupId,
        eventKeys: typedEvent ? Object.keys(typedEvent) : []
      });
      
      if (!groupId) {
        log.error('GroupSlice: toggleGroup called without groupId', { event: typedEvent });
        return (context as any).groupConfig;
      }
      
      const current = (context as any).groupConfig as GroupConfig;
      if (!current) {
        log.error('GroupSlice: toggleGroup called without group config');
        return null;
      }
      
      const hadGroup = current.expandedGroups.has(groupId);
      const newExpandedGroups = new Set(current.expandedGroups);
      if (hadGroup) {
        newExpandedGroups.delete(groupId);
        log.info('GroupSlice: toggleGroup - collapsing group', { 
          groupId, 
          wasExpanded: true,
          remainingExpanded: Array.from(newExpandedGroups)
        });
      } else {
        newExpandedGroups.add(groupId);
        log.info('GroupSlice: toggleGroup - expanding group', { 
          groupId, 
          wasExpanded: false,
          nowExpanded: Array.from(newExpandedGroups)
        });
      }
      
      const newConfig = {
        ...current,
        expandedGroups: newExpandedGroups
      };
      
      log.info('GroupSlice: toggleGroup result', {
        groupId,
        beforeToggle: Array.from(current.expandedGroups),
        afterToggle: Array.from(newConfig.expandedGroups)
      });
      
      return newConfig;
    },
    isProcessingGroups: () => true,
    groupVersion: ({ context }) => (context as any).groupVersion + 1
  }),
  
  /**
   * Expand all groups
   */
  expandAllGroups: assign({
    groupConfig: ({ context }) => {
      const current = (context as any).groupConfig as GroupConfig;
      if (!current) return null;
      
      // Get all group IDs from the current group tree
      const allGroupIds = new Set<string>();
      const collectGroupIds = (groups: GroupNode[]) => {
        groups.forEach(group => {
          allGroupIds.add(group.id);
          if (Array.isArray(group.children)) {
            const childGroups = group.children.filter(child => 'field' in child) as GroupNode[];
            collectGroupIds(childGroups);
          }
        });
      };
      
      const groupTree = (context as any).groupTree as GroupNode[];
      collectGroupIds(groupTree);
      
      return {
        ...current,
        expandedGroups: allGroupIds
      };
    },
    isProcessingGroups: () => true,
    groupVersion: ({ context }) => (context as any).groupVersion + 1
  }),
  
  /**
   * Collapse all groups
   */
  collapseAllGroups: assign({
    groupConfig: ({ context }) => {
      const current = (context as any).groupConfig as GroupConfig;
      if (!current) return null;
      
      return {
        ...current,
        expandedGroups: new Set<string>()
      };
    },
    isProcessingGroups: () => true,
    groupVersion: ({ context }) => (context as any).groupVersion + 1
  }),
  
  /**
   * Add an aggregation
   */
  addAggregation: assign({
    groupConfig: ({ context }, event: { config: AggregationConfig }) => {
      const current = (context as any).groupConfig as GroupConfig;
      if (!current) return null;
      
      // Remove existing aggregation for the same field
      const newAggregations = current.aggregations.filter(a => a.field !== event.config.field);
      newAggregations.push(event.config);
      
      return {
        ...current,
        aggregations: newAggregations
      };
    },
    isProcessingGroups: () => true,
    groupVersion: ({ context }) => (context as any).groupVersion + 1
  }),
  
  /**
   * Remove an aggregation
   */
  removeAggregation: assign({
    groupConfig: ({ context }, event: { field: string }) => {
      const current = (context as any).groupConfig as GroupConfig;
      if (!current) return null;
      
      return {
        ...current,
        aggregations: current.aggregations.filter(a => a.field !== event.field)
      };
    },
    isProcessingGroups: () => true,
    groupVersion: ({ context }) => (context as any).groupVersion + 1
  }),
  
  /**
   * Update aggregation configuration
   */
  updateAggregation: assign({
    groupConfig: ({ context }, event: { field: string; config: AggregationConfig }) => {
      const current = (context as any).groupConfig as GroupConfig;
      if (!current) return null;
      
      const newAggregations = current.aggregations.map(a => 
        a.field === event.field ? event.config : a
      );
      
      return {
        ...current,
        aggregations: newAggregations
      };
    },
    isProcessingGroups: () => true,
    groupVersion: ({ context }) => (context as any).groupVersion + 1
  }),
  
  /**
   * Set group sorting configuration
   */
  setGroupSort: assign({
    groupConfig: ({ context }, event: { sortBy: 'name' | 'count' | 'custom'; direction: 'asc' | 'desc' }) => {
      const current = (context as any).groupConfig as GroupConfig;
      if (!current) return null;
      
      return {
        ...current,
        sortBy: event.sortBy,
        sortDirection: event.direction
      };
    },
    isProcessingGroups: () => true,
    groupVersion: ({ context }) => (context as any).groupVersion + 1
  }),
  
  /**
   * Complete group processing - update group tree and virtual rows
   */
  completeGroupProcessing: assign({
    groupTree: ({ context, event }) => {
      const typedEvent = event as { type: string; groupTree?: any; virtualRows?: any; totalHeight?: number };
      return typedEvent.groupTree || [];
    },
    virtualRows: ({ context, event }) => {
      const typedEvent = event as { type: string; groupTree?: any; virtualRows?: any; totalHeight?: number };
      return typedEvent.virtualRows || [];
    },
    isGrouped: ({ context }) => {
      const groupConfig = (context as any).groupConfig as GroupConfig;
      return !!(groupConfig && groupConfig.fields.length > 0);
    },
    isProcessingGroups: () => false
  }),
  
  /**
   * Clear all grouping
   */
  clearGrouping: assign({
    groupConfig: () => null,
    groupTree: () => [],
    virtualRows: () => [],
    isGrouped: () => false,
    isProcessingGroups: () => false,
    groupVersion: ({ context }) => (context as any).groupVersion + 1
  }),
  
  /**
   * Handle moving an item between groups (updates the underlying data)
   */
  moveItemBetweenGroups: ({ context }, event: { itemId: string; fromGroupId: string; toGroupId: string; newValue: any }) => {
    log.info('GroupSlice: moveItemBetweenGroups', {
      itemId: event.itemId,
      fromGroupId: event.fromGroupId,
      toGroupId: event.toGroupId,
      newValue: event.newValue
    });
    
    // This action would typically trigger an entity update
    // The actual implementation depends on the parent's onEntityUpdate callback
    const tableContext = context as any;
    if (tableContext.onEntityUpdate) {
      // Extract field from group ID and update the entity
      const groupConfig = tableContext.groupConfig as GroupConfig;
      if (groupConfig && groupConfig.fields.length > 0) {
        // For now, assume single-level grouping - could be enhanced for multi-level
        const fieldToUpdate = groupConfig.fields[0].field;
        const updates = { [fieldToUpdate]: event.newValue };
        
        tableContext.onEntityUpdate(event.itemId, updates);
      }
    }
  }
};

// ====================================
// SELECTORS
// ====================================

export const groupSelectors = {
  // Configuration queries
  getGroupConfig: (context: GroupState): GroupConfig | null => {
    return context.groupConfig;
  },
  
  getGroupFields: (context: GroupState): GroupField[] => {
    return context.groupConfig?.fields || [];
  },
  
  getAggregations: (context: GroupState): AggregationConfig[] => {
    return context.groupConfig?.aggregations || [];
  },
  
  isGroupExpanded: (context: GroupState, groupId: string): boolean => {
    return context.groupConfig?.expandedGroups.has(groupId) || false;
  },
  
  // Data queries
  getGroupTree: (context: GroupState): GroupNode[] => {
    return context.groupTree;
  },
  
  getVirtualRows: (context: GroupState): VirtualRow[] => {
    return context.virtualRows;
  },
  
  // State queries
  isGrouped: (context: GroupState): boolean => {
    return context.isGrouped;
  },
  
  isProcessingGroups: (context: GroupState): boolean => {
    return context.isProcessingGroups;
  },
  
  getGroupVersion: (context: GroupState): number => {
    return context.groupVersion;
  },
  
  // Derived queries
  getGroupFieldCount: (context: GroupState): number => {
    return context.groupConfig?.fields.length || 0;
  },
  
  getAggregationCount: (context: GroupState): number => {
    return context.groupConfig?.aggregations.length || 0;
  },
  
  getTotalGroupCount: (context: GroupState): number => {
    const countGroups = (groups: GroupNode[]): number => {
      let count = groups.length;
      groups.forEach(group => {
        if (Array.isArray(group.children)) {
          const childGroups = group.children.filter(child => 'field' in child) as GroupNode[];
          count += countGroups(childGroups);
        }
      });
      return count;
    };
    
    return countGroups(context.groupTree);
  },
  
  getExpandedGroupCount: (context: GroupState): number => {
    return context.groupConfig?.expandedGroups.size || 0;
  }
};
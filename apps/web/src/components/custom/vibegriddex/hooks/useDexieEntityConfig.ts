import { useMemo, useState, useEffect } from 'react';
import { db } from '@repo/dataforge/dexie-schema';
import type { Column } from '../types';
// Import Dexie domain UI operations that include sync tracking
import { updateTaskUI, updateProjectUI, updateUserUI, updateCommentUI } from '@/domain-dexie';
import { getUniqueRelationshipTables } from '../utils/relationship-discovery';

// Entity types we support
export type VibeGridXEntityType = 'task' | 'project' | 'user' | 'comment';

// Helper to get update function for entity type
function getUpdateFunction(entityType: VibeGridXEntityType | null) {
  return async (id: string, updates: Record<string, any>) => {
    console.log('[useDexieEntityConfig] onEntityUpdate called', { id, updates, entityType });
    
    switch (entityType) {
      case 'task':
        await updateTaskUI(id, updates);
        break;
      case 'project':
        await updateProjectUI(id, updates);
        break;
      case 'user':
        await updateUserUI(id, updates);
        break;
      case 'comment':
        await updateCommentUI(id, updates);
        break;
      default:
        console.warn(`[useDexieEntityConfig] No update handler for entity type: ${entityType}`);
    }
  };
}

interface DexieEntityConfig {
  data: any[];
  columns: Column[];
  relationshipData: Record<string, any>;
  relationshipResolvers: Record<string, (id: string | string[]) => string>;
  onEntityUpdate: (id: string, updates: Record<string, any>) => Promise<void>;
}

interface PreloadedData {
  entities: any[];
  relationshipData: Record<string, any>;
}

export function useDexieEntityConfig(
  entityType: VibeGridXEntityType | null,
  columns: Column[],
  preloadedData?: PreloadedData | null
): DexieEntityConfig | null {
  // If we have preloaded data, use it immediately
  if (preloadedData && columns.length > 0) {
    console.log('🚀 useDexieEntityConfig: Using preloaded data', {
      entityCount: preloadedData.entities?.length || 0,
      relationshipDataKeys: Object.keys(preloadedData.relationshipData || {}),
      entityType
    });
    
    return useMemo(() => {
      const { entities, relationshipData } = preloadedData;
      
      // Create resolvers from preloaded data
      const relationshipResolvers: Record<string, (id: string | string[]) => string> = {};
      
      columns.forEach(column => {
        const cellType = column.cellType;
        if (cellType?.startsWith('relationship') && column.relationshipTable) {
          const displayField = column.relationshipDisplayField || 'name';
          const tableData = relationshipData[column.relationshipTable] || {};
          
          relationshipResolvers[column.id] = (id: string | string[]) => {
            if (Array.isArray(id)) {
              return id.map(i => {
                const entity = tableData[i];
                return entity?.[displayField] || entity?.name || i;
              }).join(', ');
            }
            const entity = tableData[id];
            return entity?.[displayField] || entity?.name || id;
          };
        }
      });
      
      // Get update function
      const onEntityUpdate = getUpdateFunction(entityType);
      
      return {
        data: entities,
        columns,
        relationshipData,
        relationshipResolvers,
        onEntityUpdate
      };
    }, [preloadedData, columns, entityType]);
  }
  
  // State for all data - loaded once on mount
  const [data, setData] = useState<any[]>([]);
  const [relationshipDataState, setRelationshipDataState] = useState<Record<string, any[]>>({});
  
  // Load all data once on mount - no live queries!
  useEffect(() => {
    // Skip loading if we have preloaded data
    if (preloadedData) {
      return;
    }
    
    const loadAllData = async () => {
      try {
        // Load entity data
        let entityData: any[] = [];
        if (entityType) {
          switch (entityType) {
            case 'task':
              entityData = await db.tasks.toArray();
              break;
            case 'project':
              entityData = await db.projects.toArray();
              break;
            case 'user':
              entityData = await db.users.toArray();
              break;
            case 'comment':
              entityData = await db.comments.toArray();
              break;
          }
        }
        
        // Dynamically load relationship data based on columns
        const relationshipState: Record<string, any[]> = {};
        
        if (columns && columns.length > 0) {
          const uniqueTables = getUniqueRelationshipTables(columns);
          
          console.log('🔍 useDexieEntityConfig: Loading relationship tables', uniqueTables);
          
          // Load all relationship tables in parallel
          const loadPromises = uniqueTables.map(async (tableName) => {
            const table = (db as any)[tableName];
            if (!table) {
              console.warn('⚠️ No table found for:', tableName);
              return { tableName, data: [] };
            }
            const data = await table.toArray();
            return { tableName, data };
          });
          
          const results = await Promise.all(loadPromises);
          
          // Build relationship state
          results.forEach(({ tableName, data }) => {
            relationshipState[tableName] = data;
          });
        }
        
        console.log('🔍 useDexieEntityConfig: All initial data loaded', {
          entityType,
          entityCount: entityData.length,
          relationshipTables: Object.keys(relationshipState).length
        });
        
        setData(entityData);
        setRelationshipDataState(relationshipState);
      } catch (error) {
        console.error('🔍 useDexieEntityConfig: Error loading data', error);
      }
    };
    
    loadAllData();
  }, [entityType, preloadedData]);
  
  // Build relationship data map from loaded state
  const relationshipData = useMemo(() => {
    const data: Record<string, any> = {};
    
    console.log('🔍 useDexieEntityConfig: Building relationship data', {
      tables: Object.keys(relationshipDataState),
      totalItems: Object.values(relationshipDataState).reduce((sum, arr) => sum + arr.length, 0)
    });
    
    // Convert arrays to id-keyed objects for fast lookup
    Object.entries(relationshipDataState).forEach(([tableName, items]) => {
      if (items.length > 0) {
        const itemMap = items.reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {} as Record<string, any>);
        
        // Store under the table name
        data[tableName] = itemMap;
        
        // Also store under common variations for backward compatibility
        // e.g., "users" -> "user", "assignee", etc.
        if (tableName === 'users') {
          data.user = itemMap;
          data.assignee = itemMap;
          data.owner = itemMap;
          data.author = itemMap;
        } else if (tableName === 'projects') {
          data.project = itemMap;
        } else if (tableName === 'status_definitions') {
          data.status = itemMap;
          data.statusDefinition = itemMap;
          data.statusDefinitions = itemMap;
        }
      }
    });
    
    return data;
  }, [relationshipDataState]);
  
  // Build configuration
  const result = useMemo(() => {
    if (!entityType || columns.length === 0) {
      if (entityType) {
        console.error(`VibeGridDex: No columns provided for entity type "${entityType}"`);
      }
      return null;
    }
    
    // Check if data is loaded
    const hasRelationshipColumns = columns.some(col => {
      const cellType = col.cellType;
      return cellType?.startsWith('relationship');
    });
    
    // Always return columns immediately - don't wait for relationship data
    // The loader pattern handles initial resolution
    
    // Build relationship resolvers
    const relationshipResolvers: Record<string, (id: string | string[]) => string> = {};
    
    columns.forEach(column => {
        const cellType = column.cellType;
        if (cellType?.startsWith('relationship') && column.relationshipTable) {
          const tableKey = column.relationshipTable;
          const displayField = column.relationshipDisplayField;
          
          console.log('🔍 useDexieEntityConfig: Creating resolver for column', {
            columnId: column.id,
            field: column.field,
            cellType,
            relationshipTable: tableKey,
            displayField,
            availableDataKeys: Object.keys(relationshipData)
          });
          
          // Create resolver that reads from relationshipData
          relationshipResolvers[column.id] = (id: string | string[]) => {
            // Find the right data source
            const dataSource = relationshipData[tableKey] || 
                              relationshipData[`${tableKey}s`] || 
                              relationshipData[tableKey.replace(/s$/, '')] ||
                              relationshipData[`${tableKey.replace(/s$/, '')}s`] ||
                              {};
            
            console.log('🔍 useDexieEntityConfig: Resolver called', {
              columnId: column.id,
              id,
              tableKey,
              dataSourceFound: Object.keys(dataSource).length > 0,
              dataSourceSample: Object.values(dataSource)[0]
            });
            
            if (Array.isArray(id)) {
              const names = id.map(i => {
                const entity = dataSource[i];
                if (!entity) return i;
                
                return entity[displayField || 'displayName'] || 
                       entity.displayName || 
                       entity.name || 
                       entity.title || 
                       entity.label ||
                       i;
              });
              return names.join(', ');
            }
            
            const entity = dataSource[id];
            if (!entity) {
              // Check if we have any data at all
              const hasAnyData = Object.keys(dataSource).length > 0;
              if (!hasAnyData) {
                console.warn('🔍 useDexieEntityConfig: No relationship data loaded yet', {
                  columnId: column.id,
                  tableKey,
                  id
                });
                // Return a placeholder that indicates loading
                return `Loading...`;
              }
              
              console.warn('🔍 useDexieEntityConfig: Entity not found', {
                columnId: column.id,
                id,
                tableKey,
                availableIds: Object.keys(dataSource).slice(0, 5)
              });
              return id;
            }
            
            const resolved = entity[displayField || 'displayName'] || 
                   entity.displayName || 
                   entity.name || 
                   entity.title || 
                   entity.label ||
                   id;
                   
            console.log('🔍 useDexieEntityConfig: Resolved', {
              columnId: column.id,
              id,
              resolved
            });
            
            return resolved;
          };
        }
      });
    
    // Get update function that includes sync tracking
    const onEntityUpdate = getUpdateFunction(entityType);
    
    return {
      data,
      columns,
      relationshipData,
      relationshipResolvers,
      onEntityUpdate
    };
  }, [columns, data, relationshipData, entityType]);
  
  return result;
}
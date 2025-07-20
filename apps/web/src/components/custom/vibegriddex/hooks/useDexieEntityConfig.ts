import { useMemo, useState, useEffect } from 'react';
import { db } from '@repo/dataforge/dexie-schema';
import type { Column } from '../types';
// Import Dexie domain UI operations that include sync tracking
import { updateTaskUI, updateProjectUI, updateUserUI, updateCommentUI } from '@/domain-dexie';

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
  const [relationshipDataState, setRelationshipDataState] = useState<{
    statusDefinitions: any[],
    statusSets: any[],
    tags: any[],
    tagSets: any[],
    users: any[],
    projects: any[]
  }>({ statusDefinitions: [], statusSets: [], tags: [], tagSets: [], users: [], projects: [] });
  
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
        
        // Load all relationship data in parallel
        const [statusDefs, statusSets, tags, tagSets, users, projects] = await Promise.all([
          db.status_definitions.toArray(),
          db.status_sets.toArray(),
          db.tags.toArray(),
          db.tag_sets.toArray(),
          db.users.toArray(),
          db.projects.toArray()
        ]);
        
        console.log('🔍 useDexieEntityConfig: All initial data loaded', {
          entityType,
          entityCount: entityData.length,
          usersCount: users.length,
          projectsCount: projects.length,
          statusDefsCount: statusDefs.length
        });
        
        setData(entityData);
        setRelationshipDataState({
          statusDefinitions: statusDefs,
          statusSets,
          tags,
          tagSets,
          users,
          projects
        });
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
      hasStatusDefs: relationshipDataState.statusDefinitions.length > 0,
      statusDefCount: relationshipDataState.statusDefinitions.length,
      hasUsers: relationshipDataState.users.length > 0,
      userCount: relationshipDataState.users.length,
      hasProjects: relationshipDataState.projects.length > 0,
      projectCount: relationshipDataState.projects.length
    });
    
    // Convert arrays to id-keyed objects for fast lookup
    if (relationshipDataState.statusDefinitions.length > 0) {
      data.statusDefinitions = relationshipDataState.statusDefinitions.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
    }
    
    if (relationshipDataState.statusSets.length > 0) {
      data.statusSets = relationshipDataState.statusSets.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
    }
    
    if (relationshipDataState.tags.length > 0) {
      data.tags = relationshipDataState.tags.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
    }
    
    if (relationshipDataState.tagSets.length > 0) {
      data.tagSets = relationshipDataState.tagSets.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
    }
    
    if (relationshipDataState.users.length > 0) {
      const usersMap = relationshipDataState.users.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
      
      // Map to both plural and relationship field names
      data.users = usersMap;
      data.user = usersMap;
      data.assignee = usersMap;
      data.owner = usersMap;
      data.author = usersMap;
    }
    
    if (relationshipDataState.projects.length > 0) {
      const projectsMap = relationshipDataState.projects.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
      
      // Map to both plural and singular forms
      data.projects = projectsMap;
      data.project = projectsMap;
    }
    
    if (relationshipDataState.statusDefinitions.length > 0) {
      const statusMap = relationshipDataState.statusDefinitions.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
      
      // Map to common status field names
      data.status = statusMap;
      data.statusDefinition = statusMap;
      data.status_definitions = statusMap; // Match the relationshipTable name
      data.statusDefinitions = statusMap;
    }
    
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
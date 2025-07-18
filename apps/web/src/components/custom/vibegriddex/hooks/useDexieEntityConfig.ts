import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@repo/dataforge/dexie-schema';
import * as dexieDomains from '@/domain-dexie';
import { getEntityConfig, type VibeGridXEntityType } from '@repo/dataforge/vibegridx-columns';
import type { Column } from '../types';

interface DexieEntityConfig {
  data: any[];
  columns: Column[];
  relationshipData: Record<string, any>;
  relationshipResolvers: Record<string, (id: string | string[]) => string>;
  onEntityUpdate: (id: string, field: string, value: any) => Promise<void>;
}

export function useDexieEntityConfig(
  entityType: VibeGridXEntityType | null,
  selectedColumns?: string[]
): DexieEntityConfig | null {
  // Get entity configuration
  const config = useMemo(() => entityType ? getEntityConfig(entityType) : null, [entityType]);
  
  // Use Dexie live queries for data - always call all hooks unconditionally
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const projects = useLiveQuery(() => db.projects.toArray());
  const users = useLiveQuery(() => db.users.toArray());
  const comments = useLiveQuery(() => db.comments.toArray());
  
  // Get primary data based on entity type
  const data = useMemo(() => {
    if (!entityType) return [];
    switch (entityType) {
      case 'task': return tasks || [];
      case 'project': return projects || [];
      case 'user': return users || [];
      case 'comment': return comments || [];
      default: return [];
    }
  }, [entityType, tasks, projects, users, comments]);
  
  // Load relationship data - always call all hooks
  const statusDefinitions = useLiveQuery(() => db.status_definitions.toArray());
  const statusSets = useLiveQuery(() => db.status_sets.toArray());
  const tags = useLiveQuery(() => db.tags.toArray());
  const tagSets = useLiveQuery(() => db.tag_sets.toArray());
  const allUsers = useLiveQuery(() => db.users.toArray());
  const allProjects = useLiveQuery(() => db.projects.toArray());
  
  // Build relationship data map
  const relationshipData = useMemo(() => {
    const data: Record<string, any> = {};
    
    console.log('🔍 useDexieEntityConfig: Building relationship data', {
      hasStatusDefs: !!statusDefinitions,
      statusDefCount: statusDefinitions?.length || 0,
      hasUsers: !!allUsers,
      userCount: allUsers?.length || 0,
      hasProjects: !!allProjects,
      projectCount: allProjects?.length || 0
    });
    
    // Convert arrays to id-keyed objects for fast lookup
    if (statusDefinitions) {
      data.statusDefinitions = statusDefinitions.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
    }
    
    if (statusSets) {
      data.statusSets = statusSets.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
    }
    
    if (tags) {
      data.tags = tags.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
    }
    
    if (tagSets) {
      data.tagSets = tagSets.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
    }
    
    if (allUsers) {
      const usersMap = allUsers.reduce((acc, item) => {
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
    
    if (allProjects) {
      const projectsMap = allProjects.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, any>);
      
      // Map to both plural and singular forms
      data.projects = projectsMap;
      data.project = projectsMap;
    }
    
    if (statusDefinitions) {
      const statusMap = statusDefinitions.reduce((acc, item) => {
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
  }, [statusDefinitions, statusSets, tags, tagSets, allUsers, allProjects]);
  
  // Build configuration
  const result = useMemo(() => {
    if (!entityType || !config) {
      if (entityType) {
        console.error(`VibeGridDex: No entity configuration found for type "${entityType}"`);
      }
      return null;
    }
    
    // Wait for relationship data to load if we have relationship columns
    const hasRelationshipColumns = config.columns.some(col => {
      const cellType = col.cellType || col.type;
      return cellType?.startsWith('relationship');
    });
    
    if (hasRelationshipColumns && (!allUsers || !allProjects)) {
      console.log('🔍 useDexieEntityConfig: Waiting for relationship data to load', {
        hasUsers: !!allUsers,
        hasProjects: !!allProjects
      });
      return null;
    }
    
    // Filter columns if selectedColumns is provided
    let columns = config.columns;
    if (selectedColumns) {
      columns = columns.filter(col => col && selectedColumns.includes(col.id));
      // Ensure we have at least some columns
      if (columns.length === 0) {
        console.warn(`VibeGridDex: No columns matched selectedColumns: ${selectedColumns.join(', ')}`);
        columns = config.columns; // Fall back to all columns
      }
    }
    
    // Build relationship resolvers
    const relationshipResolvers: Record<string, (id: string | string[]) => string> = {};
    
    columns.forEach(column => {
      const cellType = column.cellType || column.type;
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
    
    // Get update function from Dexie domains
    const onEntityUpdate = async (id: string, field: string, value: any) => {
      const updates = { [field]: value };
      
      switch (entityType) {
        case 'task':
          await dexieDomains.taskService.update(id, updates);
          break;
        case 'project':
          await dexieDomains.projectService.update(id, updates);
          break;
        case 'user':
          // User updates might need special handling
          console.warn('User updates not yet implemented in Dexie domains');
          break;
        case 'comment':
          // Comment updates might need special handling
          console.warn('Comment updates not yet implemented in Dexie domains');
          break;
      }
    };
    
    return {
      data,
      columns,
      relationshipData,
      relationshipResolvers,
      onEntityUpdate
    };
  }, [config, data, selectedColumns, relationshipData, entityType]);
  
  return result;
}
/**
 * Live Changes Configuration
 * 
 * Centralized live changes configuration using pure XState for all domains.
 * This replaces individual domain service live changes with a unified approach.
 * All entities use XState atoms for better performance and consistency.
 */

import * as clientEntities from '@repo/dataforge/client-entities'
import { CLIENT_DOMAIN_TABLES } from '@repo/dataforge/client-entities'
import { atomActions as taskAtomActions, taskUtils } from '@/domain/task'
import { atomActions as projectAtomActions, projectUtils } from '@/domain/project'
import { atomActions as userAtomActions, userUtils } from '@/domain/user'
import { atomActions as commentAtomActions, commentUtils } from '@/domain/comment'
import { atomActions as statusDefinitionAtomActions, statusDefinitionUtils } from '@/domain/status-definition'
import { atomActions as statusSetAtomActions, statusSetUtils } from '@/domain/status-set'
import { atomActions as tagAtomActions, tagUtils } from '@/domain/tag'
import { atomActions as tagSetAtomActions, tagSetUtils } from '@/domain/tag-set'

// Dynamic imports will be used for generated operations
import type { EntityConfig, AtomActions } from '@/types/live-changes'

// Map table names to entity names using schema exports
const TABLE_TO_ENTITY_MAP = CLIENT_DOMAIN_TABLES.reduce((map, tableName) => {
  const cleanTable = tableName.replace(/"/g, '')
  
  // Find corresponding schema in client-entities exports to get the entity name
  const schemaName = Object.keys(clientEntities).find(key => 
    key.endsWith('Schema') && 
    (clientEntities as any)[key]?.options?.tableName === cleanTable
  )
  
  if (schemaName) {
    // Extract entity name from schema name (remove 'Schema' suffix)
    const entityName = schemaName.replace('Schema', '')
    map[cleanTable] = entityName
  } else {
    console.warn(`[LiveChangesConfig] No schema found for table: ${cleanTable}`)
  }
  
  return map
}, {} as Record<string, string>)

// Helper function to create domain actions for any entity
function createDomainActions(entityName: string): AtomActions {
  return {
    updateItem: async (id: string, updates: any) => {
      try {
        const operationsModule = await import(`@repo/dataforge/${entityName.toLowerCase()}-operations`)
        const updateFunction = operationsModule[`update${entityName}LiveChanges`]
        if (updateFunction) {
          updateFunction(id, updates)
        } else {
          console.warn(`[LiveChangesConfig] No update function found for ${entityName}`)
        }
      } catch (error) {
        console.error(`[LiveChangesConfig] Failed to import ${entityName} operations:`, error)
      }
    },
    removeItem: async (id: string) => {
      try {
        const operationsModule = await import(`@repo/dataforge/${entityName.toLowerCase()}-operations`)
        const deleteFunction = operationsModule[`delete${entityName}LiveChanges`]
        if (deleteFunction) {
          deleteFunction(id)
        } else {
          console.warn(`[LiveChangesConfig] No delete function found for ${entityName}`)
        }
      } catch (error) {
        console.error(`[LiveChangesConfig] Failed to import ${entityName} operations:`, error)
      }
    },
    hasItem: (id: string) => {
      // Generic check - can be enhanced per entity if needed
      return false
    },
    loadItems: async (items: any[]) => {
      try {
        const operationsModule = await import(`@repo/dataforge/${entityName.toLowerCase()}-operations`)
        const utilsModule = operationsModule[`${entityName.toLowerCase()}Utils`]
        if (utilsModule?.loadItems) {
          utilsModule.loadItems(items)
        } else {
          console.warn(`[LiveChangesConfig] No loadItems function found for ${entityName}`)
        }
      } catch (error) {
        console.error(`[LiveChangesConfig] Failed to import ${entityName} utils:`, error)
      }
    }
  }
}

// Live changes actions using the new 3-path architecture
// These call the live changes path functions which only update atoms
const DOMAIN_ACTIONS: Record<string, AtomActions> = {
  Task: {
    updateItem: (id: string, updates: any) => {
      // Use live changes path function for proper 3-path architecture
      import('@/domain/task').then(({ updateTaskLiveChanges }) => {
        updateTaskLiveChanges(id, updates)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import task live changes functions:', error)
        // Fallback to direct atom update
        taskAtomActions.updateTaskAtomOnly(id, updates)
      })
    },
    removeItem: (id: string) => {
      import('@/domain/task').then(({ deleteTaskLiveChanges }) => {
        deleteTaskLiveChanges(id)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import task live changes functions:', error)
        // Fallback to direct atom update
        taskAtomActions.deleteTaskAtomOnly(id)
      })
    },
    hasItem: (id: string) => {
      // Import and check the atom directly to avoid circular dependencies
      const { tasksAtom } = require('@/domain/task')
      const tasksRecord = tasksAtom.get()
      return id in tasksRecord
    },
    loadItems: (items: any[]) => {
      taskUtils.loadTasks(items)
    }
  },
  
  Project: {
    updateItem: (id: string, updates: any) => {
      import('@/domain/project').then(({ updateProjectLiveChanges }) => {
        updateProjectLiveChanges(id, updates)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import project live changes functions:', error)
        // Fallback to direct atom update
        projectAtomActions.updateProjectAtomOnly(id, updates)
      })
    },
    removeItem: (id: string) => {
      import('@/domain/project').then(({ deleteProjectLiveChanges }) => {
        deleteProjectLiveChanges(id)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import project live changes functions:', error)
        // Fallback to direct atom update
        projectAtomActions.deleteProjectAtomOnly(id)
      })
    },
    hasItem: (id: string) => {
      const { projectsAtom } = require('@/domain/project')
      const projectsRecord = projectsAtom.get()
      return id in projectsRecord
    },
    loadItems: (items: any[]) => {
      projectUtils.loadProjects(items)
    }
  },
  
  User: {
    updateItem: (id: string, updates: any) => {
      import('@/domain/user').then(({ updateUserLiveChanges }) => {
        updateUserLiveChanges(id, updates)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import user live changes functions:', error)
        // Fallback to direct atom update
        userAtomActions.updateUserAtomOnly(id, updates)
      })
    },
    removeItem: (id: string) => {
      import('@/domain/user').then(({ deleteUserLiveChanges }) => {
        deleteUserLiveChanges(id)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import user live changes functions:', error)
        // Fallback to direct atom update
        userAtomActions.deleteUserAtomOnly(id)
      })
    },
    hasItem: (id: string) => {
      const { usersAtom } = require('@/domain/user')
      const usersRecord = usersAtom.get()
      return id in usersRecord
    },
    loadItems: (items: any[]) => {
      userUtils.loadUsers(items)
    }
  },
  
  Comment: {
    updateItem: (id: string, updates: any) => {
      import('@/domain/comment').then(({ updateCommentLiveChanges }) => {
        updateCommentLiveChanges(id, updates)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import comment live changes functions:', error)
        // Fallback to direct atom update
        commentAtomActions.updateCommentAtomOnly(id, updates)
      })
    },
    removeItem: (id: string) => {
      import('@/domain/comment').then(({ deleteCommentLiveChanges }) => {
        deleteCommentLiveChanges(id)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import comment live changes functions:', error)
        // Fallback to direct atom update
        commentAtomActions.deleteCommentAtomOnly(id)
      })
    },
    hasItem: (id: string) => {
      const { commentsAtom } = require('@/domain/comment')
      const commentsRecord = commentsAtom.get()
      return id in commentsRecord
    },
    loadItems: (items: any[]) => {
      commentUtils.loadComments(items)
    }
  },
  
  StatusDefinition: {
    updateItem: (id: string, updates: any) => {
      import('@/domain/status-definition').then(({ updateStatusDefinitionLiveChanges }) => {
        updateStatusDefinitionLiveChanges(id, updates)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import status definition live changes functions:', error)
        // Fallback to direct atom update
        statusDefinitionAtomActions.updateStatusDefinitionAtomOnly(id, updates)
      })
    },
    removeItem: (id: string) => {
      import('@/domain/status-definition').then(({ deleteStatusDefinitionLiveChanges }) => {
        deleteStatusDefinitionLiveChanges(id)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import status definition live changes functions:', error)
        // Fallback to direct atom update
        statusDefinitionAtomActions.deleteStatusDefinitionAtomOnly(id)
      })
    },
    hasItem: (id: string) => {
      const { statusDefinitionsAtom } = require('@/domain/status-definition')
      const statusDefinitionsRecord = statusDefinitionsAtom.get()
      return id in statusDefinitionsRecord
    },
    loadItems: (items: any[]) => {
      statusDefinitionUtils.loadStatusDefinitions(items)
    }
  },
  
  StatusSet: {
    updateItem: (id: string, updates: any) => {
      import('@/domain/status-set').then(({ updateStatusSetLiveChanges }) => {
        updateStatusSetLiveChanges(id, updates)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import status set live changes functions:', error)
        // Fallback to direct atom update
        statusSetAtomActions.updateStatusSetAtomOnly(id, updates)
      })
    },
    removeItem: (id: string) => {
      import('@/domain/status-set').then(({ deleteStatusSetLiveChanges }) => {
        deleteStatusSetLiveChanges(id)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import status set live changes functions:', error)
        // Fallback to direct atom update
        statusSetAtomActions.deleteStatusSetAtomOnly(id)
      })
    },
    hasItem: (id: string) => {
      const { statusSetsAtom } = require('@/domain/status-set')
      const statusSetsRecord = statusSetsAtom.get()
      return id in statusSetsRecord
    },
    loadItems: (items: any[]) => {
      statusSetUtils.loadStatusSets(items)
    }
  },
  
  Tag: {
    updateItem: (id: string, updates: any) => {
      import('@/domain/tag').then(({ updateTagLiveChanges }) => {
        updateTagLiveChanges(id, updates)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import tag live changes functions:', error)
        // Fallback to direct atom update
        tagAtomActions.updateTagAtomOnly(id, updates)
      })
    },
    removeItem: (id: string) => {
      import('@/domain/tag').then(({ deleteTagLiveChanges }) => {
        deleteTagLiveChanges(id)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import tag live changes functions:', error)
        // Fallback to direct atom update
        tagAtomActions.deleteTagAtomOnly(id)
      })
    },
    hasItem: (id: string) => {
      const { tagsAtom } = require('@/domain/tag')
      const tagsRecord = tagsAtom.get()
      return id in tagsRecord
    },
    loadItems: (items: any[]) => {
      tagUtils.loadTags(items)
    }
  },
  
  TagSet: {
    updateItem: (id: string, updates: any) => {
      import('@/domain/tag-set').then(({ updateTagSetLiveChanges }) => {
        updateTagSetLiveChanges(id, updates)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import tag set live changes functions:', error)
        // Fallback to direct atom update
        tagSetAtomActions.updateTagSetAtomOnly(id, updates)
      })
    },
    removeItem: (id: string) => {
      import('@/domain/tag-set').then(({ deleteTagSetLiveChanges }) => {
        deleteTagSetLiveChanges(id)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import tag set live changes functions:', error)
        // Fallback to direct atom update
        tagSetAtomActions.deleteTagSetAtomOnly(id)
      })
    },
    hasItem: (id: string) => {
      const { tagSetsAtom } = require('@/domain/tag-set')
      const tagSetsRecord = tagSetsAtom.get()
      return id in tagSetsRecord
    },
    loadItems: (items: any[]) => {
      tagSetUtils.loadTagSets(items)
    }
  }
}

/**
 * Automatically generates live changes configuration for all domain entities
 * Now using pure XState for all domains
 */
async function generateLiveChangesEntities(): Promise<EntityConfig[]> {
  const configs: EntityConfig[] = []
  
  // Get domain entity names from CLIENT_DOMAIN_TABLES
  const domainEntityNames = Object.values(TABLE_TO_ENTITY_MAP)
  
  console.log(`[LiveChangesConfig] 🔍 Processing ${domainEntityNames.length} domain entities:`, 
    domainEntityNames.join(', '))
  
  // Process each domain entity
  for (const entityName of domainEntityNames) {
    try {
      // Get the entity class from client-entities exports
      const EntityClass = (clientEntities as any)[entityName]
      if (!EntityClass) {
        console.warn(`[LiveChangesConfig] ⚠️ ${entityName}: Entity class not found in client-entities`)
        continue
      }
      
      // Get the actual table name from the TABLE_TO_ENTITY_MAP (reverse lookup)
      const tableName = Object.entries(TABLE_TO_ENTITY_MAP).find(([_, eName]) => eName === entityName)?.[0]
      if (!tableName) {
        console.warn(`[LiveChangesConfig] ⚠️ ${entityName}: Table name not found in mapping`)
        continue
      }
      
      // Get the corresponding XState actions - use hardcoded for existing entities, dynamic for new ones
      let atomActions = DOMAIN_ACTIONS[entityName]
      if (!atomActions) {
        // Create dynamic actions for generated entities
        atomActions = createDomainActions(entityName)
        console.log(`[LiveChangesConfig] 🔧 ${entityName}: Using dynamic actions`)
      } else {
        console.log(`[LiveChangesConfig] ✅ ${entityName}: Using existing domain actions`)
      }
      
      configs.push({
        entity: EntityClass,
        atomActions,
        tableName // Include the correct table name
      })
      
    } catch (error) {
      console.error(`[LiveChangesConfig] ❌ ${entityName}: Failed to create config:`, error)
    }
  }
  
  return configs
}

/**
 * Domain entities live changes configuration
 * 
 * Automatically generated from CLIENT_DOMAIN_TABLES and their services.
 */
let liveChangesEntities: EntityConfig[] | null = null

export async function getLiveChangesEntities(): Promise<EntityConfig[]> {
  if (!liveChangesEntities) {
    liveChangesEntities = await generateLiveChangesEntities()
    console.log(`[LiveChangesConfig] 🚀 Generated live changes for ${liveChangesEntities.length} domain entities:`, 
      liveChangesEntities.map(config => config.entity.name).join(', '))
  }
  return liveChangesEntities
}

// For backward compatibility, create a promise-based export
export const LIVE_CHANGES_ENTITIES = getLiveChangesEntities() 
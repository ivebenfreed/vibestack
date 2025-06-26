/**
 * Live Changes Configuration
 * 
 * Centralized live changes configuration using pure XState for all domains.
 * This replaces individual domain service live changes with a unified approach.
 * All entities use XState atoms for better performance and consistency.
 */

import * as clientEntities from '@repo/dataforge/client-entities'
import { CLIENT_DOMAIN_TABLES } from '@repo/dataforge/client-entities'
import { taskActions } from '@/domain/task'
import { projectActions } from '@/domain/project'
import { userActions } from '@/domain/user'
import { commentActions } from '@/domain/comment'
import type { EntityConfig, AtomActions } from '@/types/live-changes'

// Map table names to entity names (remove quotes and convert to PascalCase)
const TABLE_TO_ENTITY_MAP = CLIENT_DOMAIN_TABLES.reduce((map, tableName) => {
  // Remove quotes and convert to singular PascalCase
  const cleanTable = tableName.replace(/"/g, '')
  let entityName: string
  
  switch (cleanTable) {
    case 'users':
      entityName = 'User'
      break
    case 'projects':
      entityName = 'Project'
      break
    case 'tasks':
      entityName = 'Task'
      break
    case 'comments':
      entityName = 'Comment'
      break
    default:
      // Generic conversion: remove 's' and capitalize
      entityName = cleanTable.slice(0, -1).charAt(0).toUpperCase() + cleanTable.slice(1, -1)
  }
  
  map[cleanTable] = entityName
  return map
}, {} as Record<string, string>)

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
        taskActions.updateTaskAtomOnly(id, updates)
      })
    },
    removeItem: (id: string) => {
      import('@/domain/task').then(({ deleteTaskLiveChanges }) => {
        deleteTaskLiveChanges(id)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import task live changes functions:', error)
        // Fallback to direct atom update
        taskActions.deleteTaskAtomOnly(id)
      })
    },
    hasItem: (id: string) => {
      // Import and check the atom directly to avoid circular dependencies
      const { tasksAtom } = require('@/domain/task')
      const tasksRecord = tasksAtom.get()
      return id in tasksRecord
    },
    loadItems: (items: any[]) => {
      taskActions.loadTasks(items)
    }
  },
  
  Project: {
    updateItem: (id: string, updates: any) => {
      import('@/domain/project').then(({ updateProjectLiveChanges }) => {
        updateProjectLiveChanges(id, updates)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import project live changes functions:', error)
        // Fallback to direct atom update
        projectActions.updateProjectAtomOnly(id, updates)
      })
    },
    removeItem: (id: string) => {
      import('@/domain/project').then(({ deleteProjectLiveChanges }) => {
        deleteProjectLiveChanges(id)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import project live changes functions:', error)
        // Fallback to direct atom update
        projectActions.deleteProjectAtomOnly(id)
      })
    },
    hasItem: (id: string) => {
      const { projectsAtom } = require('@/domain/project')
      const projectsRecord = projectsAtom.get()
      return id in projectsRecord
    },
    loadItems: (items: any[]) => {
      projectActions.loadProjects(items)
    }
  },
  
  User: {
    updateItem: (id: string, updates: any) => {
      import('@/domain/user').then(({ updateUserLiveChanges }) => {
        updateUserLiveChanges(id, updates)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import user live changes functions:', error)
        // Fallback to direct atom update
        userActions.updateUserAtomOnly(id, updates)
      })
    },
    removeItem: (id: string) => {
      import('@/domain/user').then(({ deleteUserLiveChanges }) => {
        deleteUserLiveChanges(id)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import user live changes functions:', error)
        // Fallback to direct atom update
        userActions.deleteUserAtomOnly(id)
      })
    },
    hasItem: (id: string) => {
      const { usersAtom } = require('@/domain/user')
      const usersRecord = usersAtom.get()
      return id in usersRecord
    },
    loadItems: (items: any[]) => {
      userActions.loadUsers(items)
    }
  },
  
  Comment: {
    updateItem: (id: string, updates: any) => {
      import('@/domain/comment').then(({ updateCommentLiveChanges }) => {
        updateCommentLiveChanges(id, updates)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import comment live changes functions:', error)
        // Fallback to direct atom update
        commentActions.updateCommentAtomOnly(id, updates)
      })
    },
    removeItem: (id: string) => {
      import('@/domain/comment').then(({ deleteCommentLiveChanges }) => {
        deleteCommentLiveChanges(id)
      }).catch(error => {
        console.error('[LiveChangesConfig] Failed to import comment live changes functions:', error)
        // Fallback to direct atom update
        commentActions.deleteCommentAtomOnly(id)
      })
    },
    hasItem: (id: string) => {
      const { commentsAtom } = require('@/domain/comment')
      const commentsRecord = commentsAtom.get()
      return id in commentsRecord
    },
    loadItems: (items: any[]) => {
      commentActions.loadComments(items)
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
      
      // Get the corresponding XState actions
      const atomActions = DOMAIN_ACTIONS[entityName]
      if (!atomActions) {
        console.warn(`[LiveChangesConfig] ⚠️ ${entityName}: No XState actions found, skipping`)
        continue
      }
      
      configs.push({
        entity: EntityClass,
        atomActions
      })
      
      console.log(`[LiveChangesConfig] ✅ ${entityName}: Using pure XState actions`)
      
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
/**
 * useEntityConfig - Auto-resolve columns and relationships for VibeGridOptimus
 * 
 * This hook replaces manual column configuration with automatic resolution
 * based on entity name using DataForge exports
 */

import { useMemo } from 'react'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import type { EntityName } from '../core/EntityRegistry'
import type { OptimusColumn } from '../types'

// Import all column configurations from DataForge
import { 
  ProjectColumns, 
  TaskColumns, 
  UserColumns, 
  CommentColumns 
} from '@repo/dataforge/column-configurations'

// Import XState atoms for relationship data
import { projectsAtom } from '@/domain/project'
import { tasksAtom } from '@/domain/task'
import { usersAtom } from '@/domain/user'
// Note: commentsAtom might not exist yet, using empty array as fallback

/**
 * Entity column configuration mapping
 */
const ENTITY_COLUMNS = {
  Project: ProjectColumns,
  Task: TaskColumns,
  User: UserColumns,
  Comment: CommentColumns
} as const

/**
 * Hook return type
 */
interface UseEntityConfigReturn {
  columns: OptimusColumn<any>[]
  relationshipData: Record<string, Array<{ value: string; label: string }>>
  isConfigLoading: boolean
  configError: string | null
}

/**
 * Resolve entity configuration from entity name
 */
export function useEntityConfig(entityName: EntityName): UseEntityConfigReturn {
  // Get relationship data from XState atoms
  const projects = useSelector(projectsAtom, (projectsRecord) => Object.values(projectsRecord), shallowEqual)
  const users = useSelector(usersAtom, (usersRecord) => Object.values(usersRecord), shallowEqual)
  const tasks = useSelector(tasksAtom, (tasksRecord) => Object.values(tasksRecord), shallowEqual)
  // Comments atom might not exist yet
  const comments: any[] = []

  // Get base columns for entity
  const baseColumns = useMemo(() => {
    const entityColumns = ENTITY_COLUMNS[entityName]
    if (!entityColumns) {
      console.error(`No columns found for entity: ${entityName}`)
      return {}
    }
    return entityColumns
  }, [entityName])

  // Build relationship data options
  const relationshipData = useMemo(() => {
    return {
      project: projects.map(p => ({
        value: p.id,
        label: p.name || `Project ${p.id.slice(0, 8)}`
      })),
      user: users.map(u => ({
        value: u.id,
        label: u.name || u.email || `User ${u.id.slice(0, 8)}`
      })),
      task: tasks.map(t => ({
        value: t.id,
        label: t.title || `Task ${t.id.slice(0, 8)}`
      })),
      comment: comments.map(c => ({
        value: c.id,
        label: c.content?.slice(0, 50) || `Comment ${c.id.slice(0, 8)}`
      }))
    }
  }, [projects, users, tasks, comments])

  // Enhance columns with relationship options
  const enhancedColumns = useMemo(() => {
    const columnsArray = Object.entries(baseColumns)
    
    // Filter and order columns based on entity
    let orderedKeys: string[] = []
    
    switch (entityName) {
      case 'Project':
        // Remove ID columns, keep relationship columns
        orderedKeys = ['name', 'description', 'status', 'priority', 'owner', 'members', 'startDate', 'endDate', 'createdAt', 'updatedAt']
        break
      case 'Task':
        orderedKeys = ['title', 'description', 'status', 'priority', 'assignee', 'project', 'dueDate', 'startDate', 'completedAt', 'createdAt', 'updatedAt']
        break
      case 'User':
        orderedKeys = ['name', 'email', 'role', 'createdAt', 'updatedAt']
        break
      case 'Comment':
        orderedKeys = ['content', 'author', 'task', 'project', 'createdAt', 'updatedAt']
        break
    }

    // Build enhanced columns with relationship data
    return orderedKeys
      .map(key => {
        const column = baseColumns[key]
        if (!column) return null

        const meta = column.meta || {}
        const cellType = meta.cellType || 'text'
        const config = meta.config || {}
        
        // Enhance relationship columns with options
        let enhancedConfig = { ...config }
        
        if (cellType.includes('relationship')) {
          // Determine target entity from column key or metadata
          let targetEntity: string | undefined
          
          if (key === 'owner' || key === 'assignee' || key === 'author' || key === 'members') {
            targetEntity = 'user'
          } else if (key === 'project' || key === 'projectId') {
            targetEntity = 'project'
          } else if (key === 'task' || key === 'taskId') {
            targetEntity = 'task'
          } else if (meta.businessLogic?.targetEntity) {
            targetEntity = meta.businessLogic.targetEntity.toLowerCase()
          }

          if (targetEntity && relationshipData[targetEntity]) {
            enhancedConfig.options = relationshipData[targetEntity]
          }
        }

        // Return enhanced column
        return {
          ...column,
          meta: {
            ...meta,
            config: enhancedConfig
          }
        }
      })
      .filter(Boolean) // Remove null entries
  }, [baseColumns, entityName, relationshipData])

  return {
    columns: enhancedColumns as any, // Will be properly typed after conversion
    relationshipData,
    isConfigLoading: false,
    configError: null
  }
}
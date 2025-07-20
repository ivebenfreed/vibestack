/**
 * useEntityConfig - Auto-resolve columns and relationships for VibeGridOptimus
 * 
 * This hook replaces manual column configuration with automatic resolution
 * based on entity name using DataForge exports
 */

import React, { useMemo } from 'react'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import type { EntityName } from '../core/EntityRegistry'
import type { OptimusColumn } from '../types'

// RDG column configurations removed - define types locally
type RDGColumn<T = any> = {
  key: string
  name: string
  width?: number
  resizable?: boolean
  frozen?: boolean
  renderCell?: (props: any) => React.ReactNode
  renderEditCell?: (props: any) => React.ReactNode
}

// Import XState atoms for relationship data
import { projectsAtom } from '@/domain/project'
import { tasksAtom } from '@/domain/task'
import { usersAtom } from '@/domain/user'
// Note: commentsAtom might not exist yet, using empty array as fallback

/**
 * Entity RDG column configuration mapping
 * Define basic columns locally since rdg-column-configurations was removed
 */
const ENTITY_RDG_COLUMNS = {
  Project: [] as RDGColumn[],
  Task: [
    { key: 'id', name: 'ID', width: 100 },
    { key: 'title', name: 'Title', width: 200 },
    { key: 'status', name: 'Status', width: 120 },
    { key: 'priority', name: 'Priority', width: 100 },
    { key: 'assigneeId', name: 'Assignee', width: 150 },
    { key: 'projectId', name: 'Project', width: 150 },
    { key: 'dueDate', name: 'Due Date', width: 120 },
  ] as RDGColumn[],
  User: [] as RDGColumn[],
  Comment: [] as RDGColumn[]
} as const

/**
 * Entity save handler function type
 */
type EntitySaveHandler = (id: string, column: string, value: any) => Promise<void>

/**
 * Hook return type
 */
interface UseEntityConfigReturn {
  columns: RDGColumn<any>[]
  relationshipData: Record<string, Array<{ value: string; label: string }>>
  saveHandler: EntitySaveHandler
  isConfigLoading: boolean
  configError: string | null
}

/**
 * Resolve entity configuration from entity name
 */
export function useEntityConfig(entityName: EntityName): UseEntityConfigReturn {
  // Get relationship data from XState atoms using proper selectors to maintain stable references
  const projects = useSelector(projectsAtom, (projectsRecord) => Object.values(projectsRecord), shallowEqual)
  const users = useSelector(usersAtom, (usersRecord) => Object.values(usersRecord), shallowEqual)
  const tasks = useSelector(tasksAtom, (tasksRecord) => Object.values(tasksRecord), shallowEqual)
  
  // Comments atom might not exist yet
  const comments: any[] = []

  // Get RDG columns for entity
  const rdgColumns = useMemo(() => {
    const entityColumns = ENTITY_RDG_COLUMNS[entityName]
    if (!entityColumns) {
      console.error(`No RDG columns found for entity: ${entityName}`)
      return []
    }
    console.log(`[useEntityConfig] Raw RDG columns for ${entityName}:`, entityColumns)
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

  // Enhance RDG columns with relationship options
  const enhancedColumns = useMemo(() => {
    return rdgColumns.map(column => {
      const rdgConfig = column.rdgConfig || {}
      const cellType = rdgConfig.cellType || 'text'
      
      // Enhance relationship columns with options
      if (cellType?.startsWith('relationship')) {
        const key = column.key as string
        let targetEntity: string | undefined
        
        // First try to get from the config
        if (rdgConfig.config?.targetEntity) {
          targetEntity = rdgConfig.config.targetEntity.toLowerCase()
        } else {
          // Fallback to key-based mapping
          if (key === 'owner' || key === 'assignee' || key === 'author' || key === 'members') {
            targetEntity = 'user'
          } else if (key === 'project' || key === 'projectId') {
            targetEntity = 'project'
          } else if (key === 'task' || key === 'taskId') {
            targetEntity = 'task'
          } else if (key === 'parent') {
            targetEntity = 'comment'
          }
        }

        if (targetEntity && relationshipData[targetEntity]) {
          return {
            ...column,
            rdgConfig: {
              ...rdgConfig,
              config: {
                ...rdgConfig.config,
                options: relationshipData[targetEntity]
              }
            }
          }
        } else {
          console.warn(`[useEntityConfig] No relationship data found for ${key}, targetEntity: ${targetEntity}`)
        }
      }

      return column
    })
  }, [rdgColumns, relationshipData])

  // Create entity-specific save handler
  const saveHandler = useMemo((): EntitySaveHandler => {
    return async (id: string, column: string, value: any) => {
      try {
        console.log(`[useEntityConfig] Saving ${entityName}:`, { id, column, value })
        
        switch (entityName) {
          case 'Project': {
            const { updateProjectUI } = await import('@/domain/project')
            
            // Handle special field mappings for projects
            let updateData: any = {}
            if (column === 'owner') {
              updateData = { ownerId: value || null }
            } else if (column === 'members') {
              // Handle members relationship
              updateData = { memberIds: Array.isArray(value) ? value : (value ? [value] : []) }
            } else {
              updateData = { [column]: value }
            }
            
            await updateProjectUI(id, updateData)
            break
          }
          
          case 'Task': {
            const { updateTaskUI } = await import('@/domain/task')
            const { tasksAtom } = await import('@/domain/task')
            
            // Handle special field mappings and business logic for tasks
            let updateData: any = {}
            
            if (column === 'assignee') {
              updateData = { assigneeId: value || null }
            } else if (column === 'project') {
              updateData = { projectId: value || null }
            } else if (column === 'status') {
              // Task-specific business logic for status changes
              const currentTasks = tasksAtom.get()
              const task = currentTasks?.[id]
              
              if (task) {
                // Auto-set completion date when marking as complete
                if (value === 'completed' && !task.completedAt) {
                  updateData = { 
                    status: value,
                    completedAt: new Date()
                  }
                } else if (task.status === 'completed' && value !== 'completed') {
                  // Clear completion date when moving from completed
                  updateData = { 
                    status: value,
                    completedAt: undefined
                  }
                } else {
                  updateData = { [column]: value }
                }
              } else {
                updateData = { [column]: value }
              }
            } else {
              updateData = { [column]: value }
            }
            
            await updateTaskUI(id, updateData)
            break
          }
          
          case 'User': {
            const { updateUserUI } = await import('@/domain/user')
            const updateData = { [column]: value }
            await updateUserUI(id, updateData)
            break
          }
          
          case 'Comment': {
            // Comment domain might not exist yet
            console.warn('[useEntityConfig] Comment update not implemented yet')
            break
          }
          
          default:
            throw new Error(`Unknown entity type: ${entityName}`)
        }
        
        console.log(`✅ ${entityName} updated successfully:`, { id, column, value })
      } catch (error) {
        console.error(`❌ Failed to update ${entityName}:`, error)
        throw error
      }
    }
  }, [entityName])

  return {
    columns: enhancedColumns,
    relationshipData,
    saveHandler,
    isConfigLoading: false,
    configError: null
  }
}
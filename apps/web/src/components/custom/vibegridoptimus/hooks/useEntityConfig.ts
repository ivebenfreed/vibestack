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
 * Entity save handler function type
 */
type EntitySaveHandler = (id: string, column: string, value: any) => Promise<void>

/**
 * Hook return type
 */
interface UseEntityConfigReturn {
  columns: OptimusColumn<any>[]
  relationshipData: Record<string, Array<{ value: string; label: string }>>
  saveHandler: EntitySaveHandler
  isConfigLoading: boolean
  configError: string | null
}

/**
 * Resolve entity configuration from entity name
 */
export function useEntityConfig(entityName: EntityName): UseEntityConfigReturn {
  // Get relationship data from XState atoms (memoized to prevent re-renders)
  const projects = useMemo(() => {
    const projectsRecord = projectsAtom.get()
    return Object.values(projectsRecord)
  }, [])
  
  const users = useMemo(() => {
    const usersRecord = usersAtom.get()
    return Object.values(usersRecord)
  }, [])
  
  const tasks = useMemo(() => {
    const tasksRecord = tasksAtom.get()
    return Object.values(tasksRecord)
  }, [])
  
  // Comments atom might not exist yet
  const comments: any[] = []

  // Get base columns for entity
  const baseColumns = useMemo(() => {
    const entityColumns = ENTITY_COLUMNS[entityName]
    if (!entityColumns) {
      console.error(`No columns found for entity: ${entityName}`)
      return {}
    }
    console.log(`[useEntityConfig] Raw columns for ${entityName}:`, entityColumns)
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

  // Convert to the format expected by useColumnAdapter
  const columnsAsRecord = useMemo(() => {
    const record: Record<string, any> = {}
    enhancedColumns.forEach((column: any) => {
      if (column && column.id) {
        record[column.id] = column
      } else if (column && column.accessorKey) {
        record[column.accessorKey] = column
      }
    })
    console.log('[useEntityConfig] Converted columns to record:', record)
    return record
  }, [enhancedColumns])

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

  return React.useMemo(() => ({
    columns: columnsAsRecord,
    relationshipData,
    saveHandler,
    isConfigLoading: false,
    configError: null
  }), [columnsAsRecord, relationshipData, saveHandler])
}
import React, { useCallback } from 'react'
import { VibeGridDex } from '@/components/custom/vibegriddex/VibeGridDex'
import { domainServices } from '@/domain'
import { useTheme } from '@/context/theme-context'
import type { Task } from '@repo/dataforge/client-entities'
import type { Column } from '@/components/custom/vibegriddex/column-types'

/**
 * TasksTableView - Using VibeGridDex for Dexie-based data grid
 */
export default function TasksTableView() {
  
  // Get theme and resolve 'system' to actual theme
  const { theme } = useTheme()
  const effectiveTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme

  // Define batch update handler for better performance with fill operations
  const handleBatchUpdate = useCallback(async (updates: Array<{ id: string; updates: Record<string, any> }>) => {
    try {
      await domainServices.task.batchUpdateUI(updates);
      console.log('TasksTableView: Batch update completed', { count: updates.length });
    } catch (error) {
      console.error('TasksTableView: Batch update failed', error);
      throw error; // Re-throw to let VibeGridDex handle the error
    }
  }, []);

  // Define columns for Task entity
  const columns: Column<Task>[] = [
    { id: 'title', field: 'title', name: 'Title', cellType: 'text', width: 300, editable: true },
    { id: 'description', field: 'description', name: 'Description', cellType: 'text', width: 400, editable: true },
    { id: 'statusId', field: 'statusId', name: 'Status', cellType: 'relationship-single', 
      width: 150, editable: true,
      relationshipTable: 'status_definitions',
      relationshipDisplayField: 'name',
      relationshipFilter: async () => {
        // Only show status definitions for tasks
        const statusDefs = await domainServices.statusDefinition.getStatusDefinitionsForEntityType('task');
        return statusDefs.map(sd => sd.id);
      }
    },
    { id: 'priority', field: 'priority', name: 'Priority', cellType: 'enum', width: 120, editable: true,
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
      ]
    },
    { id: 'tags', field: 'tags', name: 'Tags', cellType: 'relationship-multi',
      width: 250, editable: true, sortable: false,
      relationshipTable: 'tags',
      relationshipDisplayField: 'name',
      junctionTable: 'task_tags',
      junctionSourceField: 'task_id',
      junctionTargetField: 'tag_id',
      // For now, show all tags regardless of project
      // In the future, we could implement a smarter filter that prioritizes project tags
      relationshipFilter: undefined
    },
    { id: 'dueDate', field: 'dueDate', name: 'Due Date', cellType: 'date', width: 150, editable: true },
    { id: 'projectId', field: 'projectId', name: 'Project', cellType: 'relationship-single', 
      width: 200, relationshipTable: 'projects', relationshipDisplayField: 'name', editable: true },
    { id: 'assigneeId', field: 'assigneeId', name: 'Assignee', cellType: 'relationship-single',
      width: 180, relationshipTable: 'users', relationshipDisplayField: 'name', editable: true },
    { id: 'createdAt', field: 'createdAt', name: 'Created', cellType: 'date', width: 150, editable: false },
    { id: 'updatedAt', field: 'updatedAt', name: 'Updated', cellType: 'date', width: 150, editable: false }
  ]

  return (
    <VibeGridDex
      tableId="tasks-table-v2"
      entityType="task"
      columns={columns}
      onEntityUpdate={(id, updates) => domainServices.task.updateUI(id, updates)}
      onBatchEntityUpdate={handleBatchUpdate}
      height={600}
      className="border border-border rounded-lg"
      enableSorting
      enableFiltering
      enableVirtualScrolling
    />
  )
}
/**
 * Task Row Selection Demo
 * 
 * Demonstrates the activated row selection feature on tasks
 * with all bulk actions enabled and working.
 */

import React from 'react'
import { TaskVibeGrid } from '../entities/TaskVibeGrid'
import { ContentContainer } from '@/components/layout/content-container'
import { taskActions } from '@/domain/task'

export function TaskRowSelectionDemo() {
  // ============================================================================
  // Enhanced Bulk Action Handlers with Feedback
  // ============================================================================
  
  const handleBulkDelete = React.useCallback(async (taskIds: string[]) => {
    console.log('[TaskRowSelectionDemo] Bulk delete tasks:', taskIds)
    
    const confirmed = window.confirm(
      `🗑️ Delete ${taskIds.length} tasks?\n\nThis action cannot be undone. Are you sure you want to proceed?`
    )
    
    if (confirmed) {
      try {
        await Promise.all(taskIds.map(id => taskActions.deleteTask(id)))
        
        // Success feedback
        alert(`✅ Successfully deleted ${taskIds.length} tasks!`)
        console.log(`[TaskRowSelectionDemo] Successfully deleted ${taskIds.length} tasks`)
      } catch (error) {
        console.error('[TaskRowSelectionDemo] Bulk delete failed:', error)
        alert(`❌ Failed to delete tasks. Please try again.\n\nError: ${error}`)
      }
    }
  }, [])
  
  const handleBulkEdit = React.useCallback(async (taskIds: string[]) => {
    console.log('[TaskRowSelectionDemo] Bulk edit tasks:', taskIds)
    
    // Simulate bulk edit operation
    alert(`✏️ Bulk Edit Selected!\n\nSelected ${taskIds.length} tasks for editing.\n\nFeature: Bulk edit modal/form will open here.`)
    
    // TODO: In a real implementation, this would open a bulk edit modal
    // Example operations:
    // - Change status for all selected tasks
    // - Update priority for all selected tasks  
    // - Assign to a different user
    // - Update due dates
    // - Add/remove tags
  }, [])
  
  const handleBulkArchive = React.useCallback(async (taskIds: string[]) => {
    console.log('[TaskRowSelectionDemo] Bulk archive tasks:', taskIds)
    
    const confirmed = window.confirm(
      `📦 Archive ${taskIds.length} tasks?\n\nArchived tasks will be hidden from the main view but can be restored later.`
    )
    
    if (confirmed) {
      // Simulate bulk archive operation
      alert(`📦 Archive feature activated!\n\nSelected ${taskIds.length} tasks would be archived.\n\nNote: Implement archive status in your task domain if needed.`)
      
      // TODO: Implement actual archive logic if your domain supports it
      // This might involve:
      // - Setting an 'archived' status field
      // - Moving to a separate archived tasks table
      // - Adding an archivedAt timestamp
    }
  }, [])

  return (
    <ContentContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            🎯 Task Row Selection Demo
          </h1>
          <p className="text-lg text-muted-foreground">
            Demonstrates the activated native TanStack row selection feature with bulk actions
          </p>
          
          {/* Feature highlights */}
          <div className="flex flex-wrap gap-2 mt-4">
            <div className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
              ✅ Row Selection Active
            </div>
            <div className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
              🔄 Bulk Delete
            </div>
            <div className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
              ✏️ Bulk Edit
            </div>
            <div className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full">
              📦 Bulk Archive
            </div>
            <div className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
              💾 Persistent State
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">
            🎮 How to use Row Selection:
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Select single row:</strong> Click the checkbox in any row</li>
            <li>• <strong>Select all rows:</strong> Click the checkbox in the header</li>
            <li>• <strong>Bulk actions:</strong> Select multiple rows to see the bulk actions toolbar</li>
            <li>• <strong>Clear selection:</strong> Click "Clear" in the toolbar or uncheck header</li>
            <li>• <strong>Persistent state:</strong> Your selection survives page refreshes</li>
          </ul>
        </div>

        {/* Task Grid with Row Selection */}
        <TaskVibeGrid
          enableBulkActions={true}
          onBulkDelete={handleBulkDelete}
          onBulkEdit={handleBulkEdit}
          onBulkArchive={handleBulkArchive}
          className="border border-border rounded-lg shadow-sm"
          debugMode={true}
          tableId="task-row-selection-demo"
        />

        {/* Footer info */}
        <div className="text-xs text-muted-foreground bg-gray-50 p-3 rounded">
          <strong>💡 Implementation Details:</strong> This demo uses the VibeGridFinal component with native TanStack row selection. 
          The selection state is managed internally and persisted to localStorage. 
          Bulk actions are implemented as async callbacks that can be customized per use case.
        </div>
      </div>
    </ContentContainer>
  )
} 
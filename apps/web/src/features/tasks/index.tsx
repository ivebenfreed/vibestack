import React from 'react'
import TasksProvider from './context/tasks-context'
import { TasksPrimaryButtons } from './components/tasks-primary-buttons'
import { TasksTableV3 } from './components/tasks-table-v3'
import { ContentContainer } from '@/components/layout/content-container'

/**
 * Main Tasks Feature Component
 * 
 * ✅ ENHANCED WITH UNIVERSAL TABLE V3:
 * - SimpleUniversalTable with all advanced features
 * - Search & filtering toolbar
 * - Bulk operations (delete, edit)
 * - Inline editing with validation (no mutation drawer needed)
 * - Live updates via XState domain atoms
 * - Complete task management experience
 */
const Tasks: React.FC = () => {
  return (
    <ContentContainer>
      <TasksProvider>
        <div className="flex flex-col">
          <div className='mb-2 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
            <div>
              <h2 className='text-2xl font-bold tracking-tight'>Tasks</h2>
              <p className='text-muted-foreground'>
                Manage your tasks with advanced table features including search, filtering, bulk operations, and inline editing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TasksPrimaryButtons />
            </div>
          </div>
          <div className="mt-4">
            <TasksTableV3 />
          </div>
        </div>
      </TasksProvider>
    </ContentContainer>
  )
}

export default Tasks;

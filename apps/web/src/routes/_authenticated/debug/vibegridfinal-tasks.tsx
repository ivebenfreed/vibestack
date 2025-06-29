import { createFileRoute } from '@tanstack/react-router'
import { VibeGridFinal } from '@/components/custom/vibegridfinal/core/VibeGridFinal'
import { createOptimizedLoader } from '@/domain/ensure-loaded'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import { tasksAtom } from '@/domain/task'
import { projectsAtom } from '@/domain/project'
import { usersAtom } from '@/domain/user'
import { TaskColumns } from '@repo/dataforge/column-configurations'
import type { Task } from '@repo/dataforge/client-entities'

function VibeGridFinalTasksPage() {
  // ⚡ PERFORMANCE: Direct data access - no wrapper component overhead
  const tasks = useSelector(tasksAtom, (tasksRecord) => {
    if (!tasksRecord || typeof tasksRecord !== 'object') return []
    return Object.values(tasksRecord)
  }, shallowEqual)

  const projects = useSelector(projectsAtom, (projectsRecord) => {
    if (!projectsRecord || typeof projectsRecord !== 'object') return []
    return Object.values(projectsRecord)
  }, shallowEqual)

  const users = useSelector(usersAtom, (usersRecord) => {
    if (!usersRecord || typeof usersRecord !== 'object') return []
    return Object.values(usersRecord)
  }, shallowEqual)

  // Simple relationship data
  const relationshipData = {
    project: {
      data: projects,
      displayField: 'name'
    },
    assignee: {
      data: users,
      displayField: 'name'
    }
  }

  // Basic columns
  const columns = [
    TaskColumns.title,
    TaskColumns.status,
    TaskColumns.priority,
    TaskColumns.assignee,
    TaskColumns.project,
    TaskColumns.dueDate,
    TaskColumns.description,
    TaskColumns.id,
  ]

  const handleSave = async (entityId: string, columnId: string, value: any) => {
    console.log('Save:', { entityId, columnId, value })
    // TODO: Implement save logic
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">⚡ VibeGridFinal Direct (No Wrapper)</h2>
        <p className="text-muted-foreground">
          Direct VibeGridFinal usage without wrapper component overhead.
        </p>
      </div>

      {/* Direct VibeGridFinal */}
      <VibeGridFinal
        data={tasks}
        columns={columns}
        relationshipData={relationshipData}
        onSave={handleSave}
        enableSorting={true}
        enablePagination={true}
        enableGlobalSearch={true}
        enableRowSelection={true}
        pageSize={10}
        className="border border-border rounded-lg"
        debugMode={true}
      />
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/debug/vibegridfinal-tasks')({
  loader: createOptimizedLoader(['tasks', 'projects', 'users']),
  component: VibeGridFinalTasksPage,
}) 
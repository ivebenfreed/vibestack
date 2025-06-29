import { createFileRoute } from '@tanstack/react-router'
import TasksKanbanDebug from '@/features/tasks/TasksKanbanDebug'
import { taskUtils } from '@/domain/task'
import { projectUtils } from '@/domain/project'
import { userUtils } from '@/domain/user'

export const Route = createFileRoute('/_authenticated/debug/kanban')({
  loader: async () => {
    await Promise.all([
      taskUtils.ensureLoaded(),
      projectUtils.ensureLoaded(),
      userUtils.ensureLoaded()
    ])
  },
  component: TasksKanbanDebug,
})
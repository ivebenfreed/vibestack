import { createFileRoute } from '@tanstack/react-router'
import TasksKanbanDebug from '@/features/tasks/TasksKanbanDebug'
import { taskUtils } from '@/domain-xstate/task'
import { projectUtils } from '@/domain-xstate/project'
import { userUtils } from '@/domain-xstate/user'

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
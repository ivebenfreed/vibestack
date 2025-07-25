import { createFileRoute } from '@tanstack/react-router'
import TasksKanbanV2 from '@/features/tasks/TasksKanbanV2'
import { taskUtils } from '@/domain-xstate/task'
import { projectUtils } from '@/domain-xstate/project'
import { userUtils } from '@/domain-xstate/user'

export const Route = createFileRoute('/_authenticated/tasks/kanban')({
  loader: async () => {
    // Ensure all necessary data is loaded
    await Promise.all([
      taskUtils.ensureLoaded(),
      projectUtils.ensureLoaded(),
      userUtils.ensureLoaded()
    ])
  },
  component: TasksKanbanV2,
})
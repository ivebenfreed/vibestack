import { createFileRoute } from '@tanstack/react-router'
import TasksKanbanV2 from '@/features/tasks/TasksKanbanV2'
import { taskUtils } from '@/domain/task'
import { projectUtils } from '@/domain/project'
import { userUtils } from '@/domain/user'

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
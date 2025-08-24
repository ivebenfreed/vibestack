import { createFileRoute } from '@tanstack/react-router'
import TasksKanban from '@/features/tasks/TasksKanban'

export const Route = createFileRoute('/_authenticated/tasks/kanban')({
  loader: async () => {
    // Ensure all necessary data is loaded
    return {}
  },
  component: TasksKanban,
})
import { createFileRoute } from '@tanstack/react-router'
import TasksKanbanDebug from '@/features/tasks/TasksKanbanDebug'

export const Route = createFileRoute('/_authenticated/debug/kanban')({
  loader: async () => {
    // Domain-xstate removed - no preloading needed
  },
  component: TasksKanbanDebug,
})
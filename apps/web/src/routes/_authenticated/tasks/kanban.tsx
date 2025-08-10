import { createFileRoute } from '@tanstack/react-router'
import TasksKanbanV2 from '@/features/tasks/TasksKanbanV2'

export const Route = createFileRoute('/_authenticated/tasks/kanban')({
  loader: async () => {
    // Ensure all necessary data is loaded
    await Promise.all([
      ,
      ,
      
    ])
  },
  component: TasksKanbanV2,
})
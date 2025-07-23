import { createFileRoute } from '@tanstack/react-router'
import Tasks from '@/features/tasks'
import { z } from 'zod'

const tasksSearchSchema = z.object({
  view: z.enum(['table', 'kanban', 'timeline']).optional(),
})

export const Route = createFileRoute('/_authenticated/tasks/')({
  // No loader - data fetching handled by Suspense in component
  validateSearch: tasksSearchSchema,
  component: Tasks,
})

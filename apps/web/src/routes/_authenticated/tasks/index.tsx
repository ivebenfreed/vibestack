import { createFileRoute } from '@tanstack/react-router'
import { createOptimizedLoader } from '@/domain/ensure-loaded'
import Tasks from '@/features/tasks'
import { z } from 'zod'

const tasksSearchSchema = z.object({
  view: z.enum(['table', 'kanban', 'timeline']).optional(),
})

export const Route = createFileRoute('/_authenticated/tasks/')({
  loader: createOptimizedLoader(['tasks', 'projects', 'users']),
  validateSearch: tasksSearchSchema,
  component: Tasks,
})

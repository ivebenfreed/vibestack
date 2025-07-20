import { createFileRoute } from '@tanstack/react-router'
// import { createOptimizedLoader } from '@/domain/ensure-loaded' // DISABLED - TypeORM removal
import Tasks from '@/features/tasks'
import { z } from 'zod'

const tasksSearchSchema = z.object({
  view: z.enum(['table', 'kanban', 'timeline']).optional(),
})

export const Route = createFileRoute('/_authenticated/tasks/')({
  // DISABLED: TypeORM removal - no domain loading needed with Dexie
  // loader: createOptimizedLoader(['tasks', 'projects', 'users']),
  loader: async () => {
    console.log('[Tasks Route] Skipping domain loading - using Dexie')
    return null
  },
  validateSearch: tasksSearchSchema,
  component: Tasks,
})

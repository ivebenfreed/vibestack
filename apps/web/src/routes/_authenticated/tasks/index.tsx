import { createFileRoute } from '@tanstack/react-router'
import { createOptimizedLoader } from '@/domain/ensure-loaded'
import Tasks from '@/features/tasks'

export const Route = createFileRoute('/_authenticated/tasks/')({
  loader: createOptimizedLoader(['tasks', 'projects', 'users']),
  component: Tasks,
})

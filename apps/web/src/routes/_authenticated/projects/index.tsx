import { createFileRoute } from '@tanstack/react-router'
import ProjectsPage from '@/features/projects'
import { createOptimizedLoader } from '@/domain/ensure-loaded'

export const Route = createFileRoute('/_authenticated/projects/')({
  loader: createOptimizedLoader(['projects', 'users']),
  component: ProjectsPage,
}) 
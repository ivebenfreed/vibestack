import { createFileRoute } from '@tanstack/react-router'
import ProjectsPage from '@/features/projects'

export const Route = createFileRoute('/_authenticated/projects/')({
  // No loader - data fetching handled by Suspense in component
  component: ProjectsPage,
}) 
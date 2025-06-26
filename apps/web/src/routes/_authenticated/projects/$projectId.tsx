import { createFileRoute } from '@tanstack/react-router'
import ProjectDetailPage from '@/features/projects/components/project-detail-page'
import { createOptimizedLoader } from '@/domain/ensure-loaded'

export const Route = createFileRoute('/_authenticated/projects/$projectId')({
  loader: createOptimizedLoader(['projects', 'tasks', 'users']),
  component: () => {
    const { projectId } = Route.useParams()
    return <ProjectDetailPage projectId={projectId} />
  },
}) 
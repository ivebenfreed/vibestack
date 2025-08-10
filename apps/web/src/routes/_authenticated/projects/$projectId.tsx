import { createFileRoute } from '@tanstack/react-router'
import ProjectDetailPage from '@/features/projects/components/project-detail-page'

export const Route = createFileRoute('/_authenticated/projects/$projectId')({
  // Data loading handled by components with Dexie
  loader: async () => {
    console.log('[Project Detail Route] Skipping domain loading - using Dexie')
    return null
  },
  component: () => {
    const { projectId } = Route.useParams()
    return <ProjectDetailPage projectId={projectId} />
  },
}) 
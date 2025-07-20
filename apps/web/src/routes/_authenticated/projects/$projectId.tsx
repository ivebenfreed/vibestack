import { createFileRoute } from '@tanstack/react-router'
import ProjectDetailPage from '@/features/projects/components/project-detail-page'
// import { createOptimizedLoader } from '@/domain/ensure-loaded' // DISABLED - TypeORM removal

export const Route = createFileRoute('/_authenticated/projects/$projectId')({
  // DISABLED: TypeORM removal - no domain loading needed with Dexie
  // loader: createOptimizedLoader(['projects', 'tasks', 'users']),
  loader: async () => {
    console.log('[Project Detail Route] Skipping domain loading - using Dexie')
    return null
  },
  component: () => {
    const { projectId } = Route.useParams()
    return <ProjectDetailPage projectId={projectId} />
  },
}) 
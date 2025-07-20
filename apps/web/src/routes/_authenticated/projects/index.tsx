import { createFileRoute } from '@tanstack/react-router'
import ProjectsPage from '@/features/projects'
// import { createOptimizedLoader } from '@/domain/ensure-loaded' // DISABLED - TypeORM removal

export const Route = createFileRoute('/_authenticated/projects/')({
  // DISABLED: TypeORM removal - no domain loading needed with Dexie
  // loader: createOptimizedLoader(['projects', 'users']),
  loader: async () => {
    console.log('[Projects Route] Skipping domain loading - using Dexie')
    return null
  },
  component: ProjectsPage,
}) 
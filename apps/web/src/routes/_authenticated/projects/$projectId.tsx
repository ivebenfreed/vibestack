import { createFileRoute } from '@tanstack/react-router'
import ProjectDetailPage from '@/features/projects/components/project-detail-page'
import { getGlobalDataSource } from '@/db/global-datasource'
import { Project, User, Task } from '@repo/dataforge/client-entities'
import { projectActions } from '@/domain/project'
import { userActions } from '@/domain/user'
import { taskActions } from '@/domain/task'

export const Route = createFileRoute('/_authenticated/projects/$projectId')({
  loader: async ({ params }) => {
    console.log(`[Project Detail Route] Starting hydration for project ${params.projectId}...`)
    
    try {
      // Use ensureLoaded pattern - loads all entities if atoms are empty
      console.log('[Project Detail Route] Using ensureLoaded pattern for all entities...')
      await Promise.all([
        projectActions.ensureLoaded(), // Loads all projects (needed for sidebar)
        userActions.ensureLoaded(),    // Loads all users
        taskActions.ensureLoaded()     // Loads all tasks
      ])
      
      console.log('[Project Detail Route] ✅ Entity atoms ensured loaded')
      
      return null // Components will use selectors to get specific project/tasks from atoms
      
    } catch (error) {
      console.error('[Project Detail Route] Failed to ensure entity atoms loaded:', error)
      return null // Let components handle empty state gracefully
    }
  },
  component: () => {
    const { projectId } = Route.useParams()
    return <ProjectDetailPage projectId={projectId} />
  },
}) 
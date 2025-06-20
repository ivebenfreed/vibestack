import { createFileRoute } from '@tanstack/react-router'
import ProjectsPage from '@/features/projects'
import { getGlobalDataSource } from '@/db/global-datasource'
import { Project, User } from '@repo/dataforge/client-entities'
import { projectActions } from '@/domain/project'
import { userActions } from '@/domain/user'

export const Route = createFileRoute('/_authenticated/projects/')({
  loader: async () => {
    console.log('[Projects Route] Starting projects & users hydration...')
    
    try {
      // Use ensureLoaded pattern - only loads if atoms are empty
      console.log('[Projects Route] Using ensureLoaded pattern for projects and users...')
      await Promise.all([
        projectActions.ensureLoaded(),
        userActions.ensureLoaded()
      ])
      
      console.log('[Projects Route] ✅ Entity atoms ensured loaded')
      
      return null // No need to return data since atoms are populated
      
    } catch (error) {
      console.error('[Projects Route] Failed to ensure entity atoms loaded:', error)
      return null // Let components handle empty state gracefully
    }
  },
  component: ProjectsPage,
}) 
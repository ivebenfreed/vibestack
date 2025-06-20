import { createFileRoute } from '@tanstack/react-router'
import Dashboard from '@/features/dashboard'
import { getGlobalDataSource } from '@/db/global-datasource'
import { Project, Task, User, Comment } from '@repo/dataforge/client-entities'
import { projectActions } from '@/domain/project'
import { taskActions } from '@/domain/task'
import { userActions } from '@/domain/user'
import { commentActions } from '@/domain/comment'

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    console.log('[Dashboard Route] Starting entity atoms hydration...')
    
    try {
      // Use ensureLoaded pattern - only loads if atoms are empty
      console.log('[Dashboard Route] Using ensureLoaded pattern for all entities...')
      await Promise.all([
        projectActions.ensureLoaded(),
        taskActions.ensureLoaded(),
        userActions.ensureLoaded(),
        commentActions.ensureLoaded()
      ])
      
      console.log('[Dashboard Route] ✅ Entity atoms ensured loaded')
      
      return null // No need to return data since atoms are populated
      
    } catch (error) {
      console.error('[Dashboard Route] Failed to ensure entity atoms loaded:', error)
      return null // Let components handle empty state gracefully
    }
  },
  component: Dashboard,
})

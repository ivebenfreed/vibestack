import { createFileRoute } from '@tanstack/react-router'
import TasksPage from '@/features/tasks'
import { getGlobalDataSource } from '@/db/global-datasource'
import { Task, Project, User } from '@repo/dataforge/client-entities'
import { taskActions } from '@/domain/task'
import { projectActions } from '@/domain/project'
import { userActions } from '@/domain/user'

export const Route = createFileRoute('/_authenticated/tasks/')({
  loader: async () => {
    console.log('[Tasks Route] Starting tasks, projects & users hydration...')
    
    try {
      // Use ensureLoaded pattern - only loads if atoms are empty
      console.log('[Tasks Route] Using ensureLoaded pattern for tasks, projects, and users...')
      await Promise.all([
        taskActions.ensureLoaded(),
        projectActions.ensureLoaded(),
        userActions.ensureLoaded()
      ])
      
      console.log('[Tasks Route] ✅ Entity atoms ensured loaded')
      
      return null // No need to return data since atoms are populated
      
    } catch (error) {
      console.error('[Tasks Route] Failed to ensure entity atoms loaded:', error)
      return null // Let components handle empty state gracefully
    }
  },
  component: TasksPage,
})

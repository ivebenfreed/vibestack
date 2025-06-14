import { createFileRoute } from '@tanstack/react-router'
import Dashboard from '@/features/dashboard'
import { taskActions } from '@/domain/task'
import { projectActions } from '@/domain/project'
import { userActions } from '@/domain/user'
import { commentActions } from '@/domain/comment'

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    console.log('[DashboardRoute] Loading atoms after system readiness...')
    
    // Load atoms sequentially to avoid PGlite database contention
    await taskActions.ensureLoaded()
    await projectActions.ensureLoaded()
    await userActions.ensureLoaded()
    await commentActions.ensureLoaded()
    
    console.log('[DashboardRoute] ✅ All atoms loaded')
    
    return null
  },
  component: Dashboard,
})

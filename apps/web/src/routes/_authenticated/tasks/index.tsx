import { createFileRoute } from '@tanstack/react-router'
import TasksPage from '@/features/tasks'
import { taskActions } from '@/domain/task'
import { projectActions } from '@/domain/project'
import { userActions } from '@/domain/user'
import { commentActions } from '@/domain/comment'

export const Route = createFileRoute('/_authenticated/tasks/')({
  loader: async () => {
    console.log('[TasksRoute] Loading atoms after system readiness...')
    
    // Load atoms sequentially to avoid PGlite database contention
    await taskActions.ensureLoaded()
    await projectActions.ensureLoaded()
    await userActions.ensureLoaded()
    await commentActions.ensureLoaded()
    
    console.log('[TasksRoute] ✅ All atoms loaded')
    
    return null
  },
  component: TasksPage,
})

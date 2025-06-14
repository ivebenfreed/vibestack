import { createFileRoute } from '@tanstack/react-router'
import ProjectDetailPage from '@/features/projects/components/project-detail-page'
import { projectActions, projectsAtom } from '@/domain/project'
import { userActions, usersAtom } from '@/domain/user'
import { taskActions, tasksAtom } from '@/domain/task'
import { commentActions } from '@/domain/comment'
import { getNewPGliteDataSource } from '@/db/newtypeorm/NewDataSource'
import { Project, Task, User } from '@repo/dataforge/client-entities'

export const Route = createFileRoute('/_authenticated/projects/$projectId')({
  component: () => {
    const { projectId } = Route.useParams()
    return <ProjectDetailPage projectId={projectId} />
  },
  loader: async ({ params, context }) => {
    try {
      // 🎯 XSTATE PATTERN: Check XState stores for existing data
      const currentProjects = projectsAtom.get()
      const currentUsers = usersAtom.get()
      const currentTasks = tasksAtom.get()
      
      const project = currentProjects[params.projectId]
      const users = Object.values(currentUsers)
      const tasks = Object.values(currentTasks).filter(t => t.projectId === params.projectId)
      
      // If we have all data in XState stores, return immediately
      if (project && users.length > 0) {
        console.log('[ProjectDetailRoute] Data already loaded in XState stores')
        return { project, users, tasks }
      }
      
      // 🎯 FALLBACK: Load missing data if XState stores are empty
      const dataSource = await getNewPGliteDataSource()
      if (!dataSource.isInitialized) {
        return { project: null, users: [], tasks: [] }
      }
      
      // Load data directly from repositories
      const projectRepo = dataSource.getRepository(Project)
      const taskRepo = dataSource.getRepository(Task)
      const userRepo = dataSource.getRepository(User)
      
      // Load specific project if not found in store
      const projectResult = project || await projectRepo.findOne({ 
        where: { id: params.projectId },
        relations: ['members']
      })
      
      // 🎯 XSTATE PATTERN: Always ensure all data is loaded for full app experience when accessing direct project URL
      console.log('[ProjectDetailRoute] Ensuring all data is loaded for full app experience...')
      await Promise.all([
        projectActions.ensureLoaded(),
        userActions.ensureLoaded(),
        taskActions.ensureLoaded(),
        commentActions.ensureLoaded()
      ])
      
      // After ensuring all data is loaded, get fresh data from atoms
      const finalProjects = projectsAtom.get()
      const finalUsers = usersAtom.get()
      const finalTasks = tasksAtom.get()
      
      const finalProject = finalProjects[params.projectId]
      const finalUsersArray = Object.values(finalUsers)
      const finalTasksArray = Object.values(finalTasks).filter(t => t.projectId === params.projectId)
      
      console.log(`[ProjectDetailRoute] Loaded project "${finalProject?.name}" with ${finalTasksArray.length} tasks into XState stores`)
      
      return {
        project: finalProject,
        users: finalUsersArray,
        tasks: finalTasksArray
      }
    } catch (error) {
      console.error('[ProjectDetailRoute] Loader error:', error)
      // Return empty data on error - live queries will handle the retry
      return { project: null, users: [], tasks: [] }
    }
  }
}) 
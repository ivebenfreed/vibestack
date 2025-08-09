import { Hono } from 'hono'
import { logger } from 'hono/logger'
// Remove cors import again
// import { cors } from 'hono/cors' 
import type { ApiEnv } from '../types/api'
// TypeORM-based routes (to be removed)
// import projects from './projects'
// import tasks from './tasks'
// import { entityDependencies, taskDependencies } from './entity-dependencies'
// import users from './users'
// import comments from './comments'
import syncV2Router from './sync-v2'
import replication from './replication'
import { migrations } from './migrations'
// import { db } from './db' // TypeORM-based
import authRouter from './auth'
import { generic } from './generic'
import { HTTPException } from 'hono/http-exception'
import { serverLogger as log } from '../middleware/logger'
import type { AppBindings } from '../types/hono'

// Create API router
const api = new Hono<ApiEnv>()

// Global middleware
api.use('*', logger())

// REMOVE path-specific CORS middleware here - it will be handled in src/index.ts
// api.use('/auth/*', cors({...}))

// Mount routes with proper prefixes
// NOTE: Using generic API for all entity operations now
// Legacy TypeORM routes commented out:
// api.route('/projects', projects)
// api.route('/tasks', tasks)
// api.route('/entity-dependencies', entityDependencies)
// api.route('/task-dependencies', taskDependencies) // Backward compatibility
// api.route('/users', users)
// api.route('/comments', comments)

// Redirect legacy routes to generic API for backward compatibility
api.all('/projects/*', (c) => c.redirect(`/api/generic/projects${c.req.path.replace('/projects', '')}`))
api.all('/tasks/*', (c) => c.redirect(`/api/generic/tasks${c.req.path.replace('/tasks', '')}`))
api.all('/users/*', (c) => c.redirect(`/api/generic/users${c.req.path.replace('/users', '')}`))
api.all('/comments/*', (c) => c.redirect(`/api/generic/comments${c.req.path.replace('/comments', '')}`))

api.route('/sync', syncV2Router)
api.route('/replication', replication)
api.route('/migrations', migrations)
// api.route('/db', db) // TypeORM-based
api.route('/auth', authRouter)
api.route('/generic', generic)

// Basic health check endpoint
api.get('/health', (c) => {
  return c.text('Server OK')
})

export default api
export type ApiType = typeof api 
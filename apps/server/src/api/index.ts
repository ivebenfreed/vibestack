import { Hono } from 'hono'
import { logger } from 'hono/logger'
import type { ApiEnv } from '../types/api'
import { enforceTrialLimits } from '../middleware/trial-limits'
import syncV2Router from './sync-v2'
import replication from './replication'
import { migrations } from './migrations'
import authRouter from './auth'
import organizationsRouter from './organizations'
import { phase1TestRouter } from './phase1-tests.js'
import { universalArchetypeRouter } from '../routes/universal-archetype-api.js'
import { testDbRouter } from '../routes/test-db.js'
import debugTableDataRouter from './debug/table-data'
// Custom organization routes removed - using Better Auth endpoints instead

// Create API router
const api = new Hono<ApiEnv>()

// Global middleware
api.use('*', logger())
api.use('*', enforceTrialLimits)

// REMOVE path-specific CORS middleware here - it will be handled in src/index.ts
// api.use('/auth/*', cors({...}))

// Mount routes with proper prefixes
api.route('/sync', syncV2Router)
api.route('/replication', replication)
api.route('/migrations', migrations)
// api.route('/db', db) // TypeORM-based
api.route('/auth', authRouter)
api.route('/organizations', organizationsRouter)
api.route('/test', phase1TestRouter)
api.route('/archetype', universalArchetypeRouter)
api.route('/db', testDbRouter)
api.route('/debug', debugTableDataRouter)

// Import and mount Kysely-based generic API
import { genericKysely } from './generic-kysely'
api.route('/generic-kysely', genericKysely)
// Replace the old Drizzle generic API with Kysely
api.route('/generic', genericKysely) // Now using Kysely instead of Drizzle

// Basic health check endpoint
api.get('/health', (c) => {
  return c.text('Server OK')
})

export default api
export type ApiType = typeof api 
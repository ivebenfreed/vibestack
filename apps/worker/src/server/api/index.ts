import { OpenAPIHono } from '@hono/zod-openapi'
import { logger } from 'hono/logger'
import type { ApiEnv } from '../types/api'
import { enforceTrialLimits } from '../middleware/trial-limits'
import syncV2Router from './sync-v2'
import replication from './replication'
import authRouter from './auth'
import authOpenAPIRouter from './auth-openapi'
import { phase1TestRouter } from './phase1-tests.js'
import { dataforgeRouter } from '../routes/dataforge-api.js'
import { testDbRouter } from '../routes/test-db.js'
import debugTableDataRouter from './debug/table-data'

// Core business logic APIs (Worlds, Teams)
import teamsOpenAPIRouter from '../routes/teams-api-openapi'
import worldsApi from '../routes/worlds-api-openapi'
import universeApi from '../routes/universe-api-openapi'
// Custom organization routes removed - using Better Auth endpoints instead

// Import existing OpenAPI routers
import publicOpenAPIRouter from './public-openapi'
import organizationsOpenAPIRouter from './organizations-openapi'
import protectedOpenAPIRouter from './protected-openapi'

// Create API router with OpenAPI support
const api = new OpenAPIHono<ApiEnv>()

// Global middleware
api.use('*', logger())
api.use('*', enforceTrialLimits)

// REMOVE path-specific CORS middleware here - it will be handled in src/index.ts
// api.use('/auth/*', cors({...}))

// Mount OpenAPI routers (these will be included in unified documentation)
api.route('/', publicOpenAPIRouter) // Public routes (health, etc.)
// api.route('/', organizationsOpenAPIRouter) // Organization management routes - DISABLED due to UUID validation issue
api.route('/', protectedOpenAPIRouter) // Protected routes
api.route('/dataforge', dataforgeRouter) // DataForge API (already OpenAPI)

// Mount non-OpenAPI routes (these won't appear in unified docs)
api.route('/sync', syncV2Router)
api.route('/replication', replication)
// Legacy migrations route removed - DataForge handles schema operations
// api.route('/db', db) // TypeORM-based
api.route('/auth', authRouter)
api.route('/', authOpenAPIRouter) // Better Auth OpenAPI schema endpoint
api.route('/test', phase1TestRouter)
api.route('/db', testDbRouter)
api.route('/debug', debugTableDataRouter)

// Core business logic API routes
api.route('/teams', teamsOpenAPIRouter) // Now using OpenAPI version
api.route('/worlds', worldsApi)
api.route('/universe', universeApi)

// Import and mount Kysely-based generic API
import { genericKysely } from './generic-kysely'
api.route('/generic-kysely', genericKysely)
// Replace the old Drizzle generic API with Kysely
api.route('/generic', genericKysely) // Now using Kysely instead of Drizzle

// Add a test route directly to verify OpenAPI works
import { createRoute, z } from '@hono/zod-openapi';

const testMainRoute = createRoute({
  method: 'get',
  path: '/test-main',
  tags: ['Test'],
  summary: 'Test endpoint on main API',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
      description: 'Test response',
    },
  },
});

api.openapi(testMainRoute, (c) => {
  return c.json({ message: 'This is from the main API' }, 200);
});

// Doc endpoint configuration moved to end of file

// Note: OpenAPI documentation endpoint is now in public-openapi.ts (no auth required)

// Keep the /doc endpoint for backward compatibility - redirects to /openapi
api.get('/doc', (c) => {
  return c.json({}); // Will be replaced with proper redirect or fetch from /openapi
});

// Swagger UI endpoint for interactive API testing
api.get('/ui', (c) => {
  return c.html(`<!DOCTYPE html>
<html>
<head>
  <title>VibeStack API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/openapi',
      dom_id: '#swagger-ui',
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.presets.standalone
      ],
      layout: "StandaloneLayout"
    })
  </script>
</body>
</html>`)
})

export default api
export type ApiType = typeof api 
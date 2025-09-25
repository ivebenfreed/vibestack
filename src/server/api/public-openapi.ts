import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIEndpoint } from './openapi-generator';
import type { AppContext } from '../types/hono';

/**
 * Public OpenAPI router for endpoints that don't require authentication
 * These endpoints are accessible without any authentication
 */
const publicOpenAPIRouter = new OpenAPIHono<AppContext>();

// Health check endpoint (public)
const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      content: {
        'text/plain': {
          schema: z.string().openapi({ example: 'Server OK' }),
        },
      },
      description: 'Server health status',
    },
  },
  tags: ['Health'],
  summary: 'Check server health',
  description: 'Returns a simple status message indicating the server is running (no authentication required)',
});

publicOpenAPIRouter.openapi(healthRoute, (c) => c.text('Server OK'));

// Test endpoint to demonstrate auto-documentation
const testAutoDocRoute = createRoute({
  method: 'get',
  path: '/test-auto-doc',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().openapi({ 
              example: 'Auto-documentation test successful!',
              description: 'Test message confirming the endpoint works'
            }),
            timestamp: z.string().openapi({
              example: '2025-09-05T14:25:00Z',
              description: 'Current server timestamp'
            }),
            version: z.string().openapi({
              example: '1.0.0',
              description: 'API version'
            }),
            features: z.array(z.string()).openapi({
              example: ['openapi', 'auto-doc', 'unified-schema'],
              description: 'List of enabled features'
            })
          }).openapi({
            description: 'Test response object with comprehensive schema'
          })
        }
      },
      description: 'Successful auto-documentation test response'
    }
  },
  tags: ['Test'],
  summary: 'Test auto-documentation functionality',
  description: 'This endpoint demonstrates that new OpenAPI routes automatically appear in unified documentation without manual configuration'
});

publicOpenAPIRouter.openapi(testAutoDocRoute, (c) => {
  return c.json({
    message: 'Auto-documentation test successful!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: ['openapi', 'auto-doc', 'unified-schema']
  });
});

// Note: All API documentation is now protected and available at /api/doc (requires authentication)

// TODO: Add other public endpoints here as they get converted
// Examples:
// - API documentation endpoint
// - Public organization info
// - Service status endpoints
// - Webhook endpoints
// - Public signup/registration

// Import all OpenAPIHono routers for documentation generation
import teamsOpenAPIRouter from '../routes/teams-api-openapi';
import universeApi from '../routes/universe-api-openapi';
import protectedOpenAPIRouter from './protected-openapi';
// import organizationsOpenAPIRouter from './organizations-openapi'; // Disabled due to UUID validation issue

// OpenAPI documentation endpoint (PUBLIC - no auth required)
// This endpoint generates complete API documentation from all OpenAPIHono routers
publicOpenAPIRouter.get('/openapi', createOpenAPIEndpoint(
  [
    // Public routes (this router)
    { app: publicOpenAPIRouter, basePath: '' },
    // Protected routes
    { app: protectedOpenAPIRouter, basePath: '' },
    // Organization routes - disabled due to UUID validation issue
    // { app: organizationsOpenAPIRouter, basePath: '' },
    // Business logic routes
    { app: teamsOpenAPIRouter, basePath: '/teams' },
    { app: universeApi, basePath: '/universe' },
  ],
  {
    openapi: '3.0.0',
    info: {
      title: 'VibeStack API',
      version: '1.0.0',
      description: 'Comprehensive API documentation for VibeStack - the AI-powered life and work organization platform',
    },
    servers: [
      {
        url: 'http://localhost:4000/api',
        description: 'Development server',
      },
      {
        url: 'https://vibestack.com/api', 
        description: 'Production server',
      },
    ],
  }
));

export default publicOpenAPIRouter;
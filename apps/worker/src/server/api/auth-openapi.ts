import { Hono } from 'hono';
import type { AppBindings } from '../types/hono';
import { getAuth } from '../lib/auth';

/**
 * Creates an endpoint that returns Better Auth's OpenAPI schema
 * This can be integrated with our unified OpenAPI documentation
 */
const authOpenAPIRouter = new Hono<AppBindings>();

// Endpoint to get Better Auth's OpenAPI schema programmatically
authOpenAPIRouter.get('/auth/openapi-schema', async (c) => {
  try {
    // Get the auth instance for this request
    const auth = getAuth(c);
    
    // Generate the OpenAPI schema
    const schema = await auth.api.generateOpenAPISchema();
    
    return c.json(schema);
  } catch (error) {
    console.error('Error generating Better Auth OpenAPI schema:', error);
    return c.json({
      error: 'Failed to generate OpenAPI schema',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default authOpenAPIRouter;
import { OpenAPIHono } from '@hono/zod-openapi';
import { serverLogger } from '../middleware/logger';
import type { AppBindings } from '../types/hono';

const log = serverLogger;

export const mcpRouter = new OpenAPIHono<AppBindings>();

/**
 * MCP Agent Route Handler
 * Handles MCP protocol requests for the VibeStack MCP Agent
 */
mcpRouter.all('/vibestack', async (c) => {
  log.info('MCP request received', { 
    method: c.req.method,
    url: c.req.url,
    headers: c.req.header()
  });

  try {
    // Get the VibeStack MCP Agent Durable Object
    const id = c.env.VIBESTACK_MCP.idFromName('vibestack-mcp-agent');
    const agent = c.env.VIBESTACK_MCP.get(id);

    // Forward the request to the MCP agent
    const response = await agent.fetch(c.req.raw);
    
    log.info('MCP response generated', {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    });

    return response;
  } catch (error) {
    log.error('MCP agent error', error);
    
    return c.json({
      error: 'MCP agent error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * MCP Agent Status Endpoint
 * Simple health check for the MCP agent
 */
mcpRouter.get('/status', async (c) => {
  try {
    log.info('MCP status check requested');
    
    return c.json({
      status: 'ok',
      agent: 'VibeStack MCP Agent',
      version: '1.0.0',
      endpoints: {
        mcp: '/api/mcp/vibestack',
        status: '/api/mcp/status'
      },
      tools: [
        'set_organization',
        'list_organizations', 
        'get_projects',
        'get_teams',
        'get_context'
      ]
    });
  } catch (error) {
    log.error('MCP status check error', error);
    return c.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
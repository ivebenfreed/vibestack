/**
 * Chat API Routes
 * Proxies chat requests to the ChatAgentDO
 */

import { Hono } from 'hono';
import type { AppContext } from '../types/hono';

const app = new Hono<AppContext>();

// Chat endpoint
app.post('/chat', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const { messages, context } = body;

    // Validate context
    if (!context || !context.orgId || !context.route) {
      return c.json({
        error: 'Missing context - orgId and route are required',
      }, 400);
    }

    // Get ChatAgentDO instance (one per user for session continuity)
    const agentId = c.env.CHAT_AGENT.idFromName(`chat-agent-${user.id}`);
    const agent = c.env.CHAT_AGENT.get(agentId);

    // Forward request to DO
    const response = await agent.fetch('https://internal/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        context: {
          ...context,
          userId: user.id,
        },
      }),
    });

    // Return streaming response directly from DO (preserves stream better)
    return response;
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
});

// Status endpoint
app.get('/status', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const agentId = c.env.CHAT_AGENT.idFromName(`chat-agent-${user.id}`);
    const agent = c.env.CHAT_AGENT.get(agentId);

    const response = await agent.fetch('https://internal/status');
    const data = await response.json();

    return c.json(data);
  } catch (error) {
    console.error('[Chat API] Status error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
});

export default app;

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger';

type TestKVEnv = { Bindings: Env };
const testKVRouter = new Hono<TestKVEnv>();

// Test KV operations
testKVRouter.post('/test-kv-session', async (c) => {
  const env = c.env;
  
  if (!env.SESSIONS) {
    return c.json({ error: 'KV namespace SESSIONS not configured' }, 400);
  }

  try {
    // Create a test session
    const sessionId = `test_session_${Date.now()}`;
    const sessionData = {
      id: sessionId,
      userId: '0198b046-c453-72d9-b71a-092e1f75601a', // Alice CEO
      token: `test_token_${Math.random().toString(36).substring(7)}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      organizationId: '01920000-1000-7000-8000-000000000001' // Wide Corp
    };

    // Store in KV with TTL
    const ttl = 7 * 24 * 60 * 60; // 7 days in seconds
    await env.SESSIONS.put(
      `session:${sessionData.token}`,
      JSON.stringify(sessionData),
      { expirationTtl: ttl }
    );

    dbLogger.info('Test session stored in KV', { sessionId, token: sessionData.token }, 'kv-test');

    return c.json({ 
      message: 'Session stored in KV',
      session: sessionData 
    });
  } catch (error) {
    dbLogger.error('Failed to store session in KV', { error }, 'kv-test');
    return c.json({ error: 'Failed to store session in KV' }, 500);
  }
});

testKVRouter.get('/test-kv-session/:token', async (c) => {
  const env = c.env;
  const token = c.req.param('token');
  
  if (!env.SESSIONS) {
    return c.json({ error: 'KV namespace SESSIONS not configured' }, 400);
  }

  try {
    const sessionData = await env.SESSIONS.get(`session:${token}`);
    
    if (!sessionData) {
      return c.json({ error: 'Session not found in KV' }, 404);
    }

    const session = JSON.parse(sessionData);
    dbLogger.info('Session retrieved from KV', { token, session }, 'kv-test');

    return c.json({ 
      message: 'Session retrieved from KV',
      session 
    });
  } catch (error) {
    dbLogger.error('Failed to retrieve session from KV', { error }, 'kv-test');
    return c.json({ error: 'Failed to retrieve session from KV' }, 500);
  }
});

testKVRouter.get('/test-kv-list', async (c) => {
  const env = c.env;
  
  if (!env.SESSIONS) {
    return c.json({ error: 'KV namespace SESSIONS not configured' }, 400);
  }

  try {
    const list = await env.SESSIONS.list({ prefix: 'session:' });
    
    dbLogger.info('KV session list', { count: list.keys.length }, 'kv-test');

    return c.json({ 
      message: 'KV sessions listed',
      count: list.keys.length,
      keys: list.keys
    });
  } catch (error) {
    dbLogger.error('Failed to list sessions from KV', { error }, 'kv-test');
    return c.json({ error: 'Failed to list sessions from KV' }, 500);
  }
});

export { testKVRouter };
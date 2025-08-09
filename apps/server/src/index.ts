import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { compress } from 'hono/compress';
import type { Env } from './types/env';
import { SyncDO } from './sync/SyncDO';
import { ReplicationDO } from './replication/ReplicationDO';

// Import Drizzle-based API routes
import tasksApp from './api/tasks-drizzle';
import projectsApp from './api/projects-drizzle';
import usersApp from './api/users-drizzle';
import commentsApp from './api/comments-drizzle';
import syncApp from './api/sync-drizzle';
import dbApp from './api/db-drizzle';
import authApp from './api/auth';  // Keep using Better Auth

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', compress());
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow all origins in development
      if (process.env.NODE_ENV === 'development') {
        return origin;
      }
      // In production, only allow specific origins
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://vibestack.com',
        'https://app.vibestack.com',
      ];
      return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400,
  })
);

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    drizzle: true,
    typeorm: false
  });
});

// API Routes
app.route('/api/tasks', tasksApp);
app.route('/api/projects', projectsApp);
app.route('/api/users', usersApp);
app.route('/api/comments', commentsApp);
app.route('/api/auth', authApp);
app.route('/api/db', dbApp);
app.route('/api/sync', syncApp);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error(`${err}`);
  return c.json({ error: 'Internal server error' }, 500);
});

// Export Durable Objects
export { SyncDO, ReplicationDO };

export default app;
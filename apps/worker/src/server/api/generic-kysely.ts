/**
 * Generic Kysely API Router
 * 
 * Provides REST endpoints for all entities using Kysely
 * Replaces the Drizzle-based generic API
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ApiEnv } from '../types/api';
import { createErrorResponse, ServiceErrorType } from '../types/api';
import { createDatabaseConnection, getKysely } from '../lib/database-manager';
import { KyselyGenericApiAdapter } from './generic/KyselyGenericApiAdapter';
import { kyselyEntityConfigs, isValidEntity } from './generic/kysely-entity-config';

// Create the generic API router
const genericKysely = new Hono<ApiEnv>();

// Middleware to validate entity name
genericKysely.use('/:entity/*', async (c, next) => {
  const entity = c.req.param('entity');
  
  if (!entity || !isValidEntity(entity)) {
    return c.json(
      createErrorResponse(
        ServiceErrorType.NOT_FOUND,
        `Entity '${entity}' not found`
      ),
      404
    );
  }
  
  await next();
});

// Dynamic route handler for all entities
genericKysely.all('/:entity/*', async (c) => {
  const entity = c.req.param('entity');
  const config = kyselyEntityConfigs[entity];
  
  if (!config) {
    throw new HTTPException(404, { message: `Entity ${entity} not found` });
  }
  
  // Create query service and adapter for this request
  createDatabaseConnection(c.env);
  const kyselyService = getKysely();
  const adapter = new KyselyGenericApiAdapter(
    config.tableName,
    kyselyService,
    config.entityMethods
  );
  
  // Get the path after /api/generic-kysely/:entity
  const path = c.req.path.replace(`/api/generic-kysely/${entity}`, '') || '/';
  
  // Create a new request with the adjusted path for the adapter router
  const request = new Request(c.req.raw);
  Object.defineProperty(request, 'url', {
    value: new URL(path, 'http://localhost').href,
    writable: false
  });
  
  // Let the adapter handle the request
  return adapter.getRouter().fetch(request, c.env, c.executionCtx);
});

export { genericKysely };
/**
 * Generic API Factory
 * 
 * Creates universal API endpoints that work with any entity.
 * Supports both generic CRUD operations and generated business logic.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { ApiEnv } from '../../types/api';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { DrizzleQueryService } from '../../lib/drizzle-query-service';
import { GenericApiAdapter, type GenericApiRequest } from './GenericApiAdapter';

export interface EntityConfig {
  name: string;
  table: PgTable;
  businessMethods?: Record<string, Function>;
}

export interface GenericApiConfig {
  entities: Record<string, EntityConfig>;
}

/**
 * Factory to create generic API endpoints
 */
export class GenericApiFactory {
  private adapters: Map<string, GenericApiAdapter<any>> = new Map();
  
  constructor(private config: GenericApiConfig) {}

  /**
   * Create Hono router with generic endpoints
   */
  createRouter(): Hono<ApiEnv> {
    const router = new Hono<ApiEnv>();

    // Single universal endpoint for all operations
    router.post('/:entity', async (c) => {
      const user = c.get('user');
      if (!user) {
        throw new HTTPException(401, { message: 'Unauthorized' });
      }

      const entityName = c.req.param('entity');
      const requestBody: GenericApiRequest = await c.req.json();

      // Validate entity exists
      if (!this.config.entities[entityName]) {
        return c.json(createErrorResponse(
          'INVALID_ENTITY',
          `Entity '${entityName}' not found`
        ), 400);
      }

      try {
        // Get or create adapter for this entity
        const adapter = this.getAdapter(entityName, c);
        
        // Execute the request
        const result = await adapter.execute({
          ...requestBody,
          entity: entityName
        });

        if (result.success) {
          return c.json(createSuccessResponse(result.data, result.count));
        } else {
          return c.json(createErrorResponse('OPERATION_FAILED', result.error!), 400);
        }
      } catch (error) {
        console.error('[GenericAPI] Operation failed:', error);
        return c.json(createErrorResponse(
          'INTERNAL_ERROR',
          error instanceof Error ? error.message : 'Unknown error'
        ), 500);
      }
    });

    // Convenience GET endpoint for simple queries
    router.get('/:entity', async (c) => {
      const user = c.get('user');
      if (!user) {
        throw new HTTPException(401, { message: 'Unauthorized' });
      }

      const entityName = c.req.param('entity');
      const query = c.req.query();

      if (!this.config.entities[entityName]) {
        return c.json(createErrorResponse(
          'INVALID_ENTITY',
          `Entity '${entityName}' not found`
        ), 400);
      }

      try {
        const adapter = this.getAdapter(entityName, c);
        
        // Convert query parameters to GenericApiRequest
        const request: GenericApiRequest = {
          entity: entityName,
          operation: 'findMany',
          options: {
            filters: this.parseFiltersFromQuery(query),
            sort: this.parseSortFromQuery(query),
            pagination: this.parsePaginationFromQuery(query)
          }
        };

        const result = await adapter.execute(request);

        if (result.success) {
          return c.json(createSuccessResponse(result.data, result.count));
        } else {
          return c.json(createErrorResponse('OPERATION_FAILED', result.error!), 400);
        }
      } catch (error) {
        console.error('[GenericAPI] GET operation failed:', error);
        return c.json(createErrorResponse(
          'INTERNAL_ERROR',
          error instanceof Error ? error.message : 'Unknown error'
        ), 500);
      }
    });

    // GET single entity by ID
    router.get('/:entity/:id', async (c) => {
      const user = c.get('user');
      if (!user) {
        throw new HTTPException(401, { message: 'Unauthorized' });
      }

      const entityName = c.req.param('entity');
      const id = c.req.param('id');

      if (!this.config.entities[entityName]) {
        return c.json(createErrorResponse(
          'INVALID_ENTITY',
          `Entity '${entityName}' not found`
        ), 400);
      }

      try {
        const adapter = this.getAdapter(entityName, c);
        
        const result = await adapter.execute({
          entity: entityName,
          operation: 'findOne',
          id
        });

        if (result.success) {
          return c.json(createSuccessResponse(result.data));
        } else {
          return c.json(createErrorResponse('ENTITY_NOT_FOUND', result.error!), 404);
        }
      } catch (error) {
        console.error('[GenericAPI] GET by ID failed:', error);
        return c.json(createErrorResponse(
          'INTERNAL_ERROR',
          error instanceof Error ? error.message : 'Unknown error'
        ), 500);
      }
    });

    return router;
  }

  /**
   * Get or create adapter for entity
   */
  private getAdapter(entityName: string, c: any): GenericApiAdapter<any> {
    const cacheKey = `${entityName}_${c.get('user')?.id || 'anonymous'}`;
    
    if (!this.adapters.has(cacheKey)) {
      const entityConfig = this.config.entities[entityName];
      const drizzleService = new DrizzleQueryService(c);
      
      const adapter = new GenericApiAdapter(
        drizzleService,
        entityConfig.table,
        entityConfig.businessMethods
      );
      
      this.adapters.set(cacheKey, adapter);
    }
    
    return this.adapters.get(cacheKey)!;
  }

  /**
   * Parse filters from query string
   * Format: ?filter[field][operation]=value
   * Example: ?filter[status][eq]=active&filter[priority][in]=high,medium
   */
  private parseFiltersFromQuery(query: Record<string, any>) {
    const filters = [];
    
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('filter[') && key.includes('][')) {
        const matches = key.match(/filter\[([^\]]+)\]\[([^\]]+)\]/);
        if (matches) {
          const [, field, operation] = matches;
          let parsedValue = value;
          
          // Handle array values for 'in' operation
          if (operation === 'in' && typeof value === 'string') {
            parsedValue = value.split(',');
          }
          
          filters.push({
            field,
            operation,
            value: parsedValue
          });
        }
      }
    }
    
    return filters;
  }

  /**
   * Parse sorting from query string
   * Format: ?sort=field:direction,field2:direction
   * Example: ?sort=updated_at:desc,title:asc
   */
  private parseSortFromQuery(query: Record<string, any>) {
    const sort = [];
    
    if (query.sort) {
      const sortItems = query.sort.split(',');
      for (const item of sortItems) {
        const [field, direction = 'asc'] = item.split(':');
        sort.push({
          field,
          direction: direction === 'desc' ? 'desc' : 'asc'
        });
      }
    }
    
    return sort;
  }

  /**
   * Parse pagination from query string
   * Format: ?limit=20&offset=40
   */
  private parsePaginationFromQuery(query: Record<string, any>) {
    const pagination: any = {};
    
    if (query.limit) {
      pagination.limit = parseInt(query.limit, 10);
    }
    
    if (query.offset) {
      pagination.offset = parseInt(query.offset, 10);
    }
    
    return pagination;
  }
}

/**
 * Convenience function to create a generic API router
 */
export function createGenericAPI(config: GenericApiConfig): Hono<ApiEnv> {
  const factory = new GenericApiFactory(config);
  return factory.createRouter();
}
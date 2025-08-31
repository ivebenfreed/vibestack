/**
 * Kysely Generic API Adapter
 * 
 * Provides a generic REST API for any database table using Kysely.
 * Replaces DrizzleGenericApiAdapter for consistency.
 */

import { Hono, Context } from 'hono';
import type { Kysely } from 'kysely';
// TODO: Replace with server-only types when DataForge is moved  
// import type { Database, TableName } from '@repo/dataforge/kysely-types';
type Database = any;
type TableName = string;
import type { ApiEnv } from '../../types/api';
import {
  ServiceErrorType,
  createSuccessResponse,
  createErrorResponse,
  createPagedResponse,
} from '../../types/api';

export interface KyselyEntityMethods {
  [key: string]: (params: any, db: Kysely<Database>) => Promise<any>;
}

export interface KyselyEntityConfig {
  tableName: TableName;
  entityMethods?: KyselyEntityMethods;
}

export class KyselyGenericApiAdapter {
  private router: Hono<ApiEnv>;
  
  constructor(
    private tableName: TableName,
    private kysely: Kysely<Database>,
    private entityMethods: KyselyEntityMethods = {}
  ) {
    this.router = new Hono<ApiEnv>();
    this.setupRoutes();
  }

  private setupRoutes() {
    // GET / - List with filtering, sorting, and pagination
    this.router.get('/', async (c: Context<ApiEnv>) => {
      return this.handleList(c);
    });

    // GET /:id - Get single record
    this.router.get('/:id', async (c: Context<ApiEnv>) => {
      return this.handleGetById(c);
    });

    // POST / - Create new record
    this.router.post('/', async (c: Context<ApiEnv>) => {
      return this.handleCreate(c);
    });

    // PUT /:id - Update record
    this.router.put('/:id', async (c: Context<ApiEnv>) => {
      return this.handleUpdate(c);
    });

    // DELETE /:id - Delete record
    this.router.delete('/:id', async (c: Context<ApiEnv>) => {
      return this.handleDelete(c);
    });

    // GET /count - Get total count
    this.router.get('/count', async (c: Context<ApiEnv>) => {
      return this.handleCount(c);
    });

    // POST /method/:methodName - Call custom entity method
    this.router.post('/method/:methodName', async (c: Context<ApiEnv>) => {
      return this.handleMethod(c);
    });
  }

  private async handleList(c: Context<ApiEnv>) {
    try {
      const {
        page = '1',
        limit = '50',
        sort = 'created_at',
        order = 'desc',
        ...filters
      } = c.req.query();

      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 100);
      const offset = (pageNum - 1) * limitNum;

      let query = this.kysely
        .selectFrom(this.tableName)
        .selectAll()
        .limit(limitNum)
        .offset(offset);

      // Apply sorting
      const sortColumn = sort as any;
      if (order === 'asc') {
        query = query.orderBy(sortColumn, 'asc');
      } else {
        query = query.orderBy(sortColumn, 'desc');
      }

      // Apply filters
      for (const [key, value] of Object.entries(filters)) {
        if (value) {
          query = query.where(key as any, '=', value);
        }
      }

      const results = await query.execute();

      // Get total count for pagination
      const countResult = await this.kysely
        .selectFrom(this.tableName)
        .select((eb) => eb.fn.count('id').as('count'))
        .executeTakeFirst();

      const total = Number(countResult?.count || 0);

      return c.json(
        createPagedResponse(
          results,
          {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
          }
        )
      );
    } catch (error) {
      console.error(`Error listing ${this.tableName}:`, error);
      return c.json(
        createErrorResponse(ServiceErrorType.INTERNAL, String(error)),
        500
      );
    }
  }

  private async handleGetById(c: Context<ApiEnv>) {
    try {
      const id = c.req.param('id');
      
      const result = await this.kysely
        .selectFrom(this.tableName)
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();

      if (!result) {
        return c.json(
          createErrorResponse(ServiceErrorType.NOT_FOUND, 'Record not found'),
          404
        );
      }

      return c.json(createSuccessResponse(result));
    } catch (error) {
      console.error(`Error getting ${this.tableName} by id:`, error);
      return c.json(
        createErrorResponse(ServiceErrorType.INTERNAL, String(error)),
        500
      );
    }
  }

  private async handleCreate(c: Context<ApiEnv>) {
    try {
      const data = await c.req.json();

      const result = await this.kysely
        .insertInto(this.tableName)
        .values(data)
        .returningAll()
        .executeTakeFirstOrThrow();

      return c.json(createSuccessResponse(result), 201);
    } catch (error) {
      console.error(`Error creating ${this.tableName}:`, error);
      return c.json(
        createErrorResponse(ServiceErrorType.VALIDATION_ERROR, String(error)),
        400
      );
    }
  }

  private async handleUpdate(c: Context<ApiEnv>) {
    try {
      const id = c.req.param('id');
      const data = await c.req.json();

      // Remove id from update data if present
      delete data.id;

      const result = await this.kysely
        .updateTable(this.tableName)
        .set({
          ...data,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      if (!result) {
        return c.json(
          createErrorResponse(ServiceErrorType.NOT_FOUND, 'Record not found'),
          404
        );
      }

      return c.json(createSuccessResponse(result));
    } catch (error) {
      console.error(`Error updating ${this.tableName}:`, error);
      return c.json(
        createErrorResponse(ServiceErrorType.INTERNAL, String(error)),
        500
      );
    }
  }

  private async handleDelete(c: Context<ApiEnv>) {
    try {
      const id = c.req.param('id');

      const result = await this.kysely
        .deleteFrom(this.tableName)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      if (!result) {
        return c.json(
          createErrorResponse(ServiceErrorType.NOT_FOUND, 'Record not found'),
          404
        );
      }

      return c.json(createSuccessResponse({ deleted: true, id }));
    } catch (error) {
      console.error(`Error deleting ${this.tableName}:`, error);
      return c.json(
        createErrorResponse(ServiceErrorType.INTERNAL, String(error)),
        500
      );
    }
  }

  private async handleCount(c: Context<ApiEnv>) {
    try {
      const filters = c.req.query();

      let query = this.kysely
        .selectFrom(this.tableName)
        .select((eb) => eb.fn.count('id').as('count'));

      // Apply filters
      for (const [key, value] of Object.entries(filters)) {
        if (value) {
          query = query.where(key as any, '=', value);
        }
      }

      const result = await query.executeTakeFirst();
      const count = Number(result?.count || 0);

      return c.json(createSuccessResponse({ count }));
    } catch (error) {
      console.error(`Error counting ${this.tableName}:`, error);
      return c.json(
        createErrorResponse(ServiceErrorType.INTERNAL, String(error)),
        500
      );
    }
  }

  private async handleMethod(c: Context<ApiEnv>) {
    try {
      const methodName = c.req.param('methodName');
      const method = this.entityMethods[methodName];

      if (!method) {
        return c.json(
          createErrorResponse(ServiceErrorType.NOT_FOUND, `Method ${methodName} not found`),
          404
        );
      }

      const params = await c.req.json();
      const result = await method(params, this.kysely);

      return c.json(createSuccessResponse(result));
    } catch (error) {
      console.error(`Error calling method ${c.req.param('methodName')}:`, error);
      return c.json(
        createErrorResponse(ServiceErrorType.INTERNAL, String(error)),
        500
      );
    }
  }

  getRouter() {
    return this.router;
  }
}
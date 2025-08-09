/**
 * Generic API Adapter for Universal Entity Operations
 * 
 * Provides a unified interface for CRUD + filtering/sorting/pagination
 * Works with any Drizzle table and supports generated business logic methods.
 */

import { eq, and, or, desc, asc, count, sql } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { DrizzleQueryService } from '../../lib/drizzle-query-service';

// Generic filter operations
export type FilterOperation = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike';

export interface QueryFilter {
  field: string;
  operation: FilterOperation;
  value: any;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface GenericQueryOptions {
  filters?: QueryFilter[];
  sort?: SortOption[];
  pagination?: PaginationOptions;
}

export interface GenericApiRequest {
  entity: string;
  operation: 'findMany' | 'findOne' | 'create' | 'update' | 'delete' | 'count' | 'execute';
  id?: string;
  data?: Record<string, any>;
  options?: GenericQueryOptions;
  // For generated business logic
  method?: string;
  params?: Record<string, any>;
}

export interface GenericApiResponse<T = any> {
  success: boolean;
  data?: T;
  count?: number;
  error?: string;
}

/**
 * Generic adapter that handles standard operations for any entity
 */
export class GenericApiAdapter<T extends Record<string, any>> {
  constructor(
    private drizzleService: DrizzleQueryService,
    private table: PgTable,
    private entityMethods?: Record<string, Function>
  ) {}

  /**
   * Execute any generic API request
   */
  async execute(request: GenericApiRequest): Promise<GenericApiResponse<T | T[]>> {
    try {
      switch (request.operation) {
        case 'findMany':
          return await this.findMany(request.options || {});
        case 'findOne':
          if (!request.id) throw new Error('ID required for findOne operation');
          return await this.findOne(request.id);
        case 'create':
          if (!request.data) throw new Error('Data required for create operation');
          return await this.create(request.data);
        case 'update':
          if (!request.id || !request.data) throw new Error('ID and data required for update operation');
          return await this.update(request.id, request.data);
        case 'delete':
          if (!request.id) throw new Error('ID required for delete operation');
          return await this.delete(request.id);
        case 'count':
          return await this.count(request.options?.filters || []);
        case 'execute':
          return await this.executeBusinessMethod(request.method!, request.params || {});
        default:
          throw new Error(`Unsupported operation: ${request.operation}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Find multiple entities with filtering, sorting, and pagination
   */
  async findMany(options: GenericQueryOptions): Promise<GenericApiResponse<T[]>> {
    let query = this.drizzleService.db.select().from(this.table);
    
    // Apply filters
    if (options.filters && options.filters.length > 0) {
      const whereConditions = this.buildWhereConditions(options.filters);
      query = query.where(whereConditions) as any;
    }
    
    // Apply sorting
    if (options.sort && options.sort.length > 0) {
      const orderBy = options.sort.map(sort => {
        const column = this.getColumn(sort.field);
        return sort.direction === 'desc' ? desc(column) : asc(column);
      });
      query = query.orderBy(...orderBy) as any;
    }
    
    // Apply pagination
    if (options.pagination?.limit) {
      query = query.limit(options.pagination.limit) as any;
    }
    if (options.pagination?.offset) {
      query = query.offset(options.pagination.offset) as any;
    }
    
    const results = await query.execute();
    
    return {
      success: true,
      data: results as T[]
    };
  }

  /**
   * Find single entity by ID
   */
  async findOne(id: string): Promise<GenericApiResponse<T>> {
    const idColumn = this.getColumn('id');
    const result = await this.drizzleService.db
      .select()
      .from(this.table)
      .where(eq(idColumn, id))
      .execute();
      
    if (result.length === 0) {
      return {
        success: false,
        error: 'Entity not found'
      };
    }
    
    return {
      success: true,
      data: result[0] as T
    };
  }

  /**
   * Create new entity
   */
  async create(data: Partial<T>): Promise<GenericApiResponse<T>> {
    // Add timestamps
    const entityData = {
      ...data,
      id: data.id || crypto.randomUUID(),
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await this.drizzleService.db
      .insert(this.table)
      .values(entityData)
      .returning()
      .execute();
      
    return {
      success: true,
      data: result[0] as T
    };
  }

  /**
   * Update existing entity
   */
  async update(id: string, data: Partial<T>): Promise<GenericApiResponse<T>> {
    const idColumn = this.getColumn('id');
    
    // Add updated timestamp
    const updateData = {
      ...data,
      updated_at: new Date()
    };
    
    const result = await this.drizzleService.db
      .update(this.table)
      .set(updateData)
      .where(eq(idColumn, id))
      .returning()
      .execute();
      
    if (result.length === 0) {
      return {
        success: false,
        error: 'Entity not found'
      };
    }
    
    return {
      success: true,
      data: result[0] as T
    };
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<GenericApiResponse<void>> {
    const idColumn = this.getColumn('id');
    
    const result = await this.drizzleService.db
      .delete(this.table)
      .where(eq(idColumn, id))
      .returning()
      .execute();
      
    if (result.length === 0) {
      return {
        success: false,
        error: 'Entity not found'
      };
    }
    
    return {
      success: true
    };
  }

  /**
   * Count entities with optional filters
   */
  async count(filters: QueryFilter[]): Promise<GenericApiResponse<number>> {
    let query = this.drizzleService.db.select({ count: count() }).from(this.table);
    
    if (filters.length > 0) {
      const whereConditions = this.buildWhereConditions(filters);
      query = query.where(whereConditions) as any;
    }
    
    const result = await query.execute();
    
    return {
      success: true,
      count: result[0].count
    };
  }

  /**
   * Execute generated business logic method
   */
  async executeBusinessMethod(method: string, params: Record<string, any>): Promise<GenericApiResponse<any>> {
    if (!this.entityMethods || !this.entityMethods[method]) {
      return {
        success: false,
        error: `Business method '${method}' not found`
      };
    }
    
    try {
      const result = await this.entityMethods[method](params, this.drizzleService);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Business method execution failed'
      };
    }
  }

  /**
   * Build WHERE conditions from filters
   */
  private buildWhereConditions(filters: QueryFilter[]) {
    if (filters.length === 0) return undefined;
    
    const conditions = filters.map(filter => {
      const column = this.getColumn(filter.field);
      
      switch (filter.operation) {
        case 'eq':
          return eq(column, filter.value);
        case 'ne':
          return sql`${column} != ${filter.value}`;
        case 'gt':
          return sql`${column} > ${filter.value}`;
        case 'gte':
          return sql`${column} >= ${filter.value}`;
        case 'lt':
          return sql`${column} < ${filter.value}`;
        case 'lte':
          return sql`${column} <= ${filter.value}`;
        case 'in':
          return sql`${column} = ANY(${filter.value})`;
        case 'like':
          return sql`${column} LIKE ${filter.value}`;
        case 'ilike':
          return sql`${column} ILIKE ${filter.value}`;
        default:
          throw new Error(`Unsupported filter operation: ${filter.operation}`);
      }
    });
    
    return conditions.length === 1 ? conditions[0] : and(...conditions);
  }

  /**
   * Get column from table by field name
   */
  private getColumn(fieldName: string): PgColumn {
    const column = (this.table as any)[fieldName];
    if (!column) {
      throw new Error(`Column '${fieldName}' not found in table`);
    }
    return column;
  }
}
/**
 * Pure reflect-metadata reader for worker compatibility
 * Reads TypeORM decorator metadata without importing TypeORM
 */

import 'reflect-metadata';

// TypeORM metadata keys (copied from TypeORM source)
const METADATA_KEYS = {
  TABLE: 'custom:table_metadata_args',
  COLUMNS: 'custom:columns_metadata_args', 
  RELATIONS: 'custom:relations_metadata_args',
  INDICES: 'custom:indices_metadata_args',
  JOIN_COLUMNS: 'custom:join_columns_metadata_args',
  JOIN_TABLES: 'custom:join_tables_metadata_args'
};

export interface EntityMetadata {
  target: Function;
  name: string;
  tableName: string;
}

export interface ColumnMetadata {
  target: Function;
  propertyName: string;
  options: {
    type?: any;
    primary?: boolean;
    nullable?: boolean;
    unique?: boolean;
    length?: number;
    enum?: any;
    default?: any;
    [key: string]: any;
  };
}

export interface RelationMetadata {
  target: Function;
  propertyName: string;
  relationType: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  type: any;
  inverseSide?: string;
}

export interface JunctionTableMetadata {
  target: Function;
  propertyName: string;
  name: string;
}

/**
 * Worker-compatible metadata reader that reads reflect-metadata directly
 * No TypeORM imports - just reads what decorators stored
 */
export class ReflectMetadataReader {
  private discoveredEntities: Function[] = [];

  /**
   * Register entity classes manually (since we can't scan files in worker)
   */
  registerEntity(entityClass: Function): void {
    if (!this.discoveredEntities.includes(entityClass)) {
      this.discoveredEntities.push(entityClass);
    }
  }

  /**
   * Register multiple entities at once
   */
  registerEntities(entityClasses: Function[]): void {
    entityClasses.forEach(entity => this.registerEntity(entity));
  }

  /**
   * Get all registered entities
   */
  getAllEntities(): EntityMetadata[] {
    return this.discoveredEntities
      .filter(entity => this.hasTableMetadata(entity))
      .map(entity => this.getEntityMetadata(entity));
  }

  /**
   * Check if class has table metadata (is an entity)
   */
  private hasTableMetadata(entityClass: Function): boolean {
    return Reflect.hasMetadata('custom:table', entityClass) ||
           Reflect.hasMetadata(METADATA_KEYS.TABLE, entityClass);
  }

  /**
   * Get entity metadata from reflect metadata
   */
  private getEntityMetadata(entityClass: Function): EntityMetadata {
    // Try different metadata keys that TypeORM might use
    let tableMetadata = Reflect.getMetadata('custom:table', entityClass) ||
                       Reflect.getMetadata(METADATA_KEYS.TABLE, entityClass);
    
    if (!tableMetadata) {
      // Fallback to class name
      tableMetadata = { name: entityClass.name.toLowerCase() };
    }

    return {
      target: entityClass,
      name: entityClass.name,
      tableName: tableMetadata.name || entityClass.name.toLowerCase()
    };
  }

  /**
   * Get columns for an entity
   */
  getColumnsForEntity(entityClass: Function): ColumnMetadata[] {
    const columns: ColumnMetadata[] = [];
    
    // Try different ways TypeORM might store column metadata
    const columnsMetadata = Reflect.getMetadata('custom:columns', entityClass) ||
                           Reflect.getMetadata(METADATA_KEYS.COLUMNS, entityClass);
    
    if (Array.isArray(columnsMetadata)) {
      columns.push(...columnsMetadata.map(col => ({
        target: entityClass,
        propertyName: col.propertyName,
        options: col.options || col
      })));
    }

    // Also check individual property metadata
    const prototype = entityClass.prototype;
    const propertyNames = Object.getOwnPropertyNames(prototype);
    
    for (const propertyName of propertyNames) {
      if (propertyName === 'constructor') continue;
      
      const columnMetadata = Reflect.getMetadata('custom:column', prototype, propertyName);
      if (columnMetadata) {
        columns.push({
          target: entityClass,
          propertyName,
          options: columnMetadata
        });
      }
    }

    return columns;
  }

  /**
   * Get relations for an entity
   */
  getRelationsForEntity(entityClass: Function): RelationMetadata[] {
    const relations: RelationMetadata[] = [];
    
    const relationsMetadata = Reflect.getMetadata('custom:relations', entityClass) ||
                             Reflect.getMetadata(METADATA_KEYS.RELATIONS, entityClass);
    
    if (Array.isArray(relationsMetadata)) {
      relations.push(...relationsMetadata);
    }

    // Check individual property metadata for relations
    const prototype = entityClass.prototype;
    const propertyNames = Object.getOwnPropertyNames(prototype);
    
    for (const propertyName of propertyNames) {
      if (propertyName === 'constructor') continue;
      
      const relationMetadata = Reflect.getMetadata('custom:relation', prototype, propertyName);
      if (relationMetadata) {
        relations.push({
          target: entityClass,
          propertyName,
          relationType: relationMetadata.relationType || 'many-to-one',
          type: relationMetadata.type,
          inverseSide: relationMetadata.inverseSide
        });
      }
    }

    return relations;
  }

  /**
   * Get junction tables (many-to-many relationships)
   */
  getJunctionTables(): JunctionTableMetadata[] {
    const junctionTables: JunctionTableMetadata[] = [];
    
    for (const entity of this.discoveredEntities) {
      const relations = this.getRelationsForEntity(entity);
      
      relations
        .filter(rel => rel.relationType === 'many-to-many')
        .forEach(rel => {
          // Generate junction table name
          const entityName = entity.name.toLowerCase();
          const relatedName = typeof rel.type === 'function' 
            ? rel.type.name.toLowerCase() 
            : String(rel.type).toLowerCase();
          
          junctionTables.push({
            target: entity,
            propertyName: rel.propertyName,
            name: `${entityName}_${relatedName}`
          });
        });
    }
    
    return junctionTables;
  }

  /**
   * Check if entity is server-only
   */
  isServerOnly(entityClass: Function): boolean {
    return Reflect.getMetadata('custom:server-only', entityClass) === true;
  }

  /**
   * Check if entity is client-only  
   */
  isClientOnly(entityClass: Function): boolean {
    return Reflect.getMetadata('custom:client-only', entityClass) === true;
  }

  /**
   * Get table category
   */
  getTableCategory(entityClass: Function): 'domain' | 'system' | 'utility' | undefined {
    return Reflect.getMetadata('custom:table-category', entityClass);
  }

  /**
   * Check if entity is domain table
   */
  isDomainTable(entityClass: Function): boolean {
    return this.getTableCategory(entityClass) === 'domain';
  }

  /**
   * Check if entity is system table
   */
  isSystemTable(entityClass: Function): boolean {
    const category = this.getTableCategory(entityClass);
    return category === 'system' || category === 'utility';
  }

  /**
   * Get client entities
   */
  getClientEntities(): EntityMetadata[] {
    return this.getAllEntities().filter(entity => !this.isServerOnly(entity.target));
  }

  /**
   * Get server entities
   */
  getServerEntities(): EntityMetadata[] {
    return this.getAllEntities().filter(entity => !this.isClientOnly(entity.target));
  }
}
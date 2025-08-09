/**
 * Worker-compatible TypeORM-like decorators
 * Store metadata without full TypeORM dependency
 */

import 'reflect-metadata';
import {
  addTableMetadata,
  addColumnMetadata,
  addRelationMetadata,
  addJoinTableMetadata,
  addJoinColumnMetadata,
  addIndexMetadata,
  type ColumnMetadataArgs,
  type RelationMetadataArgs,
  type JoinTableMetadataArgs,
  type IndexMetadataArgs
} from './worker-typeorm-metadata.js';

// Entity decorator
export function Entity(nameOrOptions?: string | { name?: string; [key: string]: any }) {
  return function (target: Function) {
    const tableName = typeof nameOrOptions === 'string' ? nameOrOptions : nameOrOptions?.name || target.name.toLowerCase();
    
    addTableMetadata({
      target,
      name: tableName,
      type: 'regular'
    });
    
    // Also store in Reflect metadata for compatibility
    Reflect.defineMetadata('custom:table', { name: tableName }, target);
  };
}

// Column decorator
export function Column(options: any = {}) {
  return function (target: any, propertyKey: string) {
    addColumnMetadata({
      target: target.constructor,
      propertyName: propertyKey,
      options
    });
    
    // Store in Reflect metadata
    const existing = Reflect.getMetadata('custom:columns', target.constructor) || [];
    existing.push({ propertyName: propertyKey, options });
    Reflect.defineMetadata('custom:columns', existing, target.constructor);
  };
}

// Primary column decorator
export function PrimaryColumn(options: any = {}) {
  return Column({ ...options, primary: true });
}

// Primary generated column decorator  
export function PrimaryGeneratedColumn(strategy: 'increment' | 'uuid' | 'identity' = 'increment', options: any = {}) {
  return Column({ 
    ...options, 
    primary: true,
    generated: strategy,
    type: strategy === 'uuid' ? 'uuid' : strategy === 'identity' ? 'int' : 'int'
  });
}

// Relation decorators
export function OneToMany(typeFunctionOrTarget: string | ((type?: any) => Function), inverseSide?: string | ((object: any) => any), options?: any) {
  return function (target: any, propertyKey: string) {
    addRelationMetadata({
      target: target.constructor,
      propertyName: propertyKey,
      relationType: 'one-to-many',
      type: typeFunctionOrTarget,
      options,
      inverseSideProperty: typeof inverseSide === 'string' ? inverseSide : undefined
    });
  };
}

export function ManyToOne(typeFunctionOrTarget: string | ((type?: any) => Function), inverseSide?: string | ((object: any) => any), options?: any) {
  return function (target: any, propertyKey: string) {
    addRelationMetadata({
      target: target.constructor,
      propertyName: propertyKey,
      relationType: 'many-to-one',
      type: typeFunctionOrTarget,
      options,
      inverseSideProperty: typeof inverseSide === 'string' ? inverseSide : undefined
    });
  };
}

export function OneToOne(typeFunctionOrTarget: string | ((type?: any) => Function), inverseSide?: string | ((object: any) => any), options?: any) {
  return function (target: any, propertyKey: string) {
    addRelationMetadata({
      target: target.constructor,
      propertyName: propertyKey,
      relationType: 'one-to-one',
      type: typeFunctionOrTarget,
      options,
      inverseSideProperty: typeof inverseSide === 'string' ? inverseSide : undefined
    });
  };
}

export function ManyToMany(typeFunctionOrTarget: string | ((type?: any) => Function), inverseSide?: string | ((object: any) => any), options?: any) {
  return function (target: any, propertyKey: string) {
    addRelationMetadata({
      target: target.constructor,
      propertyName: propertyKey,
      relationType: 'many-to-many',
      type: typeFunctionOrTarget,
      options,
      inverseSideProperty: typeof inverseSide === 'string' ? inverseSide : undefined
    });
  };
}

// Join decorators
export function JoinColumn(options?: { name?: string; referencedColumnName?: string }) {
  return function (target: any, propertyKey: string) {
    addJoinColumnMetadata({
      target: target.constructor,
      propertyName: propertyKey,
      name: options?.name,
      referencedColumnName: options?.referencedColumnName
    });
  };
}

export function JoinTable(options?: { name?: string; joinColumn?: any; inverseJoinColumn?: any }) {
  return function (target: any, propertyKey: string) {
    addJoinTableMetadata({
      target: target.constructor,
      propertyName: propertyKey,
      name: options?.name,
      joinColumns: options?.joinColumn ? [options.joinColumn] : undefined,
      inverseJoinColumns: options?.inverseJoinColumn ? [options.inverseJoinColumn] : undefined
    });
  };
}

// Index decorator
export function Index(nameOrFields?: string | string[], options?: { unique?: boolean; where?: string }) {
  return function (target: Function | any, propertyKey?: string) {
    if (propertyKey) {
      // Property decorator
      addIndexMetadata({
        target: target.constructor,
        name: typeof nameOrFields === 'string' ? nameOrFields : undefined,
        columns: [propertyKey],
        unique: options?.unique,
        where: options?.where
      });
    } else {
      // Class decorator
      addIndexMetadata({
        target,
        name: typeof nameOrFields === 'string' ? nameOrFields : undefined,
        columns: Array.isArray(nameOrFields) ? nameOrFields : [],
        unique: options?.unique,
        where: options?.where
      });
    }
  };
}

// Unique decorator
export function Unique(nameOrFields?: string | string[], fields?: string[]) {
  const finalFields = Array.isArray(nameOrFields) ? nameOrFields : fields || [];
  const finalName = typeof nameOrFields === 'string' ? nameOrFields : undefined;
  
  return function (target: Function) {
    addIndexMetadata({
      target,
      name: finalName,
      columns: finalFields,
      unique: true
    });
  };
}

// Create column decorator
export function CreateDateColumn(options: any = {}) {
  return Column({ 
    ...options, 
    type: 'timestamp',
    createDate: true,
    default: () => 'CURRENT_TIMESTAMP'
  });
}

// Update column decorator
export function UpdateDateColumn(options: any = {}) {
  return Column({ 
    ...options, 
    type: 'timestamp',
    updateDate: true,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP'
  });
}
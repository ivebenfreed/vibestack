/**
 * Entity Context Management for Client/Server Separation
 * 
 * This module provides a robust system for marking entities and properties
 * as client-only, server-only, or shared (default) using MikroORM's metadata system.
 */

import { Entity } from '@mikro-orm/core';
import type { EntityOptions } from '@mikro-orm/core';
import type { EntityMetadata, EntityProperty } from '@mikro-orm/core';

export type EntityContext = 'client-only' | 'server-only' | 'shared';
export type EntityCategory = 'domain' | 'system' | 'auth' | 'junction';

/**
 * Symbol keys for storing metadata
 * Using symbols ensures no conflicts with other metadata
 */
export const ENTITY_CONTEXT_KEY = Symbol('entity:context');
export const PROPERTY_CONTEXT_KEY = Symbol('property:context');
export const ENTITY_CATEGORY_KEY = Symbol('entity:category');

/**
 * Extended entity options with context
 */
export interface ContextualEntityOptions<T = any> extends EntityOptions<T> {
  context?: EntityContext;
}

/**
 * Store for entity-level context metadata
 * WeakMap ensures no memory leaks and automatic cleanup
 */
const entityContextMap = new WeakMap<Function, EntityContext>();
const entityCategoryMap = new WeakMap<Function, EntityCategory>();

/**
 * Store for property-level context metadata  
 * Map of entity -> property -> context
 */
const propertyContextMap = new WeakMap<Function, Map<string, EntityContext>>();

/**
 * Mark an entity with a specific context
 */
export function setEntityContext(target: Function, context: EntityContext): void {
  entityContextMap.set(target, context);
}

/**
 * Get the context for an entity
 */
export function getEntityContext(target: Function): EntityContext {
  return entityContextMap.get(target) || 'shared';
}

/**
 * Mark an entity with a specific category
 */
export function setEntityCategory(target: Function, category: EntityCategory): void {
  entityCategoryMap.set(target, category);
}

/**
 * Get the category for an entity
 */
export function getEntityCategory(target: Function): EntityCategory {
  return entityCategoryMap.get(target) || 'domain';
}

/**
 * Mark a property with a specific context
 */
export function setPropertyContext(target: Function, property: string, context: EntityContext): void {
  let propertyMap = propertyContextMap.get(target);
  if (!propertyMap) {
    propertyMap = new Map();
    propertyContextMap.set(target, propertyMap);
  }
  propertyMap.set(property, context);
}

/**
 * Get the context for a property
 */
export function getPropertyContext(target: Function, property: string): EntityContext {
  const propertyMap = propertyContextMap.get(target);
  return propertyMap?.get(property) || 'shared';
}

/**
 * Decorator: Mark an entity as a client-only system table
 * Client-only system entities are only included in client-side generated code
 * and are marked as system tables for special handling
 * Example: LocalChanges
 */
export function ClientSystemEntity(options?: Omit<ContextualEntityOptions, 'context'>) {
  return function (target: Function) {
    setEntityContext(target, 'client-only');
    setEntityCategory(target, 'system');
    // Also set in the options for MikroORM metadata
    const entityOptions = {
      ...options,
      comment: `context:client-only | category:system${options?.comment ? ` | ${options.comment}` : ''}`
    };
    // Apply the Entity decorator with our extended options
    Entity(entityOptions)(target);
  };
}

/**
 * Decorator: Mark an entity as client-only (domain table)
 * Client-only entities are only included in client-side generated code
 * Example: EntityDependency
 */
export function ClientOnlyEntity(options?: Omit<ContextualEntityOptions, 'context'>) {
  return function (target: Function) {
    setEntityContext(target, 'client-only');
    setEntityCategory(target, 'domain');
    // Also set in the options for MikroORM metadata
    const entityOptions = {
      ...options,
      comment: `context:client-only | category:domain${options?.comment ? ` | ${options.comment}` : ''}`
    };
    // Apply the Entity decorator with our extended options
    Entity(entityOptions)(target);
  };
}

/**
 * Decorator: Mark an entity as a server-only system table
 * Server-only system entities are excluded from client-side code
 * Example: ChangeHistory
 */
export function ServerSystemEntity(options?: Omit<ContextualEntityOptions, 'context'>) {
  return function (target: Function) {
    setEntityContext(target, 'server-only');
    setEntityCategory(target, 'system');
    // Also set in the options for MikroORM metadata
    const entityOptions = {
      ...options,
      comment: `context:server-only | category:system${options?.comment ? ` | ${options.comment}` : ''}`
    };
    // Apply the Entity decorator with our extended options
    Entity(entityOptions)(target);
  };
}

/**
 * Decorator: Mark an entity as server-only (auth/domain table)
 * Server-only entities are excluded from client-side code
 * Example: Account, Session, Verification
 */
export function ServerOnlyEntity(options?: Omit<ContextualEntityOptions, 'context'>) {
  return function (target: Function) {
    setEntityContext(target, 'server-only');
    setEntityCategory(target, 'auth'); // Most server-only are auth tables
    // Also set in the options for MikroORM metadata
    const entityOptions = {
      ...options,
      comment: `context:server-only | category:auth${options?.comment ? ` | ${options.comment}` : ''}`
    };
    // Apply the Entity decorator with our extended options
    Entity(entityOptions)(target);
  };
}

/**
 * Decorator: Mark a property as client-only
 * Client-only properties are excluded from server-side code
 */
export function ClientOnlyProperty() {
  return function (target: any, propertyKey: string) {
    setPropertyContext(target.constructor, propertyKey, 'client-only');
  };
}

/**
 * Decorator: Mark a property as server-only
 * Server-only properties are excluded from client-side code
 * Example: User.sessions, User.accounts
 */
export function ServerOnlyProperty() {
  return function (target: any, propertyKey: string) {
    setPropertyContext(target.constructor, propertyKey, 'server-only');
  };
}

/**
 * Check if an entity should be included in a specific context
 */
export function shouldIncludeEntity(entity: Function, context: 'client' | 'server'): boolean {
  const entityContext = getEntityContext(entity);
  
  if (context === 'client') {
    return entityContext !== 'server-only';
  } else {
    return entityContext !== 'client-only';
  }
}

/**
 * Check if a property should be included in a specific context
 */
export function shouldIncludeProperty(entity: Function, property: string, context: 'client' | 'server'): boolean {
  const propertyContext = getPropertyContext(entity, property);
  
  if (context === 'client') {
    return propertyContext !== 'server-only';
  } else {
    return propertyContext !== 'client-only';
  }
}

/**
 * Extract context from MikroORM metadata comment field
 * This is used for backward compatibility and during metadata extraction
 */
export function extractContextFromComment(comment?: string): EntityContext {
  if (!comment) return 'shared';
  
  if (comment.includes('context:client-only')) {
    return 'client-only';
  } else if (comment.includes('context:server-only')) {
    return 'server-only';
  }
  
  // Legacy format support
  if (comment === 'client-only') {
    return 'client-only';
  } else if (comment === 'server-only') {
    return 'server-only';
  }
  
  return 'shared';
}

/**
 * Extract category from MikroORM metadata comment field
 */
export function extractCategoryFromComment(comment?: string): EntityCategory {
  if (!comment) return 'domain';
  
  if (comment.includes('category:system')) {
    return 'system';
  } else if (comment.includes('category:auth')) {
    return 'auth';
  } else if (comment.includes('category:junction')) {
    return 'junction';
  } else if (comment.includes('category:domain')) {
    return 'domain';
  }
  
  return 'domain';
}

/**
 * Helper to check if an entity is a junction table
 * Junction tables are typically shared between client and server
 */
export function isJunctionTable(metadata: EntityMetadata): boolean {
  const properties = Object.values(metadata.properties);
  const scalarProps = properties.filter(p => p.kind === 'scalar' || p.kind === 'enum');
  const relationProps = properties.filter(p => p.kind === 'm:1' || p.kind === '1:1');
  
  // Junction tables typically have minimal scalar properties and exactly 2 relations
  return scalarProps.length <= 1 && relationProps.length === 2;
}

/**
 * Check if an entity is a client-side system table
 */
export function isClientSystemTable(entity: Function): boolean {
  return getEntityContext(entity) === 'client-only' && getEntityCategory(entity) === 'system';
}

/**
 * Check if an entity is a server-side system table
 */
export function isServerSystemTable(entity: Function): boolean {
  return getEntityContext(entity) === 'server-only' && getEntityCategory(entity) === 'system';
}

/**
 * Export all context-related functions for use in generation scripts
 */
export const EntityContextUtils = {
  setEntityContext,
  getEntityContext,
  setEntityCategory,
  getEntityCategory,
  setPropertyContext,
  getPropertyContext,
  shouldIncludeEntity,
  shouldIncludeProperty,
  extractContextFromComment,
  extractCategoryFromComment,
  isJunctionTable,
  isClientSystemTable,
  isServerSystemTable,
};
/**
 * Domain Registry - Central export for all domain modules
 * This file provides a unified interface for accessing domain atoms and operations
 * Used by VibeGridX for entity-based configuration
 */

import * as taskDomain from './task';
import * as projectDomain from './project';
import * as userDomain from './user';
import * as commentDomain from './comment';
import * as statusDefinitionDomain from './status-definition';
import * as statusSetDomain from './status-set';
import * as tagDomain from './tag';
import * as tagSetDomain from './tag-set';

// Domain module registry - maps entity types to their domain modules
export const DOMAIN_REGISTRY = {
  task: taskDomain,
  project: projectDomain,
  user: userDomain,
  comment: commentDomain,
  statusDefinition: statusDefinitionDomain,
  statusSet: statusSetDomain,
  tag: tagDomain,
  tagSet: tagSetDomain,
} as const;

// Type for domain keys
export type DomainKey = keyof typeof DOMAIN_REGISTRY;

// Helper to get atom from domain
export function getDomainAtom(entityType: DomainKey) {
  const domain = DOMAIN_REGISTRY[entityType];
  if (!domain) return null;
  
  // Convention: atoms are named {entityType}sAtom
  const atomName = `${entityType}sAtom`;
  return (domain as any)[atomName];
}

// Helper to get update function from domain
export function getDomainUpdateFn(entityType: DomainKey) {
  const domain = DOMAIN_REGISTRY[entityType];
  if (!domain) return null;
  
  // Convention: update functions are named update{EntityType}UI
  const updateFnName = `update${entityType.charAt(0).toUpperCase() + entityType.slice(1)}UI`;
  return (domain as any)[updateFnName];
}

// Export all domains for convenience
export * from './task';
export * from './project';
export * from './user';
export * from './comment';
export * from './status-definition';
export * from './status-set';
export * from './tag';
export * from './tag-set';
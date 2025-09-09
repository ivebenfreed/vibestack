/**
 * Belongs To Relationship Field Handler
 * 
 * Handles membership relationships (e.g., task belongs to project)
 * - Can belong to multiple entities
 * - Can change membership
 * - Can inherit from context
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: null, // can belong to multiple projects
    can_change: true,
    required: false,
    unique_per_entity: false,
    validation_message: 'Can belong to multiple projects'
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: null,
    set_on_creation: false,
    inherit_from_parent: true, // Can inherit from context
    ui_behavior: 'contextual' // Show in context of project
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'folder',
    color: '#6B7280'
  };
}

export function getDisplayName(): string {
  return 'Project';
}

export function getDescription(): string {
  return 'Project that contains this entity';
}

export function getCardinality(): string {
  return 'many-to-many';
}

export function getSortOrder(): number {
  return 20; // Medium priority
}
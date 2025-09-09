/**
 * Has Many Relationship Field Handler (One-to-Many Template)
 * 
 * Template for custom one-to-many relationships where one entity owns/contains many targets
 * Examples: Project has many tasks, Department has many employees, Category has many documents
 * - Unlimited target relationships allowed from this entity
 * - Each target belongs exclusively to one source (reverse many-to-one)
 * - Often used for hierarchical or ownership structures
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: null, // unlimited targets (one-to-many)
    can_change: true,
    required: false,
    unique_per_entity: false, // This entity can have many targets
    unique_per_target: true, // Each target belongs to only one source
    validation_message: 'One-to-many relationship: can have multiple targets, each target belongs exclusively here',
    hierarchy_support: true // Supports hierarchical structures
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: null,
    set_on_creation: false,
    inherit_from_parent: false,
    ui_behavior: 'hierarchical_multi_select', // Special UI for parent-child relationships
    create_reverse_relationship: true // Automatically creates "belongs_to" on targets
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'list',
    color: '#8B5CF6'
  };
}

export function getDisplayName(): string {
  return 'Contains';
}

export function getDescription(): string {
  return 'Multiple entities that belong exclusively to this entity (one-to-many)';
}

export function getCardinality(): string {
  return 'one-to-many';
}

export function getSortOrder(): number {
  return 35; // Medium priority - structural relationship
}

export function isSystemProtected(): boolean {
  return false; // Template for custom relationships
}
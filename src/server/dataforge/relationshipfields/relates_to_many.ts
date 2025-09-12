/**
 * Relates To Many Relationship Field Handler (Many-to-Many Template)
 * 
 * Template for custom many-to-many relationships where entities can relate to multiple targets
 * Examples: Tasks ↔ tags, Projects ↔ teams, Documents ↔ categories, Users ↔ skills
 * - Multiple target relationships allowed
 * - Can change relationships freely
 * - Generic template for organizational customization
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: null, // unlimited relationships (many-to-many)
    can_change: true,
    required: false,
    unique_per_entity: false,
    validation_message: 'Multiple target relationships allowed (many-to-many)'
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: null,
    set_on_creation: false,
    inherit_from_parent: true, // Can inherit from context
    ui_behavior: 'multi_select' // Multi-select UI for multiple targets
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'link-2',
    color: '#64748B'
  };
}

export function getDisplayName(): string {
  return 'Related To';
}

export function getDescription(): string {
  return 'Multiple entities that this relates to (many-to-many relationship)';
}

export function getCardinality(): string {
  return 'many-to-many';
}

export function getSortOrder(): number {
  return 50; // Lower priority - custom relationship
}

export function isSystemProtected(): boolean {
  return false; // Template for custom relationships
}
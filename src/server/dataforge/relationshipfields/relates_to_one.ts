/**
 * Relates To One Relationship Field Handler (Many-to-One Template)
 * 
 * Template for custom many-to-one relationships where multiple entities can relate to one target
 * Examples: Many tasks → one milestone, Many documents → one category, Many employees → one department
 * - Only one target relationship allowed per entity
 * - Can change the relationship
 * - Generic template for organizational customization
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 1, // only one target allowed (many-to-one)
    can_change: true,
    required: false,
    unique_per_entity: true,
    validation_message: 'Only one target relationship allowed (many-to-one)'
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: null,
    set_on_creation: false,
    inherit_from_parent: true, // Can inherit from context
    ui_behavior: 'single_select' // Dropdown selection for single target
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'arrow-right',
    color: '#6B7280'
  };
}

export function getDisplayName(): string {
  return 'Relates To';
}

export function getDescription(): string {
  return 'Single entity that this relates to (many-to-one relationship)';
}

export function getCardinality(): string {
  return 'many-to-one';
}

export function getSortOrder(): number {
  return 40; // Lower priority - custom relationship
}

export function isSystemProtected(): boolean {
  return false; // Template for custom relationships
}
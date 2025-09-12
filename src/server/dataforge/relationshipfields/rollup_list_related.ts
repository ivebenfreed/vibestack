/**
 * Rollup List Related Relationship Field Handler
 * 
 * Aggregates list/concatenation of values from related entities through any relationship type
 * Examples: List of assignee names, List of tag names, List of project titles
 * - Read-only calculated field (no direct relationships)  
 * - Auto-updates when relationships or target field values change
 * - Supports custom separators and formatting
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 0, // Read-only, no direct relationships
    can_change: false,
    required: false,
    unique_per_entity: false,
    read_only: true, // Calculated field
    validation_message: 'List field automatically generated from related entity values',
    is_rollup_field: true
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: '',
    set_on_creation: true, // Set initial list
    inherit_from_parent: false,
    ui_behavior: 'read_only_list', // Display as comma-separated list or chips
    rollup_config: {
      operation: 'concat',
      update_triggers: ['relationship_created', 'relationship_deleted', 'target_field_changed'],
      real_time_updates: true,
      separator: ', ', // Default separator
      max_items: null, // No limit on list length
      sort_order: 'alphabetical', // Sort concatenated values
      null_handling: 'ignore' // Ignore null/empty values
    }
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'list-ul',
    color: '#8B5CF6'
  };
}

export function getDisplayName(): string {
  return 'List';
}

export function getDescription(): string {
  return 'List of values from related entities (automatically generated)';
}

export function getCardinality(): string {
  return 'computed'; // Special cardinality for computed fields
}

export function getSortOrder(): number {
  return 62; // Lower priority - computed field
}

export function isSystemProtected(): boolean {
  return false; // Can be added/removed by organizations
}
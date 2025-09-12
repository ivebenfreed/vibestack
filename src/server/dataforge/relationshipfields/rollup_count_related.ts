/**
 * Rollup Count Related Relationship Field Handler
 * 
 * Aggregates count of related entities through any relationship type
 * Examples: Count of assigned tasks, Count of owned projects, Count of dependencies
 * - Read-only calculated field (no direct relationships)
 * - Auto-updates when relationships change
 * - Supports filtering conditions
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 0, // Read-only, no direct relationships
    can_change: false,
    required: false,
    unique_per_entity: false,
    read_only: true, // Calculated field
    validation_message: 'Count field automatically calculated from relationships',
    is_rollup_field: true
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: 0,
    set_on_creation: true, // Set initial count
    inherit_from_parent: false,
    ui_behavior: 'read_only_counter', // Display as read-only count
    rollup_config: {
      operation: 'count',
      update_triggers: ['relationship_created', 'relationship_deleted'],
      real_time_updates: true
    }
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'hash',
    color: '#3B82F6'
  };
}

export function getDisplayName(): string {
  return 'Count';
}

export function getDescription(): string {
  return 'Count of related entities (automatically calculated)';
}

export function getCardinality(): string {
  return 'computed'; // Special cardinality for computed fields
}

export function getSortOrder(): number {
  return 60; // Lower priority - computed field
}

export function isSystemProtected(): boolean {
  return false; // Can be added/removed by organizations
}
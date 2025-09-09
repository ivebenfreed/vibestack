/**
 * Rollup Average Related Relationship Field Handler
 * 
 * Aggregates average of numeric values from related entities through any relationship type
 * Examples: Average task completion time, Average project budget, Average team performance score
 * - Read-only calculated field (no direct relationships)
 * - Auto-updates when relationships or target field values change
 * - Supports precision control and null handling
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 0, // Read-only, no direct relationships
    can_change: false,
    required: false,
    unique_per_entity: false,
    read_only: true, // Calculated field
    validation_message: 'Average field automatically calculated from related entity values',
    is_rollup_field: true
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: 0.00,
    set_on_creation: true, // Set initial average
    inherit_from_parent: false,
    ui_behavior: 'read_only_decimal', // Display as decimal with precision
    rollup_config: {
      operation: 'average',
      update_triggers: ['relationship_created', 'relationship_deleted', 'target_field_changed'],
      real_time_updates: true,
      precision: 2, // Decimal precision for average
      null_handling: 'ignore', // Ignore null values in average calculation
      zero_handling: 'include' // Include zero values in average
    }
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'trending-up',
    color: '#10B981'
  };
}

export function getDisplayName(): string {
  return 'Average';
}

export function getDescription(): string {
  return 'Average of numeric values from related entities (automatically calculated)';
}

export function getCardinality(): string {
  return 'computed'; // Special cardinality for computed fields
}

export function getSortOrder(): number {
  return 63; // Lower priority - computed field
}

export function isSystemProtected(): boolean {
  return false; // Can be added/removed by organizations
}
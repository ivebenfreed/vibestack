/**
 * Rollup Sum Related Relationship Field Handler
 * 
 * Aggregates sum of numeric values from related entities through any relationship type
 * Examples: Sum of task budgets, Sum of project hours, Total revenue from related deals
 * - Read-only calculated field (no direct relationships)
 * - Auto-updates when relationships or target field values change
 * - Supports filtering and precision control
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 0, // Read-only, no direct relationships
    can_change: false,
    required: false,
    unique_per_entity: false,
    read_only: true, // Calculated field
    validation_message: 'Sum field automatically calculated from related entity values',
    is_rollup_field: true
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: 0.00,
    set_on_creation: true, // Set initial sum
    inherit_from_parent: false,
    ui_behavior: 'read_only_currency', // Display as currency/decimal
    rollup_config: {
      operation: 'sum',
      update_triggers: ['relationship_created', 'relationship_deleted', 'target_field_changed'],
      real_time_updates: true,
      precision: 2, // Decimal precision
      null_handling: 'ignore' // Ignore null values in sum
    }
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'calculator',
    color: '#F59E0B'
  };
}

export function getDisplayName(): string {
  return 'Total';
}

export function getDescription(): string {
  return 'Sum of numeric values from related entities (automatically calculated)';
}

export function getCardinality(): string {
  return 'computed'; // Special cardinality for computed fields
}

export function getSortOrder(): number {
  return 61; // Lower priority - computed field
}

export function isSystemProtected(): boolean {
  return false; // Can be added/removed by organizations
}
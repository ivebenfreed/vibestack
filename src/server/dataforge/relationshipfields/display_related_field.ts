/**
 * Display Related Field Relationship Field Handler
 * 
 * Displays specific field values from related entities (like a lookup field)
 * Examples: Show assignee name, Show project title, Show manager email, Show parent task status
 * - Read-only display field (no direct relationships)
 * - Auto-updates when relationships or target field values change
 * - Supports custom formatting and fallback values
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 0, // Read-only, no direct relationships
    can_change: false,
    required: false,
    unique_per_entity: false,
    read_only: true, // Display-only field
    validation_message: 'Display field shows values from related entities',
    is_display_field: true
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: '',
    set_on_creation: true, // Set initial display value
    inherit_from_parent: false,
    ui_behavior: 'read_only_display', // Display as read-only text/chip
    display_config: {
      source_relationship: null, // Which relationship to follow
      source_field: null, // Which field to display from related entity
      update_triggers: ['relationship_created', 'relationship_deleted', 'target_field_changed'],
      real_time_updates: true,
      fallback_value: '—', // Value when no related entity or field is empty
      format_template: '{{value}}', // Template for formatting (e.g., "{{name}} ({{email}})")
      multiple_separator: ', ', // How to join multiple values
      max_display_items: 5 // Limit for many relationships
    }
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'external-link',
    color: '#6366F1'
  };
}

export function getDisplayName(): string {
  return 'Display Field';
}

export function getDescription(): string {
  return 'Shows field values from related entities (automatically updated)';
}

export function getCardinality(): string {
  return 'display'; // Special cardinality for display fields
}

export function getSortOrder(): number {
  return 65; // Lower priority - display field
}

export function isSystemProtected(): boolean {
  return false; // Can be added/removed by organizations
}
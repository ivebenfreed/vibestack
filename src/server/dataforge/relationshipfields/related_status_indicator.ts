/**
 * Related Status Indicator Relationship Field Handler
 * 
 * Displays status indicators from related entities with visual formatting
 * Examples: Show all task statuses, Show approval states, Show dependency status
 * - Read-only status display field with color coding
 * - Auto-updates when relationships or target statuses change
 * - Supports progress bars, status badges, and visual indicators
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 0, // Read-only, no direct relationships
    can_change: false,
    required: false,
    unique_per_entity: false,
    read_only: true, // Display-only field
    validation_message: 'Status indicator field shows visual status from related entities',
    is_status_indicator: true
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: null,
    set_on_creation: true, // Set initial status
    inherit_from_parent: false,
    ui_behavior: 'status_indicator', // Special status indicator UI
    status_config: {
      source_relationship: null, // Which relationship to follow
      status_field: 'status', // Which status field to display
      update_triggers: ['relationship_created', 'relationship_deleted', 'target_status_changed'],
      real_time_updates: true,
      display_mode: 'badges', // badges, progress_bar, traffic_light, simple_text
      status_mapping: {
        'not_started': { color: '#6B7280', icon: 'clock' },
        'active': { color: '#3B82F6', icon: 'play' },
        'done': { color: '#10B981', icon: 'check' },
        'blocked': { color: '#EF4444', icon: 'x' }
      },
      show_counts: true, // Show count of each status
      compact_mode: false, // Whether to use compact display
      max_visible: 10 // Maximum status items to show
    }
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'activity',
    color: '#F59E0B'
  };
}

export function getDisplayName(): string {
  return 'Status Indicator';
}

export function getDescription(): string {
  return 'Visual status indicators from related entities (automatically updated)';
}

export function getCardinality(): string {
  return 'status_display'; // Special cardinality for status fields
}

export function getSortOrder(): number {
  return 66; // Lower priority - display field
}

export function isSystemProtected(): boolean {
  return false; // Can be added/removed by organizations
}
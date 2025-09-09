/**
 * Timeline Related Relationship Field Handler
 * 
 * Displays timeline/chronological information from related entities
 * Examples: Show recent activity on related tasks, Show project milestones, Show approval history
 * - Read-only timeline display field with chronological sorting
 * - Auto-updates when relationships or target entities change
 * - Supports different timeline views and date filtering
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 0, // Read-only, no direct relationships
    can_change: false,
    required: false,
    unique_per_entity: false,
    read_only: true, // Display-only field
    validation_message: 'Timeline field shows chronological information from related entities',
    is_timeline_field: true
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: [],
    set_on_creation: true, // Set initial timeline
    inherit_from_parent: false,
    ui_behavior: 'timeline_display', // Special timeline UI component
    timeline_config: {
      source_relationship: null, // Which relationship to follow
      date_field: 'updated_at', // Which date field to use for sorting
      display_field: 'name', // Primary field to display in timeline
      description_field: 'description', // Secondary field for details
      update_triggers: ['relationship_created', 'relationship_deleted', 'target_any_field_changed'],
      real_time_updates: true,
      sort_order: 'desc', // Most recent first
      date_range: {
        show_past_days: 30, // Show last 30 days by default
        show_future_days: 7, // Show next 7 days
        enable_date_filter: true // Allow users to filter date range
      },
      display_options: {
        show_relative_dates: true, // "2 hours ago" vs "2:30 PM"
        show_entity_types: true, // Show what type of entity
        show_status_indicators: true, // Show status colors/icons
        group_by_date: true, // Group items by day
        max_items: 20, // Limit number of items shown
        enable_expand_all: true // Allow expanding to see all items
      }
    }
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'clock',
    color: '#059669'
  };
}

export function getDisplayName(): string {
  return 'Timeline';
}

export function getDescription(): string {
  return 'Chronological timeline of related entity activity (automatically updated)';
}

export function getCardinality(): string {
  return 'timeline_display'; // Special cardinality for timeline fields
}

export function getSortOrder(): number {
  return 68; // Lower priority - display field
}

export function isSystemProtected(): boolean {
  return false; // Can be added/removed by organizations
}
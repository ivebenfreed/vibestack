/**
 * Smart Reference Display Relationship Field Handler
 * 
 * Intelligent display of related entities with smart formatting and navigation
 * Examples: Show "John Doe (CEO)", Show "Project Alpha - 75% Complete", Show "High Priority - Due Tomorrow"
 * - Read-only smart display field with contextual information
 * - Auto-selects best fields to display from related entities
 * - Supports click-through navigation and hover previews
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 0, // Read-only, no direct relationships
    can_change: false,
    required: false,
    unique_per_entity: false,
    read_only: true, // Display-only field
    validation_message: 'Smart display field shows contextual information from related entities',
    is_smart_display: true
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: null,
    set_on_creation: true, // Set initial display
    inherit_from_parent: false,
    ui_behavior: 'smart_reference_display', // Smart display with navigation
    smart_config: {
      source_relationship: null, // Which relationship to follow
      update_triggers: ['relationship_created', 'relationship_deleted', 'target_any_field_changed'],
      real_time_updates: true,
      auto_format: true, // Automatically choose best format
      primary_field: 'name', // Primary field to display (fallback to title, label)
      secondary_field: 'status', // Secondary contextual field
      tertiary_field: null, // Optional third field
      template_modes: {
        'single': '{{primary}} ({{secondary}})', // For single relationship
        'multiple': '{{primary}}', // For multiple relationships
        'compact': '{{primary}}'  // For compact display mode
      },
      navigation: {
        enable_click_through: true, // Click to navigate to related entity
        enable_hover_preview: true, // Show preview on hover
        open_in_new_tab: false // Whether to open in new tab/modal
      },
      visual_enhancements: {
        show_entity_icons: true, // Show entity type icons
        show_status_colors: true, // Use status colors
        show_priority_indicators: true, // Show priority badges
        truncate_long_text: true, // Truncate long text with ellipsis
        max_text_length: 50
      }
    }
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'zap',
    color: '#8B5CF6'
  };
}

export function getDisplayName(): string {
  return 'Smart Reference';
}

export function getDescription(): string {
  return 'Intelligent display of related entities with contextual information and navigation';
}

export function getCardinality(): string {
  return 'smart_display'; // Special cardinality for smart display fields
}

export function getSortOrder(): number {
  return 67; // Lower priority - display field
}

export function isSystemProtected(): boolean {
  return false; // Can be added/removed by organizations
}
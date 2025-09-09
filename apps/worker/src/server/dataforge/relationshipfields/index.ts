/**
 * Relationship Field Registry
 * 
 * Auto-discovery and registration of relationship field handlers.
 * Similar to the fields/ folder pattern for automatic registration.
 */

import * as assigned_to from './assigned_to';
import * as owned_by from './owned_by';
import * as created_by from './created_by';
import * as subtask_of from './subtask_of';
import * as belongs_to from './belongs_to';
import * as requires_approval_from from './requires_approval_from';
import * as depends_on from './depends_on';
import * as relates_to_one from './relates_to_one';
import * as relates_to_many from './relates_to_many';
import * as has_one from './has_one';
import * as has_many from './has_many';
import * as rollup_count_related from './rollup_count_related';
import * as rollup_sum_related from './rollup_sum_related';
import * as rollup_list_related from './rollup_list_related';
import * as rollup_average_related from './rollup_average_related';
import * as display_related_field from './display_related_field';
import * as related_status_indicator from './related_status_indicator';
import * as smart_reference_display from './smart_reference_display';
import * as timeline_related from './timeline_related';

export interface RelationshipFieldHandler {
  getValidationRules(): Record<string, any>;
  getDefaultBehavior(): Record<string, any>;
  getDefaultUIConfig(): Record<string, any>;
  getDisplayName(): string;
  getDescription(): string;
  getCardinality(): string;
  getSortOrder(): number;
  isSystemProtected?(): boolean;
}

// Registry of relationship field handlers
const relationshipFieldHandlers: Record<string, RelationshipFieldHandler> = {
  // System/archetype relationship types
  'assigned_to': assigned_to,
  'owned_by': owned_by,
  'created_by': created_by,
  'subtask_of': subtask_of,
  'belongs_to': belongs_to,
  
  // Workflow relationship types
  'requires_approval_from': requires_approval_from,
  'depends_on': depends_on,
  
  // Custom relationship templates by cardinality
  'relates_to_one': relates_to_one,      // Many-to-one template
  'relates_to_many': relates_to_many,    // Many-to-many template
  'has_one': has_one,                    // One-to-one template
  'has_many': has_many,                  // One-to-many template
  
  // Rollup/aggregation relationship fields
  'rollup_count_related': rollup_count_related,     // Count of related entities
  'rollup_sum_related': rollup_sum_related,         // Sum of related numeric values
  'rollup_list_related': rollup_list_related,       // List/concat of related values
  'rollup_average_related': rollup_average_related, // Average of related numeric values
  
  // Advanced display relationship fields
  'display_related_field': display_related_field,         // Show specific field from related entities
  'related_status_indicator': related_status_indicator,   // Visual status indicators from related entities
  'smart_reference_display': smart_reference_display,     // Smart contextual display with navigation
  'timeline_related': timeline_related                    // Chronological timeline of related activity
};

/**
 * Get relationship field handler by relationship type
 */
export function getRelationshipFieldHandler(relationshipType: string): RelationshipFieldHandler | null {
  return relationshipFieldHandlers[relationshipType] || null;
}

/**
 * Get all available relationship types
 */
export function getAvailableRelationshipTypes(): string[] {
  return Object.keys(relationshipFieldHandlers);
}

/**
 * Check if a relationship type is registered
 */
export function isRelationshipTypeRegistered(relationshipType: string): boolean {
  return relationshipType in relationshipFieldHandlers;
}

/**
 * Get relationship field configuration using handler
 */
export function getRelationshipFieldConfig(relationshipType: string): {
  validation_rules: Record<string, any>;
  default_behavior: Record<string, any>;
  ui_config: Record<string, any>;
  display_name: string;
  description: string;
  cardinality: string;
  sort_order: number;
  system_protected: boolean;
} | null {
  const handler = getRelationshipFieldHandler(relationshipType);
  if (!handler) return null;

  return {
    validation_rules: handler.getValidationRules(),
    default_behavior: handler.getDefaultBehavior(),
    ui_config: handler.getDefaultUIConfig(),
    display_name: handler.getDisplayName(),
    description: handler.getDescription(),
    cardinality: handler.getCardinality(),
    sort_order: handler.getSortOrder(),
    system_protected: handler.isSystemProtected?.() || false
  };
}
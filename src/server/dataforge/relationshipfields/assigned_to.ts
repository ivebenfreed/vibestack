/**
 * Assigned To Relationship Field Handler
 * 
 * Handles assignment relationships (e.g., task assignee, project member)
 * - Multiple assignees allowed
 * - Can change assignments
 * - No default assignment (must be explicitly set)
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: null, // unlimited assignees
    can_change: true,
    required: false,
    unique_per_entity: false,
    validation_message: 'Multiple assignees allowed'
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: null,
    set_on_creation: false,
    inherit_from_parent: false,
    ui_behavior: 'required_select' // Show dropdown, no default
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'user-check',
    color: '#3B82F6'
  };
}

export function getDisplayName(): string {
  return 'Assignee';
}

export function getDescription(): string {
  return 'Person responsible for completing this task';
}

export function getCardinality(): string {
  return 'many-to-many';
}

export function getSortOrder(): number {
  return 1; // High priority - show first
}
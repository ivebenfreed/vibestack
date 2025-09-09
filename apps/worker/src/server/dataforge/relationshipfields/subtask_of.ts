/**
 * Subtask Of Relationship Field Handler
 * 
 * Handles hierarchical parent-child relationships (e.g., task hierarchy)
 * - Only one parent allowed
 * - Can change parent
 * - Prevents circular dependencies
 * - Can inherit from URL context
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 1,
    can_change: true,
    required: false,
    unique_per_entity: true,
    prevent_circular: true, // Prevent circular parent-child relationships
    validation_message: 'Task can have only one parent'
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: null,
    set_on_creation: false,
    inherit_from_parent: true, // Can inherit from context (e.g., URL)
    ui_behavior: 'contextual' // Show if creating from parent context
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'git-branch',
    color: '#8B5CF6'
  };
}

export function getDisplayName(): string {
  return 'Parent Task';
}

export function getDescription(): string {
  return 'Parent task that this task belongs to';
}

export function getCardinality(): string {
  return 'many-to-one';
}

export function getSortOrder(): number {
  return 10; // Medium priority
}
/**
 * Depends On Relationship Field Handler
 * 
 * Handles dependency relationships for project management (e.g., task depends on other task)
 * - Multiple dependencies allowed
 * - Can change dependencies
 * - Prevents circular dependencies
 * - Supports 4 classic dependency types: finish-to-start, start-to-start, finish-to-finish, start-to-finish
 * - Only for temporal entities: Project, Task, Activity
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: null, // unlimited dependencies
    can_change: true,
    required: false,
    unique_per_entity: false,
    prevent_circular: true, // Critical: prevent circular dependencies
    validation_message: 'Multiple dependencies allowed, circular dependencies prevented',
    entity_type_restriction: ['Project', 'Task', 'Activity'] // Only temporal entities
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: null,
    set_on_creation: false,
    inherit_from_parent: false,
    ui_behavior: 'gantt_dependency' // Special Gantt chart dependency UI
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'git-branch',
    color: '#6366F1'
  };
}

export function getDisplayName(): string {
  return 'Depends On';
}

export function getDescription(): string {
  return 'Other tasks or projects that must complete before this can start';
}

export function getCardinality(): string {
  return 'many-to-many';
}

export function getSortOrder(): number {
  return 25; // Medium priority - project management field
}

export function isSystemProtected(): boolean {
  return false; // Dependencies are configurable per organization and project
}
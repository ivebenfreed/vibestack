/**
 * Has One Relationship Field Handler (One-to-One Template)
 * 
 * Template for custom one-to-one relationships where each entity has exactly one target
 * Examples: User ↔ profile, Project ↔ budget, Document ↔ primary version, Task ↔ result
 * - Only one target relationship allowed
 * - Bidirectional uniqueness (each target can only belong to one source)
 * - Often required for business integrity
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 1, // only one target allowed (one-to-one)
    can_change: true,
    required: true, // Often required for business integrity
    unique_per_entity: true,
    unique_per_target: true, // Each target can only belong to one source (bidirectional uniqueness)
    validation_message: 'One-to-one relationship: each entity has exactly one target'
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: null,
    set_on_creation: true, // Usually set during creation
    inherit_from_parent: false,
    ui_behavior: 'single_required_select' // Required single selection
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'minus',
    color: '#10B981'
  };
}

export function getDisplayName(): string {
  return 'Has One';
}

export function getDescription(): string {
  return 'Single exclusive entity relationship (one-to-one)';
}

export function getCardinality(): string {
  return 'one-to-one';
}

export function getSortOrder(): number {
  return 15; // Higher priority - often required
}

export function isSystemProtected(): boolean {
  return false; // Template for custom relationships
}
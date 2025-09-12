/**
 * Owned By Relationship Field Handler
 * 
 * Handles ownership relationships (e.g., project owner, document owner)
 * - Only one owner allowed
 * - Can change ownership (transferable)
 * - Defaults to current user on creation
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 1, // only one owner
    can_change: true, // ownership can be transferred
    required: false,
    unique_per_entity: true,
    validation_message: 'Each entity can have only one owner'
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: 'current_user', // defaults to current user
    set_on_creation: true,
    inherit_from_parent: false,
    ui_behavior: 'optional' // Show in forms with current user default
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'crown',
    color: '#FBBF24'
  };
}

export function getDisplayName(): string {
  return 'Owner';
}

export function getDescription(): string {
  return 'Person who owns and manages this entity';
}

export function getCardinality(): string {
  return 'many-to-one';
}

export function getSortOrder(): number {
  return 1; // High priority - show first
}
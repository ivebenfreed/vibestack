/**
 * Created By Relationship Field Handler
 * 
 * Handles creator/author relationships (audit trail)
 * - Only one creator
 * - CANNOT change creator (immutable)
 * - Auto-assigned to current user on creation
 * - System protected field
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: 1,
    can_change: false, // 🔒 Cannot switch creator
    required: true,
    unique_per_entity: true,
    immutable: true, // Cannot be changed after creation
    validation_message: 'Creator cannot be changed after creation'
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: true, // Automatically set to current user
    default_value: 'current_user',
    set_on_creation: true,
    inherit_from_parent: false,
    ui_behavior: 'hidden' // Don't show in forms - auto-populated
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'user-plus',
    color: '#10B981'
  };
}

export function getDisplayName(): string {
  return 'Creator';
}

export function getDescription(): string {
  return 'User who created this entity (audit trail)';
}

export function getCardinality(): string {
  return 'many-to-one';
}

export function getSortOrder(): number {
  return 90; // Low priority - show last (audit info)
}

export function isSystemProtected(): boolean {
  return true; // 🔒 System protected - cannot be deleted
}
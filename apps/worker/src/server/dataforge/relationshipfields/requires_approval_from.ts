/**
 * Requires Approval From Relationship Field Handler
 * 
 * Handles approval workflow relationships (e.g., task requires approval from manager)
 * - Multiple approvals allowed (parallel approval process)
 * - Can change approval requirements
 * - Supports approval workflow states and deadline tracking
 */

import type { RelationshipFieldDefinition } from '../types';

export function getValidationRules(): Record<string, any> {
  return {
    max_relationships: null, // unlimited approvers (parallel approvals)
    can_change: true,
    required: false,
    unique_per_entity: false,
    validation_message: 'Multiple approvers allowed for parallel approval workflows'
  };
}

export function getDefaultBehavior(): Record<string, any> {
  return {
    auto_assign_creator: false,
    default_value: null,
    set_on_creation: false,
    inherit_from_parent: false,
    ui_behavior: 'workflow' // Special workflow UI for approval management
  };
}

export function getDefaultUIConfig(): Record<string, any> {
  return {
    icon: 'check-circle',
    color: '#F59E0B'
  };
}

export function getDisplayName(): string {
  return 'Requires Approval';
}

export function getDescription(): string {
  return 'User who must approve this entity before it can proceed';
}

export function getCardinality(): string {
  return 'many-to-many';
}

export function getSortOrder(): number {
  return 30; // Medium priority - workflow field
}

export function isSystemProtected(): boolean {
  return false; // Approval workflows are configurable per organization
}
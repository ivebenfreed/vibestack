/**
 * Universal Systems - Index Exports
 * 
 * Adapted from archived DataForge for server-only Kysely implementation.
 * Provides comprehensive universal systems for labels and options that can be applied to any entity type.
 * 
 * ## Universal Labeling System
 * - **Label**: Hierarchical labels with color/icon metadata for categorization
 * - **LabelAssignment**: Polymorphic labeling system for any entity type
 * 
 * ## Universal Options System  
 * - **Option**: Flexible configuration options with type validation and conditional logic
 * - **OptionSet**: Grouped options with cross-validation rules and UI schemas
 * - **OptionValue**: Polymorphic value storage with inheritance and type safety
 * 
 * ## Key Features
 * - **Polymorphic Design**: Works with any entity type (projects, tasks, users, etc.)
 * - **Type Safety**: Comprehensive validation and type checking
 * - **Hierarchical Support**: Labels can have parent/child relationships
 * - **Inheritance**: Option values can be inherited from parent entities
 * - **Conditional Logic**: Options can show/hide/require based on other values
 * - **Expiration**: Both labels and option values support expiration dates
 * - **Audit Trail**: Full tracking of who set values and when
 * - **Bulk Operations**: Efficient handling of multiple assignments/values
 * 
 * ## Usage Examples
 * 
 * ### Labels
 * ```typescript
 * // Create hierarchical project labels
 * const urgentLabel = new Label({
 *   name: 'urgent',
 *   display_name: 'Urgent',
 *   color: '#ff0000',
 *   icon: 'alert-circle',
 *   category: 'priority'
 * });
 * 
 * // Assign label to project
 * const assignment = new LabelAssignment({
 *   label_id: urgentLabel.id,
 *   target_entity_type: 'project',
 *   target_entity_id: 'project-123',
 *   assigned_by_id: 'user-456'
 * });
 * ```
 * 
 * ### Options
 * ```typescript
 * // Create option with validation
 * const budgetOption = new Option({
 *   key: 'project_budget',
 *   display_name: 'Project Budget',
 *   value_type: 'number',
 *   validation_rules: [
 *     { type: 'min', value: 0, message: 'Budget must be positive' }
 *   ]
 * });
 * 
 * // Set option value for project
 * const value = new OptionValue({
 *   option_id: budgetOption.id,
 *   target_entity_type: 'project',
 *   target_entity_id: 'project-123',
 *   value: 50000,
 *   value_type: 'number'
 * });
 * ```
 * 
 * ### Option Sets with Conditional Logic
 * ```typescript
 * // Create option set with conditional rules
 * const projectSettings = new OptionSet({
 *   name: 'project_configuration',
 *   display_name: 'Project Configuration',
 *   conditional_rules: [
 *     {
 *       condition: { field: 'project_type', operator: 'equals', value: 'research' },
 *       actions: [
 *         { type: 'require_options', targets: ['ethics_approval'] }
 *       ]
 *     }
 *   ]
 * });
 * ```
 */

// Entity exports
export { Label, type LabelFields } from './Label';
export { LabelAssignment, LabelAssignmentUtilities, type LabelAssignmentFields } from './LabelAssignment';
export { Option, OptionUtilities, type OptionFields, type OptionValueType, type OptionValidationRule, type OptionConditionalLogic } from './Option';
export { OptionSet, type OptionSetFields, type OptionSetValidationRule, type OptionSetConditionalRule } from './OptionSet';
export { OptionValue, OptionValueUtilities, type OptionValueFields } from './OptionValue';

// System Option Set exports
export { 
  StatusOptionSet, 
  PriorityOptionSet, 
  CategoryOptionSet, 
  DiscussionTypeOptionSet,
  SystemOptionSetFactory,
  type StatusOptionFields,
  type StatusOptionMetadata,
  type PriorityOptionFields,
  type PriorityOptionMetadata,
  type CategoryOptionFields,
  type CategoryOptionMetadata,
  type DiscussionTypeOptionFields,
  type DiscussionTypeOptionMetadata
} from './SystemOptionSets';

// Note: Utilities are exported directly with their respective classes
// Access them as: LabelAssignmentUtilities, OptionUtilities, OptionValueUtilities, SystemOptionSetFactory

// Common types and interfaces
export interface UniversalSystemStats {
  labels: {
    total: number;
    active: number;
    hierarchical: number;
    categories: Record<string, number>;
  };
  labelAssignments: {
    total: number;
    active: number;
    byEntityType: Record<string, number>;
    systemAssignments: number;
    manualAssignments: number;
  };
  options: {
    total: number;
    byValueType: Record<string, number>;
    withValidation: number;
    withConditionalLogic: number;
  };
  optionSets: {
    total: number;
    withValidationRules: number;
    withConditionalRules: number;
  };
  optionValues: {
    total: number;
    active: number;
    inherited: number;
    explicit: number;
    byValueType: Record<string, number>;
  };
}

// Validation interfaces
export interface UniversalSystemValidation {
  validateLabel(data: Partial<LabelFields>): { valid: boolean; errors: string[] };
  validateLabelAssignment(data: Partial<LabelAssignmentFields>): { valid: boolean; errors: string[] };
  validateOption(data: Partial<OptionFields>): { valid: boolean; errors: string[] };
  validateOptionSet(data: Partial<OptionSetFields>): { valid: boolean; errors: string[] };
  validateOptionValue(data: Partial<OptionValueFields>): { valid: boolean; errors: string[] };
}

// Entity type constants
export const UNIVERSAL_ENTITY_TYPES = {
  LABEL: 'label',
  LABEL_ASSIGNMENT: 'label_assignment', 
  OPTION: 'option',
  OPTION_SET: 'option_set',
  OPTION_VALUE: 'option_value'
} as const;

// Common validation constants
export const SUPPORTED_VALUE_TYPES: OptionValueType[] = [
  'string', 'number', 'boolean', 'date', 'datetime', 'json',
  'enum', 'multi_enum', 'email', 'url', 'color', 'file', 'reference'
];

export const LABEL_CATEGORIES = [
  'priority', 'status', 'type', 'department', 'team', 'project',
  'skill', 'technology', 'industry', 'custom'
] as const;

export const OPTION_SET_TYPES = [
  'group', 'section', 'wizard_step', 'schema', 'template'
] as const;

export const SYSTEM_OPTION_SET_TYPES = [
  'status_system', 'priority_system', 'category_system', 'discussion_type_system'
] as const;

// DDL generation helper
export function generateUniversalSystemDDL(): string[] {
  return [
    Label.getLabelDDL(),
    LabelAssignment.getLabelAssignmentDDL(),
    Option.getOptionDDL(),
    OptionSet.getOptionSetDDL(),
    OptionValue.getOptionValueDDL()
  ];
}

// Index generation helper
export function generateUniversalSystemIndexes(): string[] {
  return [
    ...Label.getLabelIndexes(),
    ...LabelAssignment.getLabelAssignmentIndexes(),
    ...Option.getOptionIndexes(),
    ...OptionSet.getOptionSetIndexes(),
    ...OptionValue.getOptionValueIndexes()
  ];
}

// Schema generation helper for Kysely
export function getUniversalSystemSchemas() {
  return {
    label: Label.getKyselySchema(),
    label_assignment: LabelAssignment.getKyselySchema(),
    option: Option.getKyselySchema(),
    option_set: OptionSet.getKyselySchema(),
    option_value: OptionValue.getKyselySchema()
  };
}

// Type guards for runtime type checking
export function isLabel(entity: any): entity is Label {
  return entity?.archetype === 'label';
}

export function isLabelAssignment(entity: any): entity is LabelAssignment {
  return entity?.archetype === 'label_assignment';
}

export function isOption(entity: any): entity is Option {
  return entity?.archetype === 'option';
}

export function isOptionSet(entity: any): entity is OptionSet {
  return entity?.archetype === 'option_set';
}

export function isOptionValue(entity: any): entity is OptionValue {
  return entity?.archetype === 'option_value';
}

// Type guards for system option sets
export function isStatusOptionSet(entity: any): entity is StatusOptionSet {
  return entity?.set_type === 'status_system';
}

export function isPriorityOptionSet(entity: any): entity is PriorityOptionSet {
  return entity?.set_type === 'priority_system';
}

export function isCategoryOptionSet(entity: any): entity is CategoryOptionSet {
  return entity?.set_type === 'category_system';
}

export function isDiscussionTypeOptionSet(entity: any): entity is DiscussionTypeOptionSet {
  return entity?.set_type === 'discussion_type_system';
}

// All exports are available as named exports above
// No default export to avoid circular dependency issues
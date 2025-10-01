/**
 * Visual Configuration for Entity Studio
 * Colors, styles, and visual constants for node graph rendering
 */

/**
 * Archetype color mapping using CSS variables for theme compatibility
 */
export const archetypeColors: Record<string, string> = {
  project: '#3b82f6',      // Blue
  task: '#22c55e',         // Green
  record: '#6b7280',       // Gray
  document: '#8b5cf6',     // Purple
  file: '#f59e0b',         // Orange
  activity: '#06b6d4',     // Cyan
  discussion: '#ec4899',   // Pink
  collection: '#6366f1',   // Indigo
  other: '#94a3b8'         // Slate
}

/**
 * Relationship type styling
 */
export const relationshipStyles: Record<string, {
  color: string
  strokeWidth: number
  strokeDasharray?: string
  label: string
}> = {
  // Ownership relationships
  belongs_to: {
    color: '#3b82f6',
    strokeWidth: 2,
    label: 'belongs to'
  },
  owned_by: {
    color: '#3b82f6',
    strokeWidth: 2,
    label: 'owned by'
  },
  child_of: {
    color: '#3b82f6',
    strokeWidth: 2,
    label: 'child of'
  },

  // Assignment relationships
  assigned_to: {
    color: '#22c55e',
    strokeWidth: 2,
    label: 'assigned to'
  },
  created_by: {
    color: '#22c55e',
    strokeWidth: 1.5,
    strokeDasharray: '5,5',
    label: 'created by'
  },

  // Dependency relationships
  depends_on: {
    color: '#f59e0b',
    strokeWidth: 2,
    strokeDasharray: '8,4',
    label: 'depends on'
  },
  subtask_of: {
    color: '#f59e0b',
    strokeWidth: 2,
    strokeDasharray: '8,4',
    label: 'subtask of'
  },

  // Workflow relationships
  requires_approval_from: {
    color: '#8b5cf6',
    strokeWidth: 1.5,
    strokeDasharray: '2,2',
    label: 'requires approval'
  },

  // Contribution relationships
  contributes_to: {
    color: '#06b6d4',
    strokeWidth: 1.5,
    label: 'contributes to'
  },

  // Reference relationships
  relates_to: {
    color: '#94a3b8',
    strokeWidth: 1,
    strokeDasharray: '5,5',
    label: 'relates to'
  },

  // Authorship
  authored_by: {
    color: '#ec4899',
    strokeWidth: 1.5,
    label: 'authored by'
  },
  reply_to: {
    color: '#ec4899',
    strokeWidth: 1.5,
    strokeDasharray: '3,3',
    label: 'reply to'
  },

  // Activity
  performed_by: {
    color: '#06b6d4',
    strokeWidth: 1.5,
    label: 'performed by'
  },

  // File
  uploaded_by: {
    color: '#f59e0b',
    strokeWidth: 1.5,
    label: 'uploaded by'
  }
}

/**
 * Field type icons mapping
 */
export const fieldTypeIcons: Record<string, string> = {
  text: '🔤',
  number: '🔢',
  boolean: '✓',
  date: '📅',
  datetime: '🕐',
  email: '📧',
  url: '🔗',
  phone: '📞',
  file: '📎',
  image: '🖼️',
  currency: '💰',
  color: '🎨',
  rating: '⭐',
  slider: '🎚️',
  coordinates: '📍',
  address: '🏠',
  markdown: '📝',
  textarea: '📄',
  'single-select': '☰',
  'multi-select': '☷',
  status_set: '🏷️',
  user_reference: '👤',
  entity_reference: '🔗',
  custom_user_reference: '👥',
  custom_entity_reference: '🔗',
  rollup_count: '∑',
  rollup_sum: '+',
  rollup_average: '±',
  rollup_concat: '⊕',
  computed_expression: 'ƒ',
  computed_formula: 'ƒ(x)'
}

/**
 * Node sizing constants
 */
export const nodeSizing = {
  minWidth: 280,
  maxWidth: 400,
  headerHeight: 48,
  fieldRowHeight: 32,
  footerHeight: 36,
  collapsedHeight: 84 // header + footer only
}

/**
 * Layout configuration defaults
 */
export const defaultLayoutConfig = {
  force: {
    nodeDistance: 200,
    edgeDistance: 150,
    strength: -1000,
    iterations: 100
  },
  hierarchical: {
    direction: 'TB' as const,
    levelSeparation: 150,
    nodeSpacing: 100
  }
}

/**
 * Get archetype color with fallback
 */
export function getArchetypeColor(archetype: string): string {
  return archetypeColors[archetype] || archetypeColors.other
}

/**
 * Get relationship style with fallback
 */
export function getRelationshipStyle(relationshipType: string) {
  return relationshipStyles[relationshipType] || relationshipStyles.relates_to
}

/**
 * Format relationship label for display
 */
export function formatRelationshipLabel(relationshipType: string): string {
  const style = getRelationshipStyle(relationshipType)
  return style.label
}

/**
 * Get field type icon with fallback
 */
export function getFieldTypeIcon(fieldType: string): string {
  return fieldTypeIcons[fieldType] || '•'
}

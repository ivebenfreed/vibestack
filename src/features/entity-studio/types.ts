/**
 * Entity Studio Type Definitions
 * TypeScript interfaces for node-based entity visualization
 */

import type { EnhancedFieldDefinition } from '@/legend-state/schema-observable'
import type { Node, Edge } from 'reactflow'

/**
 * Entity Node Data - Complete entity information for visualization
 */
export interface EntityNodeData {
  entityName: string
  archetype: string
  orgId: string
  orgName?: string
  fields: EnhancedFieldDefinition[]
  relationshipFields: RelationshipField[]
  metadata: {
    fieldCount: number
    relationshipCount: number
    recordCount?: number
  }
}

/**
 * Relationship field extracted from schema
 */
export interface RelationshipField {
  name: string
  type: 'user_reference' | 'entity_reference' | 'custom_user_reference' | 'custom_entity_reference'
  relationshipType?: string
  targetEntityType?: string
  cardinality?: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'
  properties?: Record<string, any>
}

/**
 * Entity Graph Node - React Flow node with entity data
 */
export type EntityGraphNode = Node<EntityNodeData>

/**
 * Relationship Edge Data - Connection metadata
 */
export interface RelationshipEdgeData {
  relationshipType: string
  sourceField: string
  cardinality: string
  label: string
  color?: string
}

/**
 * Entity Graph Edge - React Flow edge with relationship data
 */
export type EntityGraphEdge = Edge<RelationshipEdgeData>

/**
 * Complete entity graph structure
 */
export interface EntityGraph {
  nodes: EntityGraphNode[]
  edges: EntityGraphEdge[]
}

/**
 * Filter options for graph visualization
 */
export interface GraphFilters {
  archetypes: string[]
  relationshipTypes: string[]
  showFields: boolean
  searchQuery: string
}

/**
 * Layout configuration
 */
export interface LayoutConfig {
  type: 'force' | 'hierarchical' | 'circular' | 'grid'
  direction?: 'TB' | 'LR' | 'RL' | 'BT'
  spacing?: number
  nodeDistance?: number
}

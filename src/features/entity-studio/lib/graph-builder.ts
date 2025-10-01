/**
 * Graph Builder - Transform schema to React Flow graph structure
 * Extracts entities and relationships from OrgEntitySchema
 */

import type { OrgEntitySchema, EnhancedFieldDefinition } from '@/legend-state/schema-observable'
import type { EntityGraph, EntityGraphNode, EntityGraphEdge, RelationshipField } from '../types'
import { getArchetypeColor, formatRelationshipLabel, getRelationshipStyle } from './visual-config'
import { getHierarchicalLayout } from './layout-engine'

/**
 * Build complete entity graph from organization schema
 */
export function buildEntityGraph(schema: OrgEntitySchema | null): EntityGraph {
  if (!schema?.entities) {
    return { nodes: [], edges: [] }
  }

  const nodes: EntityGraphNode[] = []
  const edges: EntityGraphEdge[] = []
  const entityNames = Object.keys(schema.entities)

  // Create nodes for each entity
  entityNames.forEach((entityName, index) => {
    const definition = schema.entities[entityName]

    // Extract all fields with complete enhanced metadata
    const allFields = Object.values(definition.allFields || {}) as EnhancedFieldDefinition[]

    // Extract relationship fields from the fields array (they're not in a separate relationshipFields property)
    // Look for fields with reference types, excluding option references which are for dropdowns
    const relationshipFields: RelationshipField[] = allFields
      .filter(field => {
        const isReferenceType = field.type === 'user_reference' ||
                                field.type === 'entity_reference' ||
                                field.type === 'custom_user_reference' ||
                                field.type === 'custom_entity_reference'
        // Exclude option references - they're for dropdowns, not entity relationships
        const isOptionReference = field.type === 'custom_option_reference'
        return isReferenceType && !isOptionReference
      })
      .map(field => ({
        name: field.name,
        type: field.type as any,
        relationshipType: (field as any).relationshipType,
        targetEntityType: (field as any).targetEntityType || (field.type.includes('user') ? 'User' : undefined),
        cardinality: (field as any).cardinality,
        properties: (field as any).properties
      }))

    // Create node with rich metadata
    const node: EntityGraphNode = {
      id: entityName,
      type: 'entity',
      position: { x: 0, y: 0 }, // Layout engine will position
      data: {
        entityName: definition._originalName || entityName.split('_').pop() || entityName,
        archetype: definition.archetype,
        orgId: definition._orgId,
        orgName: definition._orgName,
        fields: allFields,
        relationshipFields,
        metadata: {
          fieldCount: allFields.length,
          relationshipCount: relationshipFields.length,
          recordCount: definition.businessMetadata?.recordCount
        }
      }
    }

    nodes.push(node)
  })

  // Create edges for relationships
  entityNames.forEach(entityName => {
    const definition = schema.entities[entityName]
    const allFields = Object.values(definition.allFields || {}) as EnhancedFieldDefinition[]

    // Extract relationship fields from the fields array
    const relationshipFields = allFields.filter(field => {
      const isReferenceType = field.type === 'user_reference' ||
                              field.type === 'entity_reference' ||
                              field.type === 'custom_user_reference' ||
                              field.type === 'custom_entity_reference'
      const isOptionReference = field.type === 'custom_option_reference'
      return isReferenceType && !isOptionReference
    })

    relationshipFields.forEach(field => {
      // Get target entity type - default to 'User' for user references
      const targetEntityName = (field as any).targetEntityType ||
                               (field.type.includes('user') ? 'User' : null)

      if (!targetEntityName) return // Skip if no target

      // Find target entity in same org
      const targetKey = entityNames.find(key => {
        const targetDef = schema.entities[key]
        const targetOriginalName = targetDef._originalName || key.split('_').pop()
        return targetOriginalName === targetEntityName
      })

      // Only create edge if target entity exists in this org
      if (targetKey) {
        const relationshipType = (field as any).relationshipType || 'relates_to'
        const cardinality = (field as any).cardinality || 'many-to-one'
        const style = getRelationshipStyle(relationshipType)

        // Format cardinality for display
        const cardinalityLabel = formatCardinality(cardinality)

        const edge: EntityGraphEdge = {
          id: `${entityName}-${field.name}-${targetKey}`,
          source: entityName,
          target: targetKey,
          type: 'relationship',
          data: {
            relationshipType,
            sourceField: field.name,
            cardinality,
            label: `${formatRelationshipLabel(relationshipType)} (${cardinalityLabel})`,
            color: style.color
          },
          style: {
            stroke: style.color,
            strokeWidth: style.strokeWidth,
            strokeDasharray: style.strokeDasharray
          },
          animated: false,
          markerEnd: {
            type: 'arrowclosed',
            color: style.color
          }
        }

        edges.push(edge)
      }
    })
  })

  return { nodes, edges }
}

/**
 * Apply simple grid layout as fallback
 * React Flow will handle force-directed layout internally
 */
export function applyGridLayout(nodes: EntityGraphNode[]): EntityGraphNode[] {
  const columns = Math.ceil(Math.sqrt(nodes.length))
  const spacing = 350

  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: (index % columns) * spacing,
      y: Math.floor(index / columns) * spacing
    }
  }))
}

/**
 * Filter graph by criteria
 */
export function filterGraph(
  graph: EntityGraph,
  filters: {
    archetypes?: string[]
    relationshipTypes?: string[]
    searchQuery?: string
  }
): EntityGraph {
  let filteredNodes = graph.nodes

  // Filter by archetypes
  if (filters.archetypes && filters.archetypes.length > 0) {
    filteredNodes = filteredNodes.filter(node =>
      filters.archetypes!.includes(node.data.archetype)
    )
  }

  // Filter by search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase()
    filteredNodes = filteredNodes.filter(node =>
      node.data.entityName.toLowerCase().includes(query) ||
      node.data.archetype.toLowerCase().includes(query)
    )
  }

  // Get IDs of filtered nodes
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id))

  // Filter edges - only keep edges between visible nodes
  let filteredEdges = graph.edges.filter(edge =>
    filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
  )

  // Filter by relationship types
  if (filters.relationshipTypes && filters.relationshipTypes.length > 0) {
    filteredEdges = filteredEdges.filter(edge =>
      filters.relationshipTypes!.includes(edge.data?.relationshipType || '')
    )
  }

  return {
    nodes: filteredNodes,
    edges: filteredEdges
  }
}

/**
 * Format cardinality for edge labels
 */
function formatCardinality(cardinality: string): string {
  const cardinalityMap: Record<string, string> = {
    'one-to-one': '1:1',
    'one-to-many': '1:N',
    'many-to-one': 'N:1',
    'many-to-many': 'N:M'
  }
  return cardinalityMap[cardinality] || 'N:1'
}

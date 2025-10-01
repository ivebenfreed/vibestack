/**
 * useEntityStudioData Hook
 * Reactive data loading for Entity Studio using Legend State observables
 */

import { useMemo } from 'react'
import { useSelector } from '@legendapp/state/react'
import { universeSchema$, universeLoading$, universeOrgId$ } from '@/legend-state/observables'
import type { OrgEntitySchema } from '@/legend-state/schema-observable'

/**
 * Hook to access Entity Studio data with Legend State integration
 * Automatically re-renders when schema changes
 */
export function useEntityStudioData(orgId?: string) {
  // Reactive schema access - automatically re-renders when schema changes
  const schema = useSelector(universeSchema$)
  const loading = useSelector(universeLoading$)
  const currentOrgId = useSelector(universeOrgId$)

  // Filter schema by organization if specified
  const filteredSchema = useMemo((): OrgEntitySchema | null => {
    if (!schema?.entities) return null
    if (!orgId) return schema // Universe view - all entities

    // Filter to specific organization
    const filteredEntities = Object.entries(schema.entities)
      .filter(([entityName]) => {
        // Check if entity name starts with orgId (org-prefixed format)
        if (entityName.startsWith(`${orgId}_`)) return true

        // Fallback: check entity metadata
        const entity = schema.entities[entityName]
        return entity._orgId === orgId || entity._organizationId === orgId
      })
      .reduce((acc, [name, def]) => ({ ...acc, [name]: def }), {})

    // Return filtered schema with entity count
    return {
      ...schema,
      entities: filteredEntities,
      orgId: orgId || 'universe'
    }
  }, [schema, orgId])

  // Calculate stats
  const stats = useMemo(() => {
    if (!filteredSchema?.entities) {
      return {
        totalEntities: 0,
        totalFields: 0,
        totalRelationships: 0,
        archetypes: new Set<string>()
      }
    }

    const entities = Object.values(filteredSchema.entities)
    const archetypes = new Set(entities.map(e => e.archetype))

    const totalFields = entities.reduce((sum, e) => {
      const fieldCount = Object.keys(e.allFields || {}).length
      return sum + fieldCount
    }, 0)

    // Count relationship fields from the fields array (they're not in a separate relationshipFields property)
    const totalRelationships = entities.reduce((sum, e) => {
      const allFields = Object.values(e.allFields || {})
      const relCount = allFields.filter((field: any) => {
        const isReferenceType = field.type === 'user_reference' ||
                                field.type === 'entity_reference' ||
                                field.type === 'custom_user_reference' ||
                                field.type === 'custom_entity_reference'
        const isOptionReference = field.type === 'custom_option_reference'
        return isReferenceType && !isOptionReference
      }).length
      return sum + relCount
    }, 0)

    return {
      totalEntities: entities.length,
      totalFields,
      totalRelationships,
      archetypes
    }
  }, [filteredSchema])

  return {
    schema: filteredSchema,
    loading,
    orgId: orgId || currentOrgId,
    stats
  }
}

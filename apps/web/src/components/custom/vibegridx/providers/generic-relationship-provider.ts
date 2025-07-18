import type { RelationshipOptionsProvider, RelationshipContext, EnumOption, Column } from '../types';

/**
 * Creates a generic relationship options provider that works with any relationship pattern
 * without hardcoded entity logic. Uses column metadata to determine the appropriate
 * filtering and sorting strategy.
 */
export function createGenericRelationshipProvider(
  column: Column,
  relationshipAtoms: Record<string, any>
): RelationshipOptionsProvider {
  return async (context: RelationshipContext) => {
    const { atoms, currentEntity } = context;
    
    console.log('🔍 Generic Relationship Provider: Loading options', {
      columnId: column.id,
      relationshipTable: column.relationshipTable,
      relationshipEntityType: column.relationshipEntityType,
      currentEntity,
      availableAtoms: Object.keys(atoms),
      availableRelationshipAtoms: Object.keys(relationshipAtoms)
    });
    
    // Get the relationship table key from column metadata
    const relationshipTable = column.relationshipTable;
    if (!relationshipTable) {
      console.warn('Generic provider: No relationshipTable specified for column', column.id);
      return [];
    }
    
    // Find the appropriate atom for this relationship
    let targetAtom: any = null;
    
    // Try various atom naming patterns
    const atomKeys = [
      relationshipTable,
      `${relationshipTable}s`,
      `${relationshipTable}sAtom`,
      relationshipTable.replace(/s$/, ''),
      `${relationshipTable.replace(/s$/, '')}s`,
      `${relationshipTable}Definitions`,
      `${relationshipTable}Definition`,
      `${relationshipTable}definitions`,
      `${relationshipTable}definition`
    ];
    
    for (const key of atomKeys) {
      if (relationshipAtoms[key] || atoms[key]) {
        targetAtom = relationshipAtoms[key] || atoms[key];
        console.log('🔍 Generic Relationship Provider: Found target atom', {
          columnId: column.id,
          atomKey: key,
          atomType: targetAtom.constructor.name
        });
        break;
      }
    }
    
    if (!targetAtom) {
      console.warn('Generic provider: No atom found for relationship table', {
        relationshipTable,
        availableAtoms: Object.keys(relationshipAtoms),
        availableContextAtoms: Object.keys(atoms),
        triedKeys: atomKeys
      });
      return [];
    }
    
    // Get the data from the atom
    const atomData = targetAtom.get() || {};
    const entities = Object.values(atomData);
    
    console.log('🔍 Generic Relationship Provider: Raw atom data', {
      columnId: column.id,
      entityCount: entities.length,
      sampleEntity: entities[0] || null,
      entityKeys: entities.length > 0 ? Object.keys(entities[0]) : []
    });
    
    if (entities.length === 0) {
      console.log('🔍 Generic Relationship Provider: No entities found in atom', {
        columnId: column.id,
        atomData: Object.keys(atomData)
      });
      return [];
    }
    
    // Apply generic filtering based on column configuration
    let filteredEntities = entities;
    
    // Check if this is a many-to-many relationship that needs filtering by entity type
    if (column.relationshipEntityType) {
      // For relationships like StatusDefinition -> StatusSet filtering
      const entityType = column.relationshipEntityType;
      
      // Find the appropriate "set" atom (e.g., statusSets for status relationships)
      const setAtomKeys = [
        `${relationshipTable}Sets`,
        `${relationshipTable}SetsAtom`,
        `${relationshipTable.replace(/s$/, '')}Sets`,
        `${relationshipTable.replace(/s$/, '')}SetsAtom`
      ];
      
      let setAtom: any = null;
      for (const key of setAtomKeys) {
        if (relationshipAtoms[key] || atoms[key]) {
          setAtom = relationshipAtoms[key] || atoms[key];
          break;
        }
      }
      
      if (setAtom) {
        const setData = setAtom.get() || {};
        const appropriateSet = Object.values(setData).find((set: any) => 
          set.entityType === entityType && set.isActive
        );
        
        if (appropriateSet) {
          // Filter entities that belong to this set
          const setIdField = `${relationshipTable.replace(/s$/, '')}SetId`;
          filteredEntities = entities.filter((entity: any) => {
            return entity[setIdField] === (appropriateSet as any).id && entity.isActive;
          });
          
          console.log('🔍 Generic Relationship Provider: Filtered by entity type', {
            columnId: column.id,
            entityType,
            setIdField,
            appropriateSetId: (appropriateSet as any).id,
            beforeFilterCount: entities.length,
            afterFilterCount: filteredEntities.length,
            sampleFilteredEntity: filteredEntities[0] || null
          });
        } else {
          console.warn('Generic provider: No active set found for entity type', {
            entityType,
            relationshipTable,
            availableSets: Object.values(setData).map((s: any) => ({ id: s.id, entityType: s.entityType, isActive: s.isActive }))
          });
        }
      } else {
        console.warn('Generic provider: No set atom found for relationship', {
          relationshipTable,
          triedSetAtomKeys: setAtomKeys,
          availableAtoms: Object.keys(relationshipAtoms),
          availableContextAtoms: Object.keys(atoms)
        });
        // Fallback to simple filtering
        filteredEntities = entities.filter((entity: any) => 
          entity.isActive !== false
        );
      }
    } else {
      // Simple filtering - just active entities
      filteredEntities = entities.filter((entity: any) => 
        entity.isActive !== false // Include entities without isActive field
      );
      
      console.log('🔍 Generic Relationship Provider: Simple filtering (no entity type)', {
        columnId: column.id,
        beforeFilterCount: entities.length,
        afterFilterCount: filteredEntities.length,
        sampleFilteredEntity: filteredEntities[0] || null
      });
    }
    
    // Sort by sortOrder if available, otherwise by common display fields
    filteredEntities.sort((a: any, b: any) => {
      if (typeof a.sortOrder === 'number' && typeof b.sortOrder === 'number') {
        return a.sortOrder - b.sortOrder;
      }
      
      // Fallback to alphabetical sorting by display field
      const aDisplay = a.label || a.displayName || a.name || a.title || a.id;
      const bDisplay = b.label || b.displayName || b.name || b.title || b.id;
      return String(aDisplay).localeCompare(String(bDisplay));
    });
    
    // Convert to EnumOption format
    const options: EnumOption[] = filteredEntities.map((entity: any) => ({
      value: entity.id,
      label: entity.label || entity.displayName || entity.name || entity.title || entity.id,
      color: entity.color,
      icon: entity.icon,
      description: entity.description || entity.metadata?.description
    }));
    
    console.log('🔍 Generic Relationship Provider: Final options', {
      columnId: column.id,
      relationshipTable: column.relationshipTable,
      relationshipEntityType: column.relationshipEntityType,
      optionCount: options.length,
      options: options.map(opt => ({ 
        value: opt.value, 
        label: opt.label,
        color: opt.color,
        icon: opt.icon
      }))
    });
    
    return options;
  };
}
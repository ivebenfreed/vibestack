// Fast relationship renderer for VibeGridX
import type { Column } from '../../types';

export interface RelationshipData {
  [tableName: string]: {
    [id: string]: {
      id: string;
      name?: string;
      title?: string;
      displayName?: string;
      [key: string]: any;
    };
  };
}

export function renderRelationship(
  value: any,
  column: Column,
  relationshipData?: RelationshipData
): string {
  // Handle null/undefined values
  if (value == null) {
    return column.placeholder || '';
  }

  // Determine the cell type and relationship table
  const cellType = column.cellType || 'relationship-single';
  const relationshipTable = column.relationshipTable;
  
  if (!relationshipTable || !relationshipData) {
    // No relationship data available, fall back to showing the ID
    return String(value);
  }

  const tableData = relationshipData[relationshipTable];
  if (!tableData) {
    // Table data not loaded
    return String(value);
  }

  switch (cellType) {
    case 'relationship-single': {
      // Single relationship - value is a foreign key ID
      const relatedEntity = tableData[value];
      if (!relatedEntity) {
        return String(value); // Entity not found, show ID
      }
      
      // Use display field priority: displayName > name > title > id
      const displayField = column.relationshipDisplayField || 
        (relatedEntity.displayName ? 'displayName' : 
         relatedEntity.name ? 'name' : 
         relatedEntity.title ? 'title' : 'id');
      
      return String(relatedEntity[displayField] || relatedEntity.id);
    }

    case 'relationship-multi':
    case 'relationship-collection': {
      // Multiple relationships - value is an array of IDs or objects
      const ids = Array.isArray(value) ? value : [];
      
      if (ids.length === 0) {
        return column.placeholder || '';
      }

      const displayValues = ids
        .map(id => {
          const relatedEntity = tableData[id];
          if (!relatedEntity) return null;
          
          const displayField = column.relationshipDisplayField || 
            (relatedEntity.displayName ? 'displayName' : 
             relatedEntity.name ? 'name' : 
             relatedEntity.title ? 'title' : 'id');
          
          return relatedEntity[displayField] || relatedEntity.id;
        })
        .filter(Boolean);

      // Format multiple values
      if (displayValues.length === 0) {
        return column.placeholder || '';
      } else if (displayValues.length === 1) {
        return String(displayValues[0]);
      } else if (displayValues.length === 2) {
        return `${displayValues[0]} and ${displayValues[1]}`;
      } else {
        return `${displayValues[0]} and ${displayValues.length - 1} more`;
      }
    }

    default:
      // Unknown relationship type
      return String(value);
  }
}
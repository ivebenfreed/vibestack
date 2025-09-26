/**
 * Static Cell Type Mapping - Performance Optimized Cell Creation
 *
 * Bypasses expensive schema generation with static type mappings.
 * Uses the cached column enhancement system for maximum performance.
 */

import type { Column } from '../column-types';

interface StaticCellConfig {
  renderer: any; // The actual renderer instance
  textAlign?: 'left' | 'center' | 'right';
  width?: number;
}

// Helper to create lightweight enhanced column for renderers
const createLightweightColumn = (column: Column): any => ({
  ...column,
  // Add minimal enhanced column properties needed by renderers
  display: {
    textAlign: 'left',
    width: column.width || 120
  },
  validation: { required: false },
  editable: column.editable !== false
});

// Static type mappings - O(1) lookup using actual renderer instances
export const STATIC_CELL_TYPE_MAP: Record<string, StaticCellConfig> = {
  // Basic text types
  'text': { renderer: textRenderer, textAlign: 'left' },
  'longtext': { renderer: textRenderer, textAlign: 'left', width: 300 },
  'rich-text': { renderer: textRenderer, textAlign: 'left', width: 300 },
  'textarea': { renderer: textRenderer, textAlign: 'left', width: 250 },
  'string': { renderer: textRenderer, textAlign: 'left' },

  // Number types
  'number': { renderer: numberRenderer, textAlign: 'right', width: 120 },
  'integer': { renderer: numberRenderer, textAlign: 'right', width: 120 },
  'decimal': { renderer: numberRenderer, textAlign: 'right', width: 120 },
  'float': { renderer: numberRenderer, textAlign: 'right', width: 120 },

  // Currency and percentage
  'currency': { renderer: currencyRenderer, textAlign: 'right', width: 140 },
  'percentage': { renderer: numberRenderer, textAlign: 'right', width: 100 },

  // Boolean
  'boolean': { renderer: booleanRenderer, textAlign: 'center', width: 80 },
  'checkbox': { renderer: booleanRenderer, textAlign: 'center', width: 80 },

  // Date and time types
  'date': { renderer: dateRenderer, textAlign: 'left', width: 140 },
  'datetime': { renderer: dateRenderer, textAlign: 'left', width: 160 },
  'timestamp': { renderer: dateRenderer, textAlign: 'left', width: 160 },

  // Selection types
  'select': { renderer: selectRenderer, textAlign: 'left', width: 140 },
  'single-select': { renderer: selectRenderer, textAlign: 'left', width: 140 },
  'select-multi': { renderer: selectRenderer, textAlign: 'left', width: 200 },
  'multi-select': { renderer: selectRenderer, textAlign: 'left', width: 200 },
  'enum': { renderer: selectRenderer, textAlign: 'left', width: 140 },

  // Communication types
  'email': { renderer: emailRenderer, textAlign: 'left', width: 200 },
  'url': { renderer: urlRenderer, textAlign: 'left', width: 250 },
  'phone': { renderer: phoneRenderer, textAlign: 'left', width: 150 },

  // Rich data types
  'file': { renderer: fileRenderer, textAlign: 'left', width: 180 },
  'image': { renderer: fileRenderer, textAlign: 'left', width: 180 },
  'color': { renderer: colorRenderer, textAlign: 'left', width: 140 },

  // Rating
  'rating': { renderer: ratingRenderer, textAlign: 'center', width: 120 },

  // Reference types
  'reference-select': { renderer: selectRenderer, textAlign: 'left', width: 160 },
  'custom_user_reference': { renderer: userReferenceRenderer, textAlign: 'left', width: 160 },
  'custom_entity_reference': { renderer: entityReferenceRenderer, textAlign: 'left', width: 160 },
  'user_reference': { renderer: userReferenceRenderer, textAlign: 'left', width: 160 },
  'entity_reference': { renderer: entityReferenceRenderer, textAlign: 'left', width: 160 },

  // Relationship types
  'relationship-single': { renderer: userReferenceRenderer, textAlign: 'left', width: 160 },
  'relationship-multi': { renderer: userReferenceRenderer, textAlign: 'left', width: 200 },
  'reference-multi': { renderer: userReferenceRenderer, textAlign: 'left', width: 200 },

  // Status and priority options
  'status_option': { renderer: selectRenderer, textAlign: 'left', width: 120 },
  'priority_option': { renderer: selectRenderer, textAlign: 'left', width: 120 },
  'category_option': { renderer: selectRenderer, textAlign: 'left', width: 140 },
  'task_type_option': { renderer: selectRenderer, textAlign: 'left', width: 140 },

  // Computed and rollup types
  'rollup_count': { renderer: numberRenderer, textAlign: 'right', width: 100 },
  'rollup_sum': { renderer: numberRenderer, textAlign: 'right', width: 120 },
  'rollup_average': { renderer: numberRenderer, textAlign: 'right', width: 120 },
  'rollup_concat': { renderer: textRenderer, textAlign: 'left', width: 200 },
  'computed_expression': { renderer: textRenderer, textAlign: 'left', width: 150 },
  'computed_formula': { renderer: textRenderer, textAlign: 'left', width: 150 }
};

/**
 * High-performance cell factory using actual renderer instances
 */
export class StaticCellFactory {
  static createCell(
    value: any,
    column: Column,
    rowData: any,
    position: { rowIndex: number; columnIndex: number; xPosition?: number }
  ): HTMLElement {
    const fieldType = column.cellType || column.type || 'text';
    const config = STATIC_CELL_TYPE_MAP[fieldType];

    if (config) {
      // Create lightweight enhanced column for the renderer
      const enhancedColumn = createLightweightColumn(column);
      return config.renderer.render(value, enhancedColumn, rowData);
    }

    // Fallback to text for unknown types
    const enhancedColumn = createLightweightColumn(column);
    return STATIC_CELL_TYPE_MAP.text.renderer.render(value, enhancedColumn, rowData);
  }

  static updateCell(
    cellElement: HTMLElement,
    value: any,
    column: Column,
    rowData: any
  ): void {
    const fieldType = column.cellType || column.type || 'text';
    const config = STATIC_CELL_TYPE_MAP[fieldType];

    if (config) {
      const enhancedColumn = createLightweightColumn(column);
      config.renderer.update(cellElement, value, enhancedColumn);
    } else {
      // Fallback to text renderer
      const enhancedColumn = createLightweightColumn(column);
      STATIC_CELL_TYPE_MAP.text.renderer.update(cellElement, value, enhancedColumn);
    }
  }

  static getColumnWidth(column: Column): number | undefined {
    const fieldType = column.cellType || column.type || 'text';
    return STATIC_CELL_TYPE_MAP[fieldType]?.width;
  }

  static getTextAlign(column: Column): string {
    const fieldType = column.cellType || column.type || 'text';
    return STATIC_CELL_TYPE_MAP[fieldType]?.textAlign || 'left';
  }

  static isSupported(column: Column): boolean {
    const fieldType = column.cellType || column.type || 'text';
    return fieldType in STATIC_CELL_TYPE_MAP;
  }
}
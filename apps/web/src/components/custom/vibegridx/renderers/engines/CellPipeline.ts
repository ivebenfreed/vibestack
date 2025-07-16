import type { Column } from '../../types';
import { 
  text, 
  number, 
  date, 
  boolean, 
  enumValue,
  relationshipSingle,
  relationshipMulti,
} from '../cell-renderers';

// ====================================
// CELL RENDERING PIPELINE
// ====================================

/**
 * High-performance cell rendering pipeline
 * Centralizes all cell value rendering logic
 */
export class CellPipeline {
  // Map of renderers for quick lookup
  private static readonly renderers: Record<string, (value: any, column: Column, relationshipData?: any) => string> = {
    text: text,
    number: number,
    date: date,
    boolean: boolean,
    enum: enumValue,
    select: text, // Reuse text renderer for select
    uuid: text, // UUID is text-based
    json: text, // JSON displayed as text (could be enhanced later)
    relationship: relationshipSingle, // Default to single
    'relationship-single': relationshipSingle,
    'relationship-multi': relationshipMulti,
    'relationship-collection': relationshipMulti, // Collections use multi renderer
  };

  /**
   * Fast cell value rendering with type-based formatting
   * @param value - The cell value to render
   * @param column - Column configuration including type and formatting options
   * @param rowData - Full row data for relationship resolution
   * @returns Formatted string for cell content
   */
  static renderValue(value: any, column: Column, rowData?: any): string {
    // Check column cellType first, then fall back to type
    const cellType = column.cellType || column.type;
    const renderer = CellPipeline.renderers[cellType] || text;
    
    // For relationship types, pass row data for pre-resolved values
    if (cellType?.startsWith('relationship')) {
      return (renderer as any)(value, column, rowData);
    }
    
    return renderer(value, column);
  }

  /**
   * Creates a cell content element with proper formatting
   * @param value - The cell value
   * @param column - Column configuration
   * @param rowData - Full row data for context
   * @returns DOM element with rendered content
   */
  static createCellContent(value: any, column: Column, rowData: any): HTMLElement {
    const content = document.createElement('div');
    Object.assign(content.style, {
      width: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      padding: '8px 12px',
      boxSizing: 'border-box'
    });
    
    // Set content efficiently - pass row data for relationship resolution
    const cellContent = this.renderValue(value, column, rowData);
    const cellType = column.cellType || column.type;
    
    // Check if column is editable
    const isEditable = column.editable !== false; // Default to true unless explicitly false
    
    if (isEditable) {
      // Create wrapper element for editable content
      const wrapper = document.createElement('div');
      
      // Add appropriate CSS class based on content type
      const isEmpty = !cellContent || cellContent === '' || cellContent === 'null' || cellContent === 'undefined';
      
      if (isEmpty) {
        wrapper.className = 'vibegridx-cell-empty-editable';
        wrapper.textContent = 'Click to edit';
      } else {
        // Add type-specific editable class
        switch (cellType) {
          case 'text':
          case 'string':
            wrapper.className = 'vibegridx-cell-text-editable';
            break;
          case 'number':
          case 'integer':
          case 'float':
            wrapper.className = 'vibegridx-cell-number-editable';
            break;
          case 'boolean':
            wrapper.className = 'vibegridx-cell-boolean-editable';
            break;
          case 'enum':
            wrapper.className = 'vibegridx-cell-badge-editable';
            break;
          default:
            wrapper.className = 'vibegridx-cell-content-editable';
        }
        
        // Set content based on type
        if (cellType === 'enum' || cellType?.startsWith('relationship')) {
          wrapper.innerHTML = cellContent;
        } else {
          wrapper.textContent = cellContent;
        }
      }
      
      content.appendChild(wrapper);
    } else {
      // Non-editable content - render normally
      if (cellType === 'enum' || cellType?.startsWith('relationship')) {
        content.innerHTML = cellContent;
      } else {
        content.textContent = cellContent;
      }
    }
    
    return content;
  }

  /**
   * Get renderer for a specific column type
   * @param columnType - The column type
   * @returns The renderer function or default text renderer
   */
  static getRenderer(columnType: string): (value: any, column: Column, relationshipData?: any) => string {
    return CellPipeline.renderers[columnType] || text;
  }

  /**
   * Register a custom renderer for a column type
   * @param columnType - The column type to register
   * @param renderer - The renderer function
   */
  static registerRenderer(
    columnType: string, 
    renderer: (value: any, column: Column, relationshipData?: any) => string
  ): void {
    CellPipeline.renderers[columnType] = renderer;
  }
}
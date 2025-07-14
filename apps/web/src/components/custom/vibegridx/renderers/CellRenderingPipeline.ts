import type { Column } from '../types';
import { 
  renderText, 
  renderNumber, 
  renderDate, 
  renderBoolean, 
  renderEnum,
  renderRelationshipSingle,
  renderRelationshipMulti,
} from './fast-renderers';

// ====================================
// CELL RENDERING PIPELINE
// ====================================

/**
 * High-performance cell rendering pipeline
 * Centralizes all cell value rendering logic
 */
export class CellRenderingPipeline {
  // Map of renderers for quick lookup
  private static readonly renderers: Record<string, (value: any, column: Column, relationshipData?: any) => string> = {
    text: renderText,
    number: renderNumber,
    date: renderDate,
    boolean: renderBoolean,
    enum: renderEnum,
    select: renderText, // Reuse text renderer for select
    uuid: renderText, // UUID is text-based
    json: renderText, // JSON displayed as text (could be enhanced later)
    relationship: renderRelationshipSingle, // Default to single
    'relationship-single': renderRelationshipSingle,
    'relationship-multi': renderRelationshipMulti,
    'relationship-collection': renderRelationshipMulti, // Collections use multi renderer
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
    const renderer = CellRenderingPipeline.renderers[cellType] || renderText;
    
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
    
    // Check if this is an enum type that returns HTML
    const cellType = column.cellType || column.type;
    if (cellType === 'enum') {
      content.innerHTML = cellContent;
    } else {
      content.textContent = cellContent;
    }
    
    return content;
  }

  /**
   * Get renderer for a specific column type
   * @param columnType - The column type
   * @returns The renderer function or default text renderer
   */
  static getRenderer(columnType: string): (value: any, column: Column, relationshipData?: any) => string {
    return CellRenderingPipeline.renderers[columnType] || renderText;
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
    CellRenderingPipeline.renderers[columnType] = renderer;
  }
}
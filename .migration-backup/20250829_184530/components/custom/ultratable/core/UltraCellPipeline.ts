/**
 * UltraCellPipeline - High-Performance Cell Rendering
 * 
 * Extracted from VibeGrid's CellPipeline with enhancements.
 * Features:
 * - Static renderer map for O(1) type lookups
 * - Direct DOM element creation
 * - Specialized renderers for each cell type
 * - Zero virtual DOM overhead
 * - Optimized for Legend State data
 */

import type { Column } from '../types';

// ====================================
// CELL RENDERERS
// ====================================

// Text renderer - handles strings, UUIDs, JSON
function renderText(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

// Number renderer - handles integers, floats, currency
function renderNumber(value: any, column: Column): string {
  if (value === null || value === undefined) return '';
  
  const num = Number(value);
  if (isNaN(num)) return String(value);
  
  // Check for formatting options
  if (column.format) {
    if (column.format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(num);
    }
    
    if (column.format === 'percentage') {
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(num / 100);
    }
  }
  
  // Default number formatting
  return new Intl.NumberFormat('en-US').format(num);
}

// Date renderer - handles ISO strings and Date objects
function renderDate(value: any, column: Column): string {
  if (!value) return '';
  
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  
  // Use format option or default
  const format = column.format || 'short';
  
  switch (format) {
    case 'short':
      return date.toLocaleDateString();
    case 'long':
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'time':
      return date.toLocaleTimeString();
    case 'datetime':
      return date.toLocaleString();
    case 'relative':
      return formatRelativeTime(date);
    default:
      return date.toLocaleDateString();
  }
}

// Boolean renderer - shows checkmark or X
function renderBoolean(value: any): string {
  if (value === null || value === undefined) return '';
  return value ? '✓' : '✗';
}

// Enum renderer - shows badge with color
function renderEnum(value: any, column: Column): string {
  if (!value) return '';
  
  const option = column.options?.find(opt => opt.value === value);
  const label = option?.label || String(value);
  const color = option?.color || '#6b7280';
  
  return `<span class="ultra-badge" style="background-color: ${color}20; color: ${color}; border: 1px solid ${color}40; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: 500;">${label}</span>`;
}

// Relationship renderer - handles foreign key lookups
function renderRelationship(value: any, column: Column, rowData?: any): string {
  if (!value) return '';
  
  // Check for pre-resolved relationship data
  const resolvedField = `${column.field || column.id}__resolved_name`;
  if (rowData && rowData[resolvedField]) {
    return String(rowData[resolvedField]);
  }
  
  // Fallback to raw value
  return String(value);
}

// Multi-relationship renderer - shows badges for multiple values
function renderMultiRelationship(value: any, column: Column, rowData?: any): string {
  if (!value) return '';
  
  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0) return '';
  
  const badges = values.slice(0, 3).map(val => {
    const resolvedField = `${column.field || column.id}__resolved_name`;
    const label = (rowData && rowData[resolvedField] && rowData[resolvedField][val]) || String(val);
    
    return `<span class="ultra-multi-badge">${label}</span>`;
  });
  
  if (values.length > 3) {
    badges.push(`<span class="ultra-multi-badge ultra-more">+${values.length - 3}</span>`);
  }
  
  return badges.join('');
}

// Relative time formatter
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

// ====================================
// ULTRA CELL PIPELINE
// ====================================

export class UltraCellPipeline {
  // Static renderer map for O(1) lookups
  private static readonly renderers: Record<string, (value: any, column: Column, rowData?: any) => string> = {
    text: renderText,
    string: renderText,
    uuid: renderText,
    json: renderText,
    
    number: renderNumber,
    integer: renderNumber,
    float: renderNumber,
    currency: renderNumber,
    
    date: renderDate,
    datetime: renderDate,
    timestamp: renderDate,
    
    boolean: renderBoolean,
    
    enum: renderEnum,
    select: renderEnum,
    
    relationship: renderRelationship,
    'relationship-single': renderRelationship,
    'relationship-multi': renderMultiRelationship,
    'relationship-collection': renderMultiRelationship,
  };
  
  /**
   * Fast cell value rendering with type-based formatting
   */
  static renderValue(value: any, column: Column, rowData?: any): string {
    const cellType = column.type || 'text';
    const renderer = UltraCellPipeline.renderers[cellType] || renderText;
    
    try {
      return renderer(value, column, rowData);
    } catch (error) {
      console.warn('[UltraCellPipeline] Render error:', error, { value, column: column.id, cellType });
      return String(value || '');
    }
  }
  
  /**
   * Creates a cell content element with proper formatting
   */
  static createCellContent(value: any, column: Column, rowData?: any): HTMLElement {
    const container = document.createElement('div');
    const cellType = column.type || 'text';
    
    // Base styles for all cells
    Object.assign(container.style, {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontSize: '14px',
      color: 'var(--foreground)'
    });
    
    // Special handling for multi-relationship badges
    if (cellType === 'relationship-multi' || cellType === 'relationship-collection') {
      container.innerHTML = UltraCellPipeline.renderValue(value, column, rowData);
      
      // Add styles for badges
      const badges = container.querySelectorAll('.ultra-multi-badge');
      badges.forEach(badge => {
        Object.assign((badge as HTMLElement).style, {
          display: 'inline-block',
          backgroundColor: 'var(--muted)',
          color: 'var(--muted-foreground)',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '500',
          marginRight: '4px',
          border: '1px solid var(--border)'
        });
      });
      
      // Style the "+more" badge
      const moreBadge = container.querySelector('.ultra-more') as HTMLElement;
      if (moreBadge) {
        Object.assign(moreBadge.style, {
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-foreground)',
          borderColor: 'var(--accent)'
        });
      }
      
      return container;
    }
    
    // Handle empty values
    const isEmpty = value === null || value === undefined || value === '';
    if (isEmpty) {
      container.className = 'ultra-cell-empty';
      Object.assign(container.style, {
        color: 'var(--muted-foreground)',
        fontStyle: 'italic'
      });
      
      if (column.editable !== false) {
        container.textContent = column.placeholder || 'Click to edit';
        container.style.cursor = 'pointer';
      } else {
        container.textContent = '—';
      }
      
      return container;
    }
    
    // Render content based on type
    const renderedContent = UltraCellPipeline.renderValue(value, column, rowData);
    
    if (cellType === 'enum' || cellType === 'select' || renderedContent.includes('<')) {
      // HTML content (badges, formatted text)
      container.innerHTML = renderedContent;
    } else {
      // Plain text content
      container.textContent = renderedContent;
    }
    
    // Add type-specific styling
    switch (cellType) {
      case 'number':
      case 'integer':
      case 'float':
      case 'currency':
        Object.assign(container.style, {
          justifyContent: 'flex-end',
          fontVariantNumeric: 'tabular-nums'
        });
        break;
        
      case 'boolean':
        Object.assign(container.style, {
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 'bold',
          color: value ? 'var(--green-600)' : 'var(--red-600)'
        });
        break;
        
      case 'date':
      case 'datetime':
      case 'timestamp':
        Object.assign(container.style, {
          fontVariantNumeric: 'tabular-nums'
        });
        break;
    }
    
    // Add editable styling if applicable
    if (column.editable !== false) {
      container.className += ' ultra-cell-editable';
      container.style.cursor = 'pointer';
      
      // Add subtle hover effect
      container.addEventListener('mouseenter', () => {
        container.style.backgroundColor = 'var(--muted)';
      });
      
      container.addEventListener('mouseleave', () => {
        container.style.backgroundColor = 'transparent';
      });
    }
    
    return container;
  }
  
  /**
   * Get renderer for a specific column type
   */
  static getRenderer(columnType: string): (value: any, column: Column, rowData?: any) => string {
    return UltraCellPipeline.renderers[columnType] || renderText;
  }
  
  /**
   * Register a custom renderer for a column type
   */
  static registerRenderer(
    columnType: string,
    renderer: (value: any, column: Column, rowData?: any) => string
  ): void {
    UltraCellPipeline.renderers[columnType] = renderer;
  }
  
  /**
   * Get all available renderer types
   */
  static getAvailableTypes(): string[] {
    return Object.keys(UltraCellPipeline.renderers);
  }
}
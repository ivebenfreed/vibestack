import React from 'react';
import ReactDOM from 'react-dom/client';
import type { CellRef, Column } from '../types';
import type { VisualCellPosition } from './OverlayTypes';
import type { ActorRefFrom } from 'xstate';
import type { tableBaseMachine } from '../machines/table-machine';
import { createEditor, type EditorProps } from './editors';

// ====================================
// EDITING OVERLAY - React Portal for Cell Editing
// ====================================

interface EditingOverlayConfig {
  onUpdate: (value: any) => void;
  onCommit: (value: any) => void;
  onCancel: () => void;
  zIndex?: number;
  // Relationship context for dropdown editors
  relationshipContext?: {
    relationshipResolvers?: Record<string, (id: string | string[]) => string>;
    relationshipAtoms?: Record<string, any>;
  };
}

export class EditingOverlay {
  private container: HTMLElement;
  private portal: HTMLDivElement | null = null;
  private root: ReactDOM.Root | null = null;
  private config: EditingOverlayConfig;
  private currentCell: CellRef | null = null;
  private currentColumn: Column | null = null;
  private currentValue: any = null;
  
  constructor(container: HTMLElement, config: EditingOverlayConfig) {
    this.container = container;
    this.config = config;
    
    console.log('🔧 EditingOverlay: Constructor called', {
      container,
      containerClass: container.className,
      containerInDOM: document.contains(container),
      containerVisible: container.offsetWidth > 0 && container.offsetHeight > 0,
      containerBounds: container.getBoundingClientRect()
    });
    
    this.createPortal();
  }
  
  private createPortal(): void {
    // Create portal container
    this.portal = document.createElement('div');
    this.portal.className = 'vibegridx-editing-portal';
    this.portal.style.cssText = `
      position: absolute;
      z-index: ${this.config.zIndex || 1000};
      pointer-events: auto;
      box-sizing: border-box;
    `;
    
    // Ensure the portal can receive focus events
    this.portal.setAttribute('tabindex', '-1');
    
    // Initially hidden
    this.portal.style.display = 'none';
    
    // Append to container
    this.container.appendChild(this.portal);
    
    // Create React root
    this.root = ReactDOM.createRoot(this.portal);
    
    console.log('🔧 EditingOverlay: Portal created', {
      portal: this.portal,
      container: this.container,
      containerClass: this.container.className,
      zIndex: this.config.zIndex || 1000,
      portalInDOM: document.contains(this.portal),
      portalParent: this.portal.parentElement,
      containerChildCount: this.container.childNodes.length,
      portalAppended: this.container.contains(this.portal)
    });
  }
  
  public showAt(
    position: VisualCellPosition,
    cell: CellRef,
    column: Column,
    value: any,
    validationErrors?: Map<string, string>,
    mode?: 'single-click' | 'double-click' | 'keyboard',
    immediate?: boolean
  ): void {
    if (!this.portal || !this.root) return;
    
    // Re-append portal if it's not in DOM (canvas container might have been cleared)
    if (!this.portal.parentElement) {
      console.log('🔧 EditingOverlay: Re-appending portal to container');
      this.container.appendChild(this.portal);
    }
    
    console.log('EditingOverlay: Showing editor', {
      cell,
      column: column.id,
      position,
      value,
      mode,
      immediate
    });
    
    // Store current state
    this.currentCell = cell;
    this.currentColumn = column;
    this.currentValue = value;
    
    // Position the portal
    this.portal.style.display = 'block';
    
    console.log('🔧 EditingOverlay: Portal positioned', {
      portalDisplay: this.portal.style.display,
      portalVisible: this.portal.offsetWidth > 0 && this.portal.offsetHeight > 0,
      portalBounds: this.portal.getBoundingClientRect(),
      portalInDOM: document.contains(this.portal),
      portalParent: this.portal.parentElement,
      containerInDOM: document.contains(this.container),
      containerVisible: this.container.offsetWidth > 0 && this.container.offsetHeight > 0,
      containerBounds: this.container.getBoundingClientRect()
    });
    
    // Check editor type to determine positioning strategy
    const isTextType = ['text', 'string', 'email', 'url', 'textarea', 'longtext', 'number', 'integer', 'float'].includes(column.cellType || column.type || 'text');
    const isDropdownType = ['enum', 'select', 'boolean'].includes(column.cellType || column.type || 'text');
    
    console.log('🔧 EditingOverlay: Editor type detection', {
      columnType: column.cellType || column.type || 'text',
      isTextType,
      isDropdownType
    });
    
    if (isTextType) {
      // Text editors: Position exactly over the cell and hide cell content
      this.portal.style.left = `${position.x}px`;
      this.portal.style.top = `${position.y}px`;
      this.portal.style.width = `${position.width}px`;
      this.portal.style.height = `${position.height}px`;
      this.portal.style.padding = '0';
      this.portal.style.boxSizing = 'border-box';
      this.portal.style.fontSize = '13px';
      this.portal.style.overflow = 'hidden';
      
      // Hide the cell content by adding a class to the cell
      this.hideCellContent(cell);
      
      // Add subtle editing indicator
      if (mode === 'single-click') {
        this.portal.style.outline = '1px solid rgb(59, 130, 246)'; // Blue for consistency
        this.portal.style.outlineOffset = '-1px';
        this.portal.style.transition = 'outline-color 0.2s ease';
      } else {
        this.portal.style.outline = '2px solid rgb(59, 130, 246)'; // Blue for double-click
        this.portal.style.outlineOffset = '-1px';
      }
    } else if (isDropdownType) {
      // Dropdown editors: Position below the cell and keep cell content visible
      this.portal.style.left = `${position.x}px`;
      this.portal.style.top = `${position.y + position.height}px`; // Position below cell
      this.portal.style.width = `${Math.max(position.width, 200)}px`; // Minimum width for dropdowns
      this.portal.style.height = 'auto'; // Auto height for dropdown
      this.portal.style.padding = '4px';
      this.portal.style.boxSizing = 'border-box';
      this.portal.style.backgroundColor = 'white';
      this.portal.style.border = '1px solid var(--border)';
      this.portal.style.borderRadius = '4px';
      this.portal.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
      this.portal.style.zIndex = '1001'; // Above everything
      
      // Add editing indicator to the original cell
      this.addEditingIndicatorToCell(cell, mode);
    } else {
      // Default behavior for other editors
      this.portal.style.left = `${position.x}px`;
      this.portal.style.top = `${position.y}px`;
      this.portal.style.width = `${position.width}px`;
      this.portal.style.height = `${position.height}px`;
      this.portal.style.padding = '4px';
      
      // Consistent outline for all editors
      this.portal.style.outline = '2px solid rgb(59, 130, 246)'; // Blue for consistency
      this.portal.style.outlineOffset = '-1px';
    }
    
    // Render the editor component using shadcn components
    console.log('🔧 EditingOverlay: About to render editor', {
      hasRoot: !!this.root,
      hasPortal: !!this.portal,
      column: column.id,
      columnType: column.cellType || column.type,
      value,
      hasCallbacks: {
        onCommit: !!this.config.onCommit,
        onCancel: !!this.config.onCancel,
        onUpdate: !!this.config.onUpdate
      }
    });
    
    const editorComponent = createEditor({
      cell,
      column,
      initialValue: value,
      onCommit: this.config.onCommit,
      onCancel: this.config.onCancel,
      onUpdate: this.config.onUpdate,
      relationshipContext: this.config.relationshipContext
    });
    
    console.log('🔧 EditingOverlay: Editor component created', {
      editorComponent,
      componentType: editorComponent.type?.name || 'unknown'
    });
    
    this.root.render(editorComponent);
    
    // Check portal contents immediately after render
    setTimeout(() => {
      console.log('🔧 EditingOverlay: Portal contents after render', {
        portalChildCount: this.portal?.childNodes.length || 0,
        portalInnerHTML: this.portal?.innerHTML || 'none',
        portalVisible: this.portal?.offsetWidth > 0 && this.portal?.offsetHeight > 0,
        portalStyles: {
          display: this.portal?.style.display,
          position: this.portal?.style.position,
          left: this.portal?.style.left,
          top: this.portal?.style.top,
          width: this.portal?.style.width,
          height: this.portal?.style.height,
          zIndex: this.portal?.style.zIndex,
          pointerEvents: this.portal?.style.pointerEvents
        },
        containerStyles: {
          position: this.container?.style.position,
          pointerEvents: this.container?.style.pointerEvents,
          zIndex: this.container?.style.zIndex,
          overflow: this.container?.style.overflow
        },
        computedStyles: this.portal ? {
          display: window.getComputedStyle(this.portal).display,
          visibility: window.getComputedStyle(this.portal).visibility,
          opacity: window.getComputedStyle(this.portal).opacity,
          zIndex: window.getComputedStyle(this.portal).zIndex
        } : null
      });
      
      const input = this.portal?.querySelector('input, select, textarea') as HTMLElement;
      if (input) {
        console.log('EditingOverlay: Force focusing input after render');
        input.focus();
        if ('select' in input) {
          (input as HTMLInputElement).select();
        }
      } else {
        console.log('🔧 EditingOverlay: No input found in portal');
      }
    }, 10);
  }
  
  public updateValue(value: any): void {
    this.currentValue = value;
    // Re-render with new value if needed
    if (this.currentCell && this.currentColumn && this.root) {
      this.root.render(
        createEditor({
          cell: this.currentCell,
          column: this.currentColumn,
          initialValue: value,
          onCommit: this.config.onCommit,
          onCancel: this.config.onCancel,
          onUpdate: this.config.onUpdate,
          relationshipContext: this.config.relationshipContext
        })
      );
    }
  }
  
  public updateValidationErrors(errors: Map<string, string>): void {
    // Re-render with validation errors
    if (this.currentCell && this.currentColumn && this.currentValue !== null && this.root) {
      this.root.render(
        createEditor({
          cell: this.currentCell,
          column: this.currentColumn,
          initialValue: this.currentValue,
          onCommit: this.config.onCommit,
          onCancel: this.config.onCancel,
          onUpdate: this.config.onUpdate,
          relationshipContext: this.config.relationshipContext
        })
      );
    }
  }
  
  private hideCellContent(cell: CellRef): void {
    // Find the cell element and hide its content
    const cellElement = document.querySelector(`[data-row-id="${cell.rowId}"][data-column-id="${cell.columnId}"]`) as HTMLElement;
    if (cellElement) {
      cellElement.classList.add('vibegridx-cell-content-hidden');
    }
  }
  
  private addEditingIndicatorToCell(cell: CellRef, mode?: string): void {
    // Find the cell element and add an editing indicator
    const cellElement = document.querySelector(`[data-row-id="${cell.rowId}"][data-column-id="${cell.columnId}"]`) as HTMLElement;
    if (cellElement) {
      cellElement.classList.add('vibegridx-cell-dropdown-editing');
      cellElement.style.outline = '2px solid rgb(59, 130, 246)'; // Blue for consistency
      cellElement.style.outlineOffset = '-1px';
    }
  }
  
  private restoreCellContent(cell: CellRef): void {
    // Find the cell element and restore its content
    const cellElement = document.querySelector(`[data-row-id="${cell.rowId}"][data-column-id="${cell.columnId}"]`) as HTMLElement;
    if (cellElement) {
      cellElement.classList.remove('vibegridx-cell-content-hidden');
      cellElement.classList.remove('vibegridx-cell-dropdown-editing');
      cellElement.style.outline = '';
      cellElement.style.outlineOffset = '';
    }
  }

  public hide(): void {
    if (!this.portal) return;
    
    console.log('EditingOverlay: Hiding editor');
    
    // Restore cell content if it was hidden
    if (this.currentCell) {
      this.restoreCellContent(this.currentCell);
    }
    
    // Hide portal
    this.portal.style.display = 'none';
    
    // Reset styles
    this.portal.style.padding = '0';
    this.portal.style.outline = 'none';
    this.portal.style.backgroundColor = '';
    this.portal.style.border = '';
    this.portal.style.borderRadius = '';
    this.portal.style.boxShadow = '';
    
    // Clear React content
    if (this.root) {
      this.root.render(null);
    }
    
    // Clear state
    this.currentCell = null;
    this.currentColumn = null;
    this.currentValue = null;
  }
  
  public updatePosition(position: VisualCellPosition): void {
    if (!this.portal) return;
    
    // Update portal position (for scrolling)
    this.portal.style.left = `${position.x}px`;
    this.portal.style.top = `${position.y}px`;
  }
  
  public destroy(): void {
    this.hide();
    
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    
    if (this.portal && this.portal.parentNode) {
      this.portal.parentNode.removeChild(this.portal);
      this.portal = null;
    }
  }
}


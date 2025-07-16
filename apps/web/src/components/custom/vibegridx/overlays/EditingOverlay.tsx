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
  }
  
  public showAt(
    position: VisualCellPosition,
    cell: CellRef,
    column: Column,
    value: any,
    validationErrors?: Map<string, string>
  ): void {
    if (!this.portal || !this.root) return;
    
    console.log('EditingOverlay: Showing editor', {
      cell,
      column: column.id,
      position,
      value
    });
    
    // Store current state
    this.currentCell = cell;
    this.currentColumn = column;
    this.currentValue = value;
    
    // Position the portal
    this.portal.style.display = 'block';
    this.portal.style.left = `${position.x}px`;
    this.portal.style.top = `${position.y}px`;
    this.portal.style.width = `${position.width}px`;
    this.portal.style.height = `${position.height}px`;
    
    // For text editors, we want the input to fill the cell exactly
    const isTextType = ['text', 'string', 'email', 'url', 'textarea', 'longtext'].includes(column.cellType || column.type || 'text');
    if (isTextType) {
      // Match the exact cell styles for seamless inline editing
      this.portal.style.padding = '0';
      this.portal.style.boxSizing = 'border-box';
      this.portal.style.fontSize = '13px';
      this.portal.style.overflow = 'hidden';
      // Add subtle editing indicator
      this.portal.style.outline = '2px solid rgb(59, 130, 246)';
      this.portal.style.outlineOffset = '-1px';
    } else {
      // Reset padding for non-text editors
      this.portal.style.padding = '4px';
      // Different outline for non-text editors
      this.portal.style.outline = '2px solid rgb(59, 130, 246)';
      this.portal.style.outlineOffset = '-1px';
    }
    
    // Render the editor component using shadcn components
    this.root.render(
      createEditor({
        cell,
        column,
        initialValue: value,
        onCommit: this.config.onCommit,
        onCancel: this.config.onCancel
      })
    );
    
    // Force focus after a short delay to ensure the editor is ready
    setTimeout(() => {
      const input = this.portal?.querySelector('input, select, textarea') as HTMLElement;
      if (input) {
        console.log('EditingOverlay: Force focusing input after render');
        input.focus();
        if ('select' in input) {
          (input as HTMLInputElement).select();
        }
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
          onCancel: this.config.onCancel
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
          onCancel: this.config.onCancel
        })
      );
    }
  }
  
  public hide(): void {
    if (!this.portal) return;
    
    console.log('EditingOverlay: Hiding editor');
    
    // Hide portal
    this.portal.style.display = 'none';
    
    // Reset styles
    this.portal.style.padding = '0';
    this.portal.style.outline = 'none';
    
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


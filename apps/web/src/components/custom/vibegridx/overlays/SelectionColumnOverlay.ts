import Konva from 'konva';
import type { ViewportInfo } from '../types';

// ====================================
// SELECTION COLUMN OVERLAY
// ====================================

export interface SelectionColumnOverlayConfig {
  cellHeight: number;
  headerHeight: number;
  columnWidth?: number;
  checkboxSize?: number;
  backgroundColor?: string;
  borderColor?: string;
  checkboxColor?: string;
  checkboxBorderColor?: string;
}

export class SelectionColumnOverlay {
  private layer: Konva.Layer;
  private config: SelectionColumnOverlayConfig;
  
  // UI Elements
  private backgroundRect: Konva.Rect | null = null;
  private headerCheckbox: Konva.Group | null = null;
  private rowCheckboxes: Map<string, Konva.Group> = new Map();
  
  // State
  private selectedRows: Set<string> = new Set();
  private visibleRowIds: string[] = [];
  private allRowIds: string[] = [];
  private currentViewport: ViewportInfo | null = null;
  
  // Event dispatcher
  private dispatchEvent: (event: any) => void;
  
  constructor(
    layer: Konva.Layer,
    config: SelectionColumnOverlayConfig,
    dispatchEvent: (event: any) => void
  ) {
    this.layer = layer;
    this.config = {
      columnWidth: 48,
      checkboxSize: 16,
      backgroundColor: 'var(--background)',
      borderColor: 'var(--border)',
      checkboxColor: 'var(--primary)',
      checkboxBorderColor: 'var(--border)',
      ...config
    };
    this.dispatchEvent = dispatchEvent;
    
    this.initialize();
  }
  
  private initialize(): void {
    // Create background rectangle for the selection column
    this.backgroundRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: this.config.columnWidth!,
      height: 2000, // Will be updated based on viewport
      fill: this.config.backgroundColor,
      stroke: this.config.borderColor,
      strokeWidth: 1,
      listening: false
    });
    
    this.layer.add(this.backgroundRect);
  }
  
  /**
   * Update the selection column with current state
   */
  update(params: {
    selectedRows: Set<string>;
    visibleRowIds: string[];
    allRowIds: string[];
    viewport: ViewportInfo | null;
  }): void {
    this.selectedRows = params.selectedRows;
    this.visibleRowIds = params.visibleRowIds;
    this.allRowIds = params.allRowIds;
    this.currentViewport = params.viewport;
    
    if (!params.viewport) {
      this.clear();
      return;
    }
    
    // Update background height
    if (this.backgroundRect) {
      const totalHeight = this.config.headerHeight + (params.viewport.end - params.viewport.start) * this.config.cellHeight;
      this.backgroundRect.height(totalHeight);
    }
    
    // Render header checkbox
    this.renderHeaderCheckbox();
    
    // Render visible row checkboxes
    this.renderRowCheckboxes();
    
    this.layer.batchDraw();
  }
  
  private renderHeaderCheckbox(): void {
    const allSelected = this.selectedRows.size === this.allRowIds.length && this.allRowIds.length > 0;
    const someSelected = this.selectedRows.size > 0 && this.selectedRows.size < this.allRowIds.length;
    
    if (!this.headerCheckbox) {
      this.headerCheckbox = new Konva.Group({
        x: this.config.columnWidth! / 2,
        y: this.config.headerHeight / 2,
        listening: true
      });
      
      // Checkbox background
      const checkboxBg = new Konva.Rect({
        x: -this.config.checkboxSize! / 2,
        y: -this.config.checkboxSize! / 2,
        width: this.config.checkboxSize!,
        height: this.config.checkboxSize!,
        fill: 'white',
        stroke: this.config.checkboxBorderColor,
        strokeWidth: 1,
        cornerRadius: 3
      });
      
      // Checkmark path
      const checkmark = new Konva.Path({
        data: 'M 3 8 L 6 11 L 13 4',
        stroke: this.config.checkboxColor,
        strokeWidth: 2,
        visible: false,
        offsetX: 8,
        offsetY: 7.5
      });
      
      // Indeterminate line
      const indeterminate = new Konva.Line({
        points: [-6, 0, 6, 0],
        stroke: this.config.checkboxColor,
        strokeWidth: 2,
        visible: false
      });
      
      this.headerCheckbox.add(checkboxBg);
      this.headerCheckbox.add(checkmark);
      this.headerCheckbox.add(indeterminate);
      
      // Click handler
      this.headerCheckbox.on('click', () => {
        if (allSelected) {
          this.dispatchEvent({ type: 'selection.checkbox.none' });
        } else {
          this.dispatchEvent({ type: 'selection.checkbox.all' });
        }
      });
      
      // Hover effects
      this.headerCheckbox.on('mouseenter', () => {
        checkboxBg.fill('#f3f4f6');
        this.layer.batchDraw();
      });
      
      this.headerCheckbox.on('mouseleave', () => {
        checkboxBg.fill('white');
        this.layer.batchDraw();
      });
      
      this.layer.add(this.headerCheckbox);
    }
    
    // Update checkbox state
    const checkmark = this.headerCheckbox.findOne('.checkmark') as Konva.Path;
    const indeterminate = this.headerCheckbox.findOne('.indeterminate') as Konva.Line;
    
    if (checkmark && indeterminate) {
      checkmark.visible(allSelected && !someSelected);
      indeterminate.visible(someSelected && !allSelected);
    }
  }
  
  private renderRowCheckboxes(): void {
    if (!this.currentViewport) return;
    
    // Clear checkboxes for rows that are no longer visible
    this.rowCheckboxes.forEach((checkbox, rowId) => {
      if (!this.visibleRowIds.includes(rowId)) {
        checkbox.destroy();
        this.rowCheckboxes.delete(rowId);
      }
    });
    
    // Render checkboxes for visible rows
    this.visibleRowIds.forEach((rowId, index) => {
      const absoluteIndex = this.currentViewport!.start + index;
      const y = this.config.headerHeight + absoluteIndex * this.config.cellHeight + this.config.cellHeight / 2;
      
      let checkbox = this.rowCheckboxes.get(rowId);
      
      if (!checkbox) {
        checkbox = this.createRowCheckbox(rowId, y);
        this.rowCheckboxes.set(rowId, checkbox);
        this.layer.add(checkbox);
      } else {
        // Update position if needed
        checkbox.y(y);
      }
      
      // Update checked state
      const isSelected = this.selectedRows.has(rowId);
      const checkmark = checkbox.findOne('.checkmark') as Konva.Path;
      if (checkmark) {
        checkmark.visible(isSelected);
      }
    });
  }
  
  private createRowCheckbox(rowId: string, y: number): Konva.Group {
    const checkbox = new Konva.Group({
      x: this.config.columnWidth! / 2,
      y: y,
      listening: true
    });
    
    // Checkbox background
    const checkboxBg = new Konva.Rect({
      x: -this.config.checkboxSize! / 2,
      y: -this.config.checkboxSize! / 2,
      width: this.config.checkboxSize!,
      height: this.config.checkboxSize!,
      fill: 'white',
      stroke: this.config.checkboxBorderColor,
      strokeWidth: 1,
      cornerRadius: 3,
      name: 'background'
    });
    
    // Checkmark path
    const checkmark = new Konva.Path({
      data: 'M 3 8 L 6 11 L 13 4',
      stroke: this.config.checkboxColor,
      strokeWidth: 2,
      visible: this.selectedRows.has(rowId),
      offsetX: 8,
      offsetY: 7.5,
      name: 'checkmark'
    });
    
    checkbox.add(checkboxBg);
    checkbox.add(checkmark);
    
    // Click handler with shift key support
    checkbox.on('click', (evt) => {
      const konvaEvent = evt as Konva.KonvaEventObject<MouseEvent>;
      const mouseEvent = konvaEvent.evt;
      
      if (mouseEvent.shiftKey && this.getLastSelectedRowId()) {
        // Range selection
        this.dispatchEvent({
          type: 'selection.checkbox.range',
          startRowId: this.getLastSelectedRowId(),
          endRowId: rowId
        });
      } else {
        // Toggle selection
        this.dispatchEvent({
          type: 'selection.checkbox.toggle',
          rowId: rowId
        });
      }
    });
    
    // Hover effects
    checkbox.on('mouseenter', () => {
      checkboxBg.fill('#f3f4f6');
      this.layer.batchDraw();
    });
    
    checkbox.on('mouseleave', () => {
      checkboxBg.fill('white');
      this.layer.batchDraw();
    });
    
    return checkbox;
  }
  
  private getLastSelectedRowId(): string | null {
    // This would be provided by the selection coordinator
    // For now, return the first selected row
    return this.selectedRows.size > 0 ? Array.from(this.selectedRows)[0] : null;
  }
  
  /**
   * Clear all checkboxes
   */
  clear(): void {
    if (this.headerCheckbox) {
      this.headerCheckbox.destroy();
      this.headerCheckbox = null;
    }
    
    this.rowCheckboxes.forEach(checkbox => checkbox.destroy());
    this.rowCheckboxes.clear();
    
    this.layer.batchDraw();
  }
  
  /**
   * Destroy the overlay
   */
  destroy(): void {
    this.clear();
    
    if (this.backgroundRect) {
      this.backgroundRect.destroy();
    }
  }
}
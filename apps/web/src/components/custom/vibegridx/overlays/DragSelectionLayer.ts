import Konva from 'konva';
import type { ViewportInfo, Column } from '../types';
import type { OverlayConfig, DragState } from './OverlayTypes';
import { CoordinateSystem } from './CoordinateSystem';

// ====================================
// DRAG SELECTION LAYER
// ====================================

export class DragSelectionLayer {
  private stage: Konva.Stage;
  private config: OverlayConfig;
  private coordinateSystem: CoordinateSystem;
  private dimensionManager: any; // ColumnDimensionManager
  private currentViewport: ViewportInfo | null = null;
  private columns: Column[] = [];
  
  // Drag state
  private dragState: DragState = {
    isDragging: false,
    startPos: null,
    startCell: null,
    currentPos: null,
    currentCell: null
  };

  // Callbacks
  public onSelectionComplete?: (selectedCells: Set<string>) => void;
  public onSelectionPreview?: (x: number, y: number, width: number, height: number) => void;

  constructor(
    stage: Konva.Stage, 
    config: OverlayConfig, 
    coordinateSystem: CoordinateSystem,
    dimensionManager?: any
  ) {
    this.stage = stage;
    this.config = config;
    this.coordinateSystem = coordinateSystem;
    this.dimensionManager = dimensionManager;
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Mouse down - start drag selection
    this.stage.on('mousedown', (e) => {
      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      // Check if we clicked on an interactive element
      const shape = e.target;
      if (shape && shape !== this.stage && shape.attrs && shape.attrs.listening) {
        return; // Don't start drag on interactive elements
      }

      // Get the viewport to calculate cell position
      const viewport = this.currentViewport || this.getViewport();
      
      // Canvas is inside scrollable body and moves with it, so no scroll adjustment needed
      const cellPos = this.coordinateSystem.viewportToCell(pos.x, pos.y, viewport);
      
      if (cellPos) {
        this.dragState = {
          isDragging: true,
          startPos: pos,
          startCell: { x: cellPos.column, y: cellPos.row },
          currentPos: pos,
          currentCell: { x: cellPos.column, y: cellPos.row }
        };
        
        // Immediately select the initial cell
        const { rowId, columnId } = this.coordinateSystem.cellIndicesToIds(cellPos.row, cellPos.column);
        if (rowId && columnId && this.onSelectionComplete) {
          const initialSelection = new Set([`${rowId}:${columnId}`]);
          console.log('DragSelectionLayer: Initial cell selected', cellPos, rowId, columnId);
          this.onSelectionComplete(initialSelection);
        }
      }
    });

    // Mouse move - update drag selection
    this.stage.on('mousemove', (e) => {
      if (!this.dragState.isDragging || !this.dragState.startPos || !this.dragState.startCell) {
        return;
      }

      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      this.dragState.currentPos = pos;

      // Calculate current cell
      const viewport = this.currentViewport || this.getViewport();
      
      // Canvas is inside scrollable body and moves with it, so no scroll adjustment needed
      const cellPos = this.coordinateSystem.viewportToCell(pos.x, pos.y, viewport);
      
      if (cellPos) {
        this.dragState.currentCell = { x: cellPos.column, y: cellPos.row };

        // Calculate preview bounds
        const minX = Math.min(this.dragState.startCell.x, cellPos.column);
        const maxX = Math.max(this.dragState.startCell.x, cellPos.column);
        const minY = Math.min(this.dragState.startCell.y, cellPos.row);
        const maxY = Math.max(this.dragState.startCell.y, cellPos.row);

        // Convert back to viewport coordinates for preview
        const topLeft = this.coordinateSystem.cellToViewport(minY, minX, viewport);
        
        // Calculate actual width based on columns
        const width = this.calculateColumnsWidth(minX, maxX);
        const height = (maxY - minY + 1) * this.config.cellHeight;

        // Show preview
        if (this.onSelectionPreview) {
          this.onSelectionPreview(topLeft.x, topLeft.y, width, height);
        }
      }
    });

    // Mouse up - complete drag selection
    this.stage.on('mouseup', (e) => {
      if (!this.dragState.isDragging || !this.dragState.startPos) {
        return;
      }

      const pos = this.stage.getPointerPosition();
      if (!pos) {
        this.resetDragState();
        return;
      }

      // Check if it was actually a drag (moved more than 5 pixels)
      const dragDistance = Math.sqrt(
        Math.pow(pos.x - this.dragState.startPos.x, 2) + 
        Math.pow(pos.y - this.dragState.startPos.y, 2)
      );

      if (dragDistance > 5) {
        // Complete the drag selection
        const viewport = this.currentViewport || this.getViewport();
        
        // Canvas is inside scrollable body and moves with it, so no scroll adjustment needed
        const selectedCells = this.coordinateSystem.calculateDragSelection(
          this.dragState.startPos,
          pos,
          viewport
        );

        if (selectedCells.size > 0 && this.onSelectionComplete) {
          console.log('DragSelectionLayer: Selection completed with', selectedCells.size, 'cells');
          this.onSelectionComplete(selectedCells);
        }
      } else {
        // It was a click, not a drag - forward to the table
        this.forwardClickEvent(e, pos);
      }

      this.resetDragState();
    });

    // Mouse leave - cancel drag
    this.stage.on('mouseleave', () => {
      if (this.dragState.isDragging) {
        this.resetDragState();
      }
    });
  }

  private forwardClickEvent(e: Konva.KonvaEventObject<MouseEvent>, pos: { x: number; y: number }): void {
    // Calculate the cell position
    const viewport = this.currentViewport || this.getViewport();
    const cellPos = this.coordinateSystem.viewportToCell(pos.x, pos.y, viewport);
    
    if (cellPos) {
      // Forward click to the table body at the calculated cell position
      const container = this.stage.container();
      const canvasRect = container.getBoundingClientRect();
      
      // Use the cell center position for more accurate clicking
      const cellCenterX = cellPos.x + this.config.cellWidth / 2;
      const cellCenterY = cellPos.y + this.config.cellHeight / 2;
      
      const x = canvasRect.left + cellCenterX;
      const y = canvasRect.top + cellCenterY;
      
      const originalDisplay = container.style.display;
      container.style.display = 'none';
      
      const element = document.elementFromPoint(x, y);
      
      container.style.display = originalDisplay;
      
      if (element) {
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          screenX: x,
          screenY: y,
          ctrlKey: e.evt.ctrlKey,
          shiftKey: e.evt.shiftKey,
          altKey: e.evt.altKey,
          metaKey: e.evt.metaKey
        });
        
        element.dispatchEvent(clickEvent);
      }
    }
  }

  private getViewport(): ViewportInfo {
    // Get viewport info - canvas is now inside the viewport
    const container = this.stage.container();
    
    // Look for viewport as an ancestor since canvas is inside it
    let viewport = container.closest('.vibegridx-viewport') as HTMLElement;
    
    // If not found as ancestor, check parent for old structure
    if (!viewport) {
      const parent = container.parentElement;
      viewport = parent?.querySelector('.vibegridx-viewport') as HTMLElement;
    }
    
    if (viewport) {
      return {
        start: Math.floor(viewport.scrollTop / this.config.cellHeight),
        end: Math.ceil((viewport.scrollTop + viewport.clientHeight) / this.config.cellHeight),
        height: viewport.clientHeight,
        width: viewport.clientWidth,
        scrollTop: viewport.scrollTop,
        itemHeight: this.config.cellHeight
      };
    }
    
    // Fallback viewport
    return {
      start: 0,
      end: 50,
      height: container.clientHeight || 600,
      width: container.clientWidth || 800,
      scrollTop: 0,
      itemHeight: this.config.cellHeight
    };
  }

  private resetDragState(): void {
    this.dragState = {
      isDragging: false,
      startPos: null,
      startCell: null,
      currentPos: null,
      currentCell: null
    };
  }

  // Public methods
  isDragging(): boolean {
    return this.dragState.isDragging;
  }

  cancelDrag(): void {
    this.resetDragState();
  }

  updateViewport(viewport: ViewportInfo): void {
    this.currentViewport = viewport;
  }

  // Columns are now managed by dimensionManager passed during initialization
  
  // Calculate the total width of columns between two column indices
  private calculateColumnsWidth(startCol: number, endCol: number): number {
    let totalWidth = 0;
    
    // If we have columns defined and dimensionManager, use their actual widths
    if (this.columns.length > 0 && this.dimensionManager) {
      for (let colIndex = startCol; colIndex <= endCol && colIndex < this.columns.length; colIndex++) {
        const column = this.columns[colIndex];
        if (column) {
          totalWidth += this.dimensionManager.getColumnWidth(column.id);
        }
      }
    } else {
      // Fallback to default calculation
      totalWidth = (endCol - startCol + 1) * this.config.cellWidth;
    }
    
    return totalWidth;
  }
}
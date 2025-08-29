import type { ViewportState } from '../types';
import { debugLog } from '@/logger';
const log = debugLog('archive/deprecated-components/vibegantt/systems/CoordinateSystem.ts');

export interface GanttCoordinateConfig {
  rowHeight: number;
  dayWidth: number;
  headerHeight: number;
  taskListWidth: number;
}

export interface TaskPosition {
  x: number;
  y: number;
  row: number;
  dayOffset: number;
}

export interface ContainerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Coordinate system for VibeGantt that provides unified positioning
 * across different containers (task list, chart, overlay)
 */
export class CoordinateSystem {
  private config: GanttCoordinateConfig;
  private timelineStartDate: Date | null = null;
  
  // Container references for coordinate transformations
  private chartContainer: HTMLElement | null = null;
  private taskContainer: HTMLElement | null = null;
  private overlayContainer: HTMLElement | null = null;
  
  constructor(config: GanttCoordinateConfig) {
    this.config = config;
  }
  
  // Update configuration
  updateConfig(config: Partial<GanttCoordinateConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  // Set timeline start date for date calculations
  setTimelineStartDate(startDate: Date): void {
    this.timelineStartDate = startDate;
  }
  
  // Set container references
  setContainers(containers: {
    chartContainer?: HTMLElement;
    taskContainer?: HTMLElement;
    overlayContainer?: HTMLElement;
  }): void {
    if (containers.chartContainer) this.chartContainer = containers.chartContainer;
    if (containers.taskContainer) this.taskContainer = containers.taskContainer;
    if (containers.overlayContainer) this.overlayContainer = containers.overlayContainer;
  }
  
  // Convert task row and date to chart coordinates
  taskToChartCoordinates(
    rowIndex: number, 
    startDate: Date, 
    endDate: Date
  ): { x: number; y: number; width: number; height: number } {
    if (!this.timelineStartDate) {
      throw new Error('Timeline start date not set');
    }
    
    const daysSinceStart = Math.floor(
      (startDate.getTime() - this.timelineStartDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const durationDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    
    return {
      x: daysSinceStart * this.config.dayWidth,
      y: rowIndex * this.config.rowHeight,
      width: Math.max(durationDays * this.config.dayWidth, 20), // Minimum width
      height: this.config.rowHeight,
    };
  }
  
  // Convert chart coordinates to task row and date
  chartToTaskCoordinates(x: number, y: number): TaskPosition {
    if (!this.timelineStartDate) {
      throw new Error('Timeline start date not set');
    }
    
    const row = Math.floor(y / this.config.rowHeight);
    const dayOffset = Math.floor(x / this.config.dayWidth);
    
    return {
      x,
      y,
      row,
      dayOffset,
    };
  }
  
  // Convert chart coordinates to viewport coordinates (accounting for scroll)
  chartToViewport(
    chartX: number, 
    chartY: number, 
    viewport: ViewportState
  ): { x: number; y: number } {
    return {
      x: chartX - viewport.scrollX,
      y: chartY - viewport.scrollY,
    };
  }
  
  // Convert viewport coordinates to chart coordinates (accounting for scroll)
  viewportToChart(
    viewportX: number, 
    viewportY: number, 
    viewport: ViewportState
  ): { x: number; y: number } {
    return {
      x: viewportX + viewport.scrollX,
      y: viewportY + viewport.scrollY,
    };
  }
  
  // Get container bounds relative to chart container
  getContainerBounds(container: HTMLElement): ContainerBounds {
    if (!this.chartContainer) {
      throw new Error('Chart container not set');
    }
    
    const chartRect = this.chartContainer.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    return {
      x: containerRect.left - chartRect.left,
      y: containerRect.top - chartRect.top,
      width: containerRect.width,
      height: containerRect.height,
    };
  }
  
  // Convert coordinates between different containers
  transformBetweenContainers(
    x: number,
    y: number,
    fromContainer: HTMLElement,
    toContainer: HTMLElement
  ): { x: number; y: number } {
    if (!this.chartContainer) {
      throw new Error('Chart container not set');
    }
    
    // If containers are the same, no transformation needed
    if (fromContainer === toContainer) {
      return { x, y };
    }
    
    const fromBounds = this.getContainerBounds(fromContainer);
    const toBounds = this.getContainerBounds(toContainer);
    
    return {
      x: x + fromBounds.x - toBounds.x,
      y: y + fromBounds.y - toBounds.y,
    };
  }
  
  // Convert mouse event coordinates to chart coordinates
  mouseEventToChart(event: MouseEvent, viewport: ViewportState): { x: number; y: number } {
    if (!this.chartContainer) {
      throw new Error('Chart container not set');
    }
    
    const chartRect = this.chartContainer.getBoundingClientRect();
    const viewportX = event.clientX - chartRect.left;
    const viewportY = event.clientY - chartRect.top;
    
    return this.viewportToChart(viewportX, viewportY, viewport);
  }
  
  // Get day width from pixel delta
  pixelsToDays(pixels: number): number {
    return Math.round(pixels / this.config.dayWidth);
  }
  
  // Get pixel delta from days
  daysToPixels(days: number): number {
    return days * this.config.dayWidth;
  }
  
  // Calculate date from day offset
  dayOffsetToDate(dayOffset: number): Date {
    if (!this.timelineStartDate) {
      throw new Error('Timeline start date not set');
    }
    
    const date = new Date(this.timelineStartDate);
    date.setDate(date.getDate() + dayOffset);
    return date;
  }
  
  // Calculate day offset from date
  dateToDateOffset(date: Date): number {
    if (!this.timelineStartDate) {
      throw new Error('Timeline start date not set');
    }
    
    return Math.floor(
      (date.getTime() - this.timelineStartDate.getTime()) / (24 * 60 * 60 * 1000)
    );
  }
  
  // Check if coordinates are within visible viewport
  isVisibleInViewport(
    chartX: number, 
    chartY: number, 
    viewport: ViewportState
  ): boolean {
    const viewportCoords = this.chartToViewport(chartX, chartY, viewport);
    
    return (
      viewportCoords.x >= -this.config.dayWidth &&
      viewportCoords.x <= viewport.width + this.config.dayWidth &&
      viewportCoords.y >= -this.config.rowHeight &&
      viewportCoords.y <= viewport.height + this.config.rowHeight
    );
  }
  
  // Get visible chart area bounds
  getVisibleChartBounds(viewport: ViewportState): {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } {
    return {
      left: viewport.scrollX,
      top: viewport.scrollY,
      right: viewport.scrollX + viewport.width,
      bottom: viewport.scrollY + viewport.height,
    };
  }
  
  // Debug method to log coordinate transformation
  debugTransformation(
    description: string,
    fromCoords: { x: number; y: number },
    toCoords: { x: number; y: number },
    container?: string
  ): void {
    log.info(`CoordinateSystem.${description}:`, {
      from: fromCoords,
      to: toCoords,
      container,
      config: this.config,
      timelineStartDate: this.timelineStartDate?.toISOString(),
    });
  }
}
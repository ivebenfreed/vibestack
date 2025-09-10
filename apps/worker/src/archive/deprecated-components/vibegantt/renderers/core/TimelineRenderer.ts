import { TimeScaleEngine } from '../engines/TimeScaleEngine';
import type { DateRange, TimeScale } from '../../types';
import { GANTT_COLORS } from '../../constants';
import { format, isToday } from 'date-fns';
import { log } from '@/logger';
const fileLog = log('archive/deprecated-components/vibegantt/renderers/core/TimelineRenderer.ts');

interface TimelineRenderOptions {
  dateRange: DateRange;
  zoomLevel: TimeScale;
  showWeekends: boolean;
  showToday: boolean;
}

export class TimelineRenderer {
  private container: HTMLElement;
  private timeScaleEngine: TimeScaleEngine;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private headerDiv: HTMLElement;
  private isDestroyed: boolean = false;
  
  constructor(container: HTMLElement, timeScaleEngine: TimeScaleEngine) {
    this.container = container;
    this.timeScaleEngine = timeScaleEngine;
    
    // Create canvas for grid lines
    this.canvas = this.createCanvas();
    this.ctx = this.canvas.getContext('2d')!;
    
    // Create header div for labels
    this.headerDiv = this.createHeaderDiv();
    
    // Append elements directly to container
    this.container.appendChild(this.canvas);
    this.container.appendChild(this.headerDiv);
  }
  
  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = 'vibegantt-timeline-grid';
    canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: block;
    `;
    return canvas;
  }
  
  private createHeaderDiv(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'vibegantt-timeline-header';
    div.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    `;
    return div;
  }
  
  render(options: TimelineRenderOptions): void {
    if (this.isDestroyed) return;
    
    // Clear previous content
    this.clear();
    
    // Note: Don't call setZoomLevel here as it's already set in GanttRenderer with proper pixels per day
    fileLog.info('TimelineRenderer: Rendering with', {
      zoomLevel: options.zoomLevel,
      dayWidth: this.timeScaleEngine.getDayWidth(),
      dateRange: {
        start: options.dateRange.start.toISOString(),
        end: options.dateRange.end.toISOString()
      }
    });
    
    // Get time units
    const units = this.timeScaleEngine.getTimeUnits(options.dateRange);
    const headerUnits = this.timeScaleEngine.getHeaderUnits(options.dateRange);
    
    // Debug: Log rendering details
    fileLog.info('TimelineRenderer: Units generated', {
      zoomLevel: options.zoomLevel,
      unitsCount: units.length,
      headerUnitsCount: headerUnits.length,
      firstUnit: units[0]?.label,
      firstHeader: headerUnits[0]?.label,
      dateRange: {
        start: options.dateRange.start.toISOString(),
        end: options.dateRange.end.toISOString()
      }
    });
    
    // Debug: Log if no units are generated
    if (units.length === 0) {
      fileLog.warn('TimelineRenderer: No units generated for date range:', options.dateRange);
    }
    
    // Render grid lines
    this.renderGridLines(units, options);
    
    // Render time labels
    this.renderTimeLabels(units, headerUnits);
    
    // Render today line if enabled
    if (options.showToday) {
      this.renderTodayLine(options.dateRange);
    }
  }
  
  private renderGridLines(
    units: Array<{ x: number; width: number; isWeekend?: boolean }>,
    options: TimelineRenderOptions
  ): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    
    // Set canvas size (accounting for device pixel ratio)
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
    
    // Configure context
    this.ctx.strokeStyle = GANTT_COLORS.grid.line;
    this.ctx.lineWidth = 1;
    
    // Draw vertical grid lines
    units.forEach(unit => {
      // Fill weekend background if enabled
      if (options.showWeekends && unit.isWeekend) {
        this.ctx.fillStyle = GANTT_COLORS.grid.weekend;
        this.ctx.fillRect(unit.x, 0, unit.width, height);
      }
      
      // Draw vertical line
      this.ctx.beginPath();
      this.ctx.moveTo(unit.x + 0.5, 0);
      this.ctx.lineTo(unit.x + 0.5, height);
      this.ctx.stroke();
    });
    
    // Draw bottom border
    this.ctx.beginPath();
    this.ctx.moveTo(0, height - 0.5);
    this.ctx.lineTo(width, height - 0.5);
    this.ctx.stroke();
  }
  
  private renderTimeLabels(
    units: Array<{ date: Date; label: string; x: number; width: number; isToday?: boolean }>,
    headerUnits: Array<{ date: Date; label: string; x: number; width: number }>
  ): void {
    // Clear existing labels
    this.headerDiv.innerHTML = '';
    
    // Debug: Only log if there are rendering issues
    if (units.length === 0 || headerUnits.length === 0) {
      fileLog.warn('TimelineRenderer: Missing units for label rendering', {
        units: units.length,
        headerUnits: headerUnits.length
      });
    }
    
    // Render header units (top row)
    if (headerUnits.length > 0) {
      const headerRow = document.createElement('div');
      headerRow.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 30px;
        display: flex;
        align-items: center;
        border-bottom: 1px solid ${GANTT_COLORS.grid.line};
      `;
      
      headerUnits.forEach(unit => {
        const label = document.createElement('div');
        label.style.cssText = `
          position: absolute;
          left: ${unit.x}px;
          width: ${unit.width}px;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 12px;
          color: #4b5563;
          border-right: 1px solid ${GANTT_COLORS.grid.line};
        `;
        label.textContent = unit.label;
        headerRow.appendChild(label);
      });
      
      this.headerDiv.appendChild(headerRow);
    }
    
    // Render main units (bottom row)
    const mainRow = document.createElement('div');
    mainRow.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: ${headerUnits.length > 0 ? '30px' : '60px'};
      display: flex;
      align-items: center;
    `;
    
    units.forEach(unit => {
      const label = document.createElement('div');
      label.style.cssText = `
        position: absolute;
        left: ${unit.x}px;
        width: ${unit.width}px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: ${unit.isToday ? GANTT_COLORS.grid.today : '#6b7280'};
        font-weight: ${unit.isToday ? '600' : '400'};
      `;
      label.textContent = unit.label;
      
      if (unit.isToday) {
        label.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      }
      
      mainRow.appendChild(label);
    });
    
    this.headerDiv.appendChild(mainRow);
  }
  
  private renderTodayLine(dateRange: DateRange): void {
    const today = new Date();
    
    // Check if today is within the visible range
    if (today < dateRange.start || today > dateRange.end) return;
    
    const x = this.timeScaleEngine.dateToPixel(today, dateRange.start);
    
    // Create today line element
    const todayLine = document.createElement('div');
    todayLine.className = 'vibegantt-today-line';
    todayLine.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: 0;
      bottom: 0;
      width: 2px;
      background-color: ${GANTT_COLORS.grid.today};
      z-index: 5;
      pointer-events: none;
    `;
    
    // Add today label
    const todayLabel = document.createElement('div');
    todayLabel.style.cssText = `
      position: absolute;
      left: ${x + 4}px;
      top: 4px;
      padding: 2px 6px;
      background-color: ${GANTT_COLORS.grid.today};
      color: white;
      font-size: 10px;
      font-weight: 600;
      border-radius: 4px;
      white-space: nowrap;
    `;
    todayLabel.textContent = 'Today';
    
    this.container.appendChild(todayLine);
    this.container.appendChild(todayLabel);
  }
  
  private clear(): void {
    // Clear canvas
    const { width, height } = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, width, height);
    
    // Clear labels
    this.headerDiv.innerHTML = '';
    
    // Remove today line elements
    const todayElements = this.container.querySelectorAll('.vibegantt-today-line, .vibegantt-today-label');
    todayElements.forEach(el => el.remove());
  }
  
  resize(width: number): void {
    if (this.isDestroyed) return;
    
    // Update container width to match the timeline width  
    this.container.style.width = `${width}px`;
    
    // Update viewport width in TimeScaleEngine for pixel calculations
    this.timeScaleEngine.setViewportWidth(width);
    
    // Canvas width is set to 100% so it will automatically adjust
    // The actual canvas buffer size is set during render
  }
  
  destroy(): void {
    this.isDestroyed = true;
    this.clear();
    this.container.innerHTML = '';
  }
}
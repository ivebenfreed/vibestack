import { TIME_SCALE_CONFIG } from '../../constants';
import type { TimeScale, DateRange } from '../../types';
import { 
import { debugLog } from '@/logger';
const log = debugLog('archive/deprecated-components/vibegantt/renderers/engines/TimeScaleEngine.ts');
  startOfHour, 
  startOfDay, 
  startOfWeek, 
  startOfMonth, 
  startOfQuarter, 
  startOfYear,
  endOfHour,
  endOfDay,
  endOfWeek,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  addHours,
  addDays,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
  differenceInMilliseconds,
  differenceInDays,
  format,
  isWeekend,
  isSameDay,
} from 'date-fns';

export class TimeScaleEngine {
  private zoomLevel: TimeScale;
  private pixelsPerDay: number;
  private viewportWidth: number;
  private minDate: Date;
  private maxDate: Date;
  
  constructor(zoomLevel: TimeScale = 'day', viewportWidth: number = 1000) {
    this.zoomLevel = zoomLevel;
    this.viewportWidth = viewportWidth;
    this.pixelsPerDay = this.calculatePixelsPerDay();
    this.minDate = new Date(2000, 0, 1);
    this.maxDate = new Date(2100, 0, 1);
    log.info('TimeScaleEngine: Initialized with', {
      zoomLevel,
      pixelsPerDay: this.pixelsPerDay
    });
  }
  
  // Calculate pixels per day based on zoom level
  private calculatePixelsPerDay(): number {
    const config = TIME_SCALE_CONFIG[this.zoomLevel];
    const msPerDay = 24 * 60 * 60 * 1000;
    return (config.minPixelsPerUnit * msPerDay) / config.milliseconds;
  }
  
  // Set zoom level (without recalculating pixels per day)
  setZoomLevel(zoomLevel: TimeScale): void {
    this.zoomLevel = zoomLevel;
    // Don't recalculate pixelsPerDay here - it should be set explicitly via setPixelsPerDay
  }
  
  // Set pixels per day directly (for intermediate zoom steps)
  setPixelsPerDay(pixelsPerDay: number): void {
    log.info('TimeScaleEngine: Setting pixels per day', {
      oldValue: this.pixelsPerDay,
      newValue: pixelsPerDay,
      zoomLevel: this.zoomLevel
    });
    this.pixelsPerDay = pixelsPerDay;
  }
  
  // Get current zoom level
  getZoomLevel(): TimeScale {
    return this.zoomLevel;
  }
  
  // Get day width in pixels
  getDayWidth(): number {
    return this.pixelsPerDay;
  }
  
  // Set viewport width
  setViewportWidth(width: number): void {
    this.viewportWidth = width;
  }
  
  // Convert date to pixel position
  dateToPixel(date: Date, startDate: Date): number {
    const diffMs = differenceInMilliseconds(date, startDate);
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    return diffDays * this.pixelsPerDay;
  }
  
  // Convert pixel position to date
  pixelToDate(pixel: number, startDate: Date): Date {
    const days = pixel / this.pixelsPerDay;
    return addDays(startDate, days);
  }
  
  // Get visible date range for viewport
  getVisibleDateRange(scrollX: number, timelineStartDate: Date): DateRange {
    const startDate = this.pixelToDate(scrollX, timelineStartDate);
    const endDate = this.pixelToDate(scrollX + this.viewportWidth, timelineStartDate);
    
    return {
      start: startDate,
      end: endDate,
    };
  }
  
  // Get time units for the current scale
  getTimeUnits(dateRange: DateRange): Array<{
    date: Date;
    label: string;
    isWeekend?: boolean;
    isToday?: boolean;
    x: number;
    width: number;
  }> {
    const units: Array<{
      date: Date;
      label: string;
      isWeekend?: boolean;
      isToday?: boolean;
      x: number;
      width: number;
    }> = [];
    
    const today = new Date();
    let currentDate = this.getStartOfUnit(dateRange.start);
    const endDate = this.getEndOfUnit(dateRange.end);
    
    while (currentDate <= endDate) {
      const nextDate = this.getNextUnit(currentDate);
      const x = this.dateToPixel(currentDate, dateRange.start);
      const width = this.dateToPixel(nextDate, dateRange.start) - x;
      
      units.push({
        date: currentDate,
        label: this.formatUnitLabel(currentDate),
        isWeekend: this.zoomLevel === 'day' && isWeekend(currentDate),
        isToday: isSameDay(currentDate, today),
        x,
        width,
      });
      
      currentDate = nextDate;
    }
    
    return units;
  }
  
  // Get header units for two-level header
  getHeaderUnits(dateRange: DateRange): Array<{
    date: Date;
    label: string;
    x: number;
    width: number;
  }> {
    const units: Array<{
      date: Date;
      label: string;
      x: number;
      width: number;
    }> = [];
    
    const headerScale = this.getHeaderScale();
    if (!headerScale) return units;
    
    let currentDate = this.getStartOfHeaderUnit(dateRange.start, headerScale);
    const endDate = this.getEndOfHeaderUnit(dateRange.end, headerScale);
    
    while (currentDate <= endDate) {
      const nextDate = this.getNextHeaderUnit(currentDate, headerScale);
      const x = this.dateToPixel(currentDate, dateRange.start);
      const width = this.dateToPixel(nextDate, dateRange.start) - x;
      
      units.push({
        date: currentDate,
        label: this.formatHeaderLabel(currentDate, headerScale),
        x,
        width,
      });
      
      currentDate = nextDate;
    }
    
    return units;
  }
  
  // Get appropriate header scale based on current zoom
  private getHeaderScale(): TimeScale | null {
    switch (this.zoomLevel) {
      case 'hour': return 'day';
      case 'day': return 'month';
      case 'week': return 'month';
      case 'month': return 'year';
      case 'quarter': return 'year';
      case 'year': return null;
      default: return null;
    }
  }
  
  // Get start of unit based on scale
  private getStartOfUnit(date: Date): Date {
    switch (this.zoomLevel) {
      case 'hour': return startOfHour(date);
      case 'day': return startOfDay(date);
      case 'week': return startOfWeek(date, { weekStartsOn: 1 });
      case 'month': return startOfMonth(date);
      case 'quarter': return startOfQuarter(date);
      case 'year': return startOfYear(date);
    }
  }
  
  // Get end of unit based on scale
  private getEndOfUnit(date: Date): Date {
    switch (this.zoomLevel) {
      case 'hour': return endOfHour(date);
      case 'day': return endOfDay(date);
      case 'week': return endOfWeek(date, { weekStartsOn: 1 });
      case 'month': return endOfMonth(date);
      case 'quarter': return endOfQuarter(date);
      case 'year': return endOfYear(date);
    }
  }
  
  // Get next unit
  private getNextUnit(date: Date): Date {
    switch (this.zoomLevel) {
      case 'hour': return addHours(date, 1);
      case 'day': return addDays(date, 1);
      case 'week': return addWeeks(date, 1);
      case 'month': return addMonths(date, 1);
      case 'quarter': return addQuarters(date, 1);
      case 'year': return addYears(date, 1);
    }
  }
  
  // Format unit label
  private formatUnitLabel(date: Date): string {
    const config = TIME_SCALE_CONFIG[this.zoomLevel];
    return format(date, config.format);
  }
  
  // Header unit helpers
  private getStartOfHeaderUnit(date: Date, scale: TimeScale): Date {
    switch (scale) {
      case 'hour': return startOfHour(date);
      case 'day': return startOfDay(date);
      case 'week': return startOfWeek(date, { weekStartsOn: 1 });
      case 'month': return startOfMonth(date);
      case 'quarter': return startOfQuarter(date);
      case 'year': return startOfYear(date);
    }
  }
  
  private getEndOfHeaderUnit(date: Date, scale: TimeScale): Date {
    switch (scale) {
      case 'hour': return endOfHour(date);
      case 'day': return endOfDay(date);
      case 'week': return endOfWeek(date, { weekStartsOn: 1 });
      case 'month': return endOfMonth(date);
      case 'quarter': return endOfQuarter(date);
      case 'year': return endOfYear(date);
    }
  }
  
  private getNextHeaderUnit(date: Date, scale: TimeScale): Date {
    switch (scale) {
      case 'hour': return addHours(date, 1);
      case 'day': return addDays(date, 1);
      case 'week': return addWeeks(date, 1);
      case 'month': return addMonths(date, 1);
      case 'quarter': return addQuarters(date, 1);
      case 'year': return addYears(date, 1);
    }
  }
  
  private formatHeaderLabel(date: Date, scale: TimeScale): string {
    const config = TIME_SCALE_CONFIG[scale];
    
    // Special case: when month scale is used as header for day/week scales,
    // show month names instead of the month scale's own headerFormat (which is years)
    if (scale === 'month' && (this.zoomLevel === 'day' || this.zoomLevel === 'week')) {
      return format(date, 'MMMM yyyy'); // "January 2024"
    }
    
    return format(date, config.headerFormat || config.format);
  }
  
  // Calculate optimal date range for initial view
  calculateOptimalDateRange(tasks: Array<{ plannedStartDate: Date; plannedEndDate: Date }>): DateRange {
    if (tasks.length === 0) {
      const now = new Date();
      return {
        start: startOfMonth(now),
        end: endOfMonth(addMonths(now, 3)),
      };
    }
    
    // Find min and max dates
    let minDate = tasks[0].plannedStartDate;
    let maxDate = tasks[0].plannedEndDate;
    
    for (const task of tasks) {
      if (task.plannedStartDate < minDate) minDate = task.plannedStartDate;
      if (task.plannedEndDate > maxDate) maxDate = task.plannedEndDate;
    }
    
    // Add padding
    const paddingDays = differenceInDays(maxDate, minDate) * 0.1;
    
    return {
      start: addDays(minDate, -paddingDays),
      end: addDays(maxDate, paddingDays),
    };
  }
  
  // Zoom to fit all tasks
  calculateZoomToFit(dateRange: DateRange, viewportWidth: number): number {
    const totalDays = differenceInDays(dateRange.end, dateRange.start);
    return viewportWidth / totalDays;
  }
}
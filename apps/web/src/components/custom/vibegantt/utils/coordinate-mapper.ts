import type { GanttTask, TaskDependency, TimeScale } from '../types';
import { TIME_SCALE_CONFIG, ZOOM_UTILS } from '../constants';

// Coordinate mapping for pre-calculated positions
export interface CoordinateMapping {
  tasks: Array<{
    taskId: string;
    rowIndex: number;
    yPosition: number;
    xPosition: number;
    width: number;
    height: number;
  }>;
  timeline: {
    segments: Array<{
      date: Date;
      xPosition: number;
      width: number;
      label: string;
      isMonth?: boolean;
      isWeek?: boolean;
    }>;
    totalWidth: number;
    dayWidth: number;
    hideSecondRow?: boolean;
  };
  viewport: {
    startDate: Date;
    endDate: Date;
    visibleTaskIds: Set<string>;
  };
  version: number;
}

interface CalculateCoordinatesParams {
  taskTree: any[];
  expandedTasks: Set<string>;
  visibleDateRange: { start: Date; end: Date };
  zoomLevel?: TimeScale; // Optional, for backwards compatibility
  zoomFactor?: number; // Optional, for backwards compatibility
  zoom?: number; // New continuous zoom parameter
  rowHeight?: number;
  dayWidth?: number;
}

/**
 * Calculate coordinate mapping from task tree
 * Following VibeGridDex pattern - pre-calculate all positions
 */
export function calculateCoordinateMapping({
  taskTree,
  expandedTasks,
  visibleDateRange,
  zoomLevel,
  zoomFactor = 1.0,
  zoom,
  rowHeight = 40,
  dayWidth: customDayWidth,
}: CalculateCoordinatesParams): CoordinateMapping {
  // Ensure dates are valid Date objects (handle both Date objects and ISO strings)
  const parseDate = (date: any): Date => {
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date;
    } else if (typeof date === 'string') {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime()) ? parsed : new Date();
    }
    return new Date();
  };
  
  const validStart = parseDate(visibleDateRange.start);
  const validEnd = parseDate(visibleDateRange.end);
    
  // Determine zoom parameters
  let effectiveZoom: number;
  let displayScale: TimeScale;
  
  if (zoom !== undefined) {
    // Use new continuous zoom
    effectiveZoom = zoom;
    displayScale = ZOOM_UTILS.getTimescaleForZoom(zoom);
  } else {
    // Fallback to old zoomLevel + zoomFactor
    displayScale = zoomLevel;
    effectiveZoom = 1.0; // Default
  }
  
  console.log('📐 Calculating coordinate mapping', {
    taskCount: taskTree.length,
    zoom: effectiveZoom,
    displayScale,
    dateRange: visibleDateRange,
    dateRangeDetails: {
      start: validStart,
      end: validEnd,
      startStr: validStart.toISOString(),
      endStr: validEnd.toISOString()
    }
  });

  // Calculate timeline bounds with padding
  const startDate = new Date(validStart);
  const endDate = new Date(validEnd);
  
  // Add padding - fixed 5 days as requested
  const paddingDays = 5;
  
  startDate.setDate(startDate.getDate() - paddingDays);
  endDate.setDate(endDate.getDate() + paddingDays);
  
  // Calculate day width based on zoom
  const adjustedDayWidth = customDayWidth || ZOOM_UTILS.getPixelsPerDayForZoom(effectiveZoom);
  
  // Calculate timeline segments with continuous scaling
  const timelineSegments = calculateContinuousTimelineSegments(
    startDate,
    endDate,
    effectiveZoom,
    adjustedDayWidth
  );
  
  // Calculate task positions
  const visibleTasks: GanttTask[] = [];
  const taskCoordinates: CoordinateMapping['tasks'] = [];
  
  // Flatten task tree respecting expanded state
  const flattenTasks = (tasks: any[], level = 0, rowIndex = { current: 0 }) => {
    tasks.forEach(task => {
      // Add task to visible list
      visibleTasks.push(task);
      
      // Calculate task coordinates using the correct field names
      const taskStart = task.startDate ? new Date(task.startDate) : null;
      const taskEnd = task.dueDate ? new Date(task.dueDate) : null;
      
      // Log first few tasks to debug date issue
      if (rowIndex.current < 3) {
        console.log(`📐 Task ${rowIndex.current}: ${task.title}`, {
          task: {
            id: task.id,
            startDate: task.startDate,
            dueDate: task.dueDate,
            hasStartDate: !!task.startDate,
            hasDueDate: !!task.dueDate
          },
          parsed: {
            startValid: taskStart && !isNaN(taskStart.getTime()),
            endValid: taskEnd && !isNaN(taskEnd.getTime())
          }
        });
      }
      
      // Skip tasks without dates or with invalid dates
      if (!taskStart || !taskEnd || isNaN(taskStart.getTime()) || isNaN(taskEnd.getTime())) {
        console.warn(`⚠️ Skipping task without valid dates: ${task.id}`, {
          title: task.title,
          startDate: task.startDate,
          dueDate: task.dueDate
        });
        rowIndex.current++;
        return;
      }
      
      // Calculate x position and width
      const daysSinceStart = Math.floor((taskStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const taskDuration = Math.floor((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      const xPosition = daysSinceStart * adjustedDayWidth;
      const width = taskDuration * adjustedDayWidth;
      const yPosition = rowIndex.current * rowHeight;
      
      taskCoordinates.push({
        taskId: task.id,
        rowIndex: rowIndex.current,
        yPosition,
        xPosition,
        width: Math.max(width, 20), // Minimum width
        height: rowHeight - 4, // Small gap between rows
      });
      
      rowIndex.current++;
      
      // Process children if expanded
      if (task.children && task.children.length > 0 && expandedTasks.has(task.id)) {
        flattenTasks(task.children, level + 1, rowIndex);
      }
    });
  };
  
  flattenTasks(taskTree);
  
  // Calculate total timeline width
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalWidth = totalDays * adjustedDayWidth;
  
  return {
    tasks: taskCoordinates,
    timeline: {
      segments: timelineSegments,
      totalWidth,
      dayWidth: adjustedDayWidth,
      hideSecondRow: timelineSegments.hideSecondRow,
    },
    viewport: {
      startDate,
      endDate,
      visibleTaskIds: new Set(visibleTasks.map(t => t.id)),
    },
    version: Date.now(),
  };
}

/**
 * Calculate continuous timeline segments based on zoom level
 * No discrete switching - purely based on zoom scale
 */
function calculateContinuousTimelineSegments(
  startDate: Date,
  endDate: Date,
  zoom: number,
  dayWidth: number
): CoordinateMapping['timeline']['segments'] & { hideSecondRow?: boolean } {
  const segments: CoordinateMapping['timeline']['segments'] = [];
  const currentDate = new Date(startDate);
  let xPosition = 0;
  
  // Calculate pixels per day to determine appropriate segment spacing
  const pixelsPerDay = dayWidth;
  
  // Determine segment configuration based on pixel density
  let segmentIncrement: number;
  let segmentWidth: number;
  let segmentUnit: 'day' | 'week' | 'month' | 'quarter' | 'year';
  
  if (pixelsPerDay >= 15) {
    // Very zoomed in - show individual days
    segmentIncrement = 1;
    segmentWidth = dayWidth;
    segmentUnit = 'day';
  } else if (pixelsPerDay >= 5) {
    // Medium zoom - show weeks (raised threshold for earlier transition)
    segmentIncrement = 7;
    segmentWidth = dayWidth * 7;
    segmentUnit = 'week';
  } else if (pixelsPerDay >= 1.5) {
    // Zoomed out - show months (raised threshold)
    segmentIncrement = 30;
    segmentWidth = dayWidth * 30;
    segmentUnit = 'month';
  } else if (pixelsPerDay >= 0.4) {
    // More zoomed out - show quarters (raised threshold)
    segmentIncrement = 90;
    segmentWidth = dayWidth * 90;
    segmentUnit = 'quarter';
  } else {
    // Very zoomed out - show years
    segmentIncrement = 365;
    segmentWidth = dayWidth * 365;
    segmentUnit = 'year';
  }
  
  // Only show labels if segments are wide enough to be readable
  const minLabelWidth = 15; // Lower threshold to show day labels during transition
  const showLabels = segmentWidth >= minLabelWidth;
  
  // Hide second timeline row when zoomed out enough (months, quarters and years)
  const hideSecondRow = segmentUnit === 'month' || segmentUnit === 'quarter' || segmentUnit === 'year';
  
  while (currentDate <= endDate) {
    const segment = {
      date: new Date(currentDate),
      xPosition,
      width: segmentWidth,
      label: showLabels ? formatDateLabel(currentDate, segmentUnit) : '',
      isMonth: segmentUnit === 'month',
      isWeek: segmentUnit === 'week',
    };
    
    segments.push(segment);
    xPosition += segmentWidth;
    
    // Increment date by the segment increment with proper date handling
    if (segmentUnit === 'month') {
      // Move to start of next month to avoid duplicates
      currentDate.setMonth(currentDate.getMonth() + 1);
      currentDate.setDate(1); // Ensure we're at the start of the month
    } else if (segmentUnit === 'quarter') {
      // Move to start of next quarter
      currentDate.setMonth(currentDate.getMonth() + 3);
      currentDate.setDate(1);
    } else if (segmentUnit === 'year') {
      // Move to start of next year
      currentDate.setFullYear(currentDate.getFullYear() + 1);
      currentDate.setMonth(0);
      currentDate.setDate(1);
    } else {
      // Days or weeks - just add the increment
      currentDate.setDate(currentDate.getDate() + segmentIncrement);
    }
  }
  
  // Return segments with metadata about whether to hide second row
  return Object.assign(segments, { hideSecondRow });
}

/**
 * Format date label based on the display unit
 */
function formatDateLabel(date: Date, unit: 'day' | 'week' | 'month' | 'quarter' | 'year'): string {
  switch (unit) {
    case 'day':
      return date.getDate().toString();
    case 'week':
      return `W${getWeekNumber(date)}`;
    case 'month':
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    case 'quarter':
      return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
    case 'year':
      return date.getFullYear().toString();
    default:
      return date.getDate().toString();
  }
}

/**
 * Get week number of the year
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get days in month
 */
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
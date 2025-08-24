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
  zoom: TimeScale;
  zoomFactor?: number;
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
  zoom,
  zoomFactor = 1.0,
  rowHeight = 48,
  dayWidth = 50,
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
    
  console.log('📐 Calculating coordinate mapping', {
    taskCount: taskTree.length,
    zoom,
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
  
  // Add padding days
  startDate.setDate(startDate.getDate() - 7);
  endDate.setDate(endDate.getDate() + 7);
  
  // Use the dayWidth directly - it's already calculated by the machine
  // The machine handles zoom calculations and sends us the final dayWidth
  const adjustedDayWidth = dayWidth;
  
  console.log('📐 Using dayWidth from machine:', {
    receivedDayWidth: dayWidth,
    adjustedDayWidth,
    zoomFactor
  });
  
  // Calculate timeline segments
  const timelineSegments = calculateTimelineSegments(
    startDate,
    endDate,
    zoom,
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
        height: rowHeight - 20, // Increased gap between rows for dependency visibility
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
 * Calculate timeline segments based on zoom level for display
 * IMPORTANT: Keep segments as daily intervals to maintain coordinate consistency
 * Only change the labels based on zoom level to avoid cramped display
 */
function calculateTimelineSegments(
  startDate: Date,
  endDate: Date,
  zoom: TimeScale,
  dayWidth: number
): CoordinateMapping['timeline']['segments'] {
  const segments: CoordinateMapping['timeline']['segments'] = [];
  const currentDate = new Date(startDate);
  let xPosition = 0;
  
  // Choose label granularity based on dayWidth to avoid cramped display
  // BUT keep segments as daily for coordinate consistency
  let labelType: 'day' | 'week' | 'month' = 'day';
  if (dayWidth < 15) {
    labelType = 'month';
  } else if (dayWidth < 35) {
    labelType = 'week';
  }
  
  console.log('📅 Timeline label mode:', { 
    dayWidth: `${dayWidth}px`, 
    labelType,
    reason: dayWidth < 15 ? 'Too cramped - showing months' : 
            dayWidth < 35 ? 'Moderate zoom - showing weeks' : 
            'Wide zoom - showing days'
  });
  
  while (currentDate <= endDate) {
    const segment = {
      date: new Date(currentDate),
      xPosition,
      width: dayWidth, // Always use dayWidth for consistent coordinates
      label: '',
      isMonth: false,
      isWeek: false,
    };
    
    // Set label based on display granularity but keep daily segments
    switch (labelType) {
      case 'day':
        segment.label = currentDate.getDate().toString();
        break;
      case 'week':
        // Only show label on Mondays or first day of timeline
        if (currentDate.getDay() === 1 || currentDate.getTime() === startDate.getTime()) {
          segment.label = `W${getWeekNumber(currentDate)}`;
          segment.isWeek = true;
        }
        break;
      case 'month':
        // Only show label on first of month or first day of timeline
        if (currentDate.getDate() === 1 || currentDate.getTime() === startDate.getTime()) {
          segment.label = currentDate.toLocaleDateString('en-US', { month: 'short' });
          segment.isMonth = true;
        }
        break;
    }
    
    segments.push(segment);
    xPosition += dayWidth;
    
    // Always increment by one day to maintain coordinate consistency
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(`Generated ${segments.length} daily segments with ${labelType} labels`);
  return segments;
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
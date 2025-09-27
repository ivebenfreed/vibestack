import type { GanttTask, TaskDependency, DateRange, TimeScale, TaskPosition, DependencyPath } from '../types';

// Time scale configurations
export const TIME_SCALE_CONFIG = {
  hour: { pixelsPerUnit: 24, unit: 'hour' },
  day: { pixelsPerUnit: 24, unit: 'day' },
  week: { pixelsPerUnit: 120, unit: 'week' },
  month: { pixelsPerUnit: 240, unit: 'month' }
} as const;

export const GANTT_CONSTANTS = {
  ROW_HEIGHT: 40,
  TASK_BAR_HEIGHT: 24,
  TASK_BAR_MARGIN: 8,
  MIN_TASK_WIDTH: 12,
  DEPENDENCY_OFFSET: 12,
  TIME_HEADER_HEIGHT: 60
};

// Date utility functions
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getDaysBetween(startDate: Date, endDate: Date): number {
  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getWeeksBetween(startDate: Date, endDate: Date): number {
  return Math.ceil(getDaysBetween(startDate, endDate) / 7);
}

export function getMonthsBetween(startDate: Date, endDate: Date): number {
  const months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
  return months - startDate.getMonth() + endDate.getMonth();
}

// Timeline calculations
export function calculateTimelineWidth(dateRange: DateRange, timeScale: TimeScale, zoomLevel: number): number {
  const { pixelsPerUnit } = TIME_SCALE_CONFIG[timeScale];
  let units: number;

  switch (timeScale) {
    case 'hour':
      units = getDaysBetween(dateRange.start, dateRange.end) * 24;
      break;
    case 'day':
      units = getDaysBetween(dateRange.start, dateRange.end);
      break;
    case 'week':
      units = getWeeksBetween(dateRange.start, dateRange.end);
      break;
    case 'month':
      units = getMonthsBetween(dateRange.start, dateRange.end);
      break;
    default:
      units = getDaysBetween(dateRange.start, dateRange.end);
  }

  return Math.max(1000, units * pixelsPerUnit * zoomLevel);
}

// Task position calculations
export function calculateTaskPosition(
  task: GanttTask,
  dateRange: DateRange,
  timeScale: TimeScale,
  zoomLevel: number,
  rowIndex: number
): TaskPosition {
  const taskStart = new Date(task.startDate);
  const taskEnd = new Date(task.dueDate);
  const { pixelsPerUnit } = TIME_SCALE_CONFIG[timeScale];

  let x: number;
  let width: number;

  switch (timeScale) {
    case 'hour':
      const startHours = (taskStart.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60);
      const durationHours = (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60);
      x = startHours * pixelsPerUnit * zoomLevel;
      width = Math.max(GANTT_CONSTANTS.MIN_TASK_WIDTH, durationHours * pixelsPerUnit * zoomLevel);
      break;

    case 'day':
      const startDays = getDaysBetween(dateRange.start, taskStart);
      const durationDays = getDaysBetween(taskStart, taskEnd);
      x = startDays * pixelsPerUnit * zoomLevel;
      width = Math.max(GANTT_CONSTANTS.MIN_TASK_WIDTH, durationDays * pixelsPerUnit * zoomLevel);
      break;

    case 'week':
      const startWeeks = getWeeksBetween(dateRange.start, taskStart);
      const durationWeeks = getWeeksBetween(taskStart, taskEnd);
      x = startWeeks * pixelsPerUnit * zoomLevel;
      width = Math.max(GANTT_CONSTANTS.MIN_TASK_WIDTH, durationWeeks * pixelsPerUnit * zoomLevel);
      break;

    case 'month':
      const startMonths = getMonthsBetween(dateRange.start, taskStart);
      const durationMonths = getMonthsBetween(taskStart, taskEnd);
      x = startMonths * pixelsPerUnit * zoomLevel;
      width = Math.max(GANTT_CONSTANTS.MIN_TASK_WIDTH, durationMonths * pixelsPerUnit * zoomLevel);
      break;

    default:
      x = 0;
      width = GANTT_CONSTANTS.MIN_TASK_WIDTH;
  }

  return {
    taskId: task.id,
    x: Math.max(0, x),
    width,
    y: (rowIndex + 1) * GANTT_CONSTANTS.ROW_HEIGHT, // +1 to account for header row
    title: task.title,
    progress: task.progress
  };
}

// Calculate all task positions
export function calculateAllTaskPositions(
  tasks: GanttTask[],
  dateRange: DateRange,
  timeScale: TimeScale,
  zoomLevel: number
): TaskPosition[] {
  return tasks.map((task, index) =>
    calculateTaskPosition(task, dateRange, timeScale, zoomLevel, index)
  );
}

// Dependency path calculations
export function calculateDependencyPath(
  dependency: TaskDependency,
  taskPositions: TaskPosition[]
): DependencyPath {
  const predecessorPos = taskPositions.find(pos => pos.taskId === dependency.predecessorId);
  const successorPos = taskPositions.find(pos => pos.taskId === dependency.successorId);

  if (!predecessorPos || !successorPos) {
    return {
      id: dependency.id,
      points: '',
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId
    };
  }

  const { type } = dependency;
  let startX: number, startY: number, endX: number, endY: number;

  const taskBarHeight = GANTT_CONSTANTS.TASK_BAR_HEIGHT;
  const taskBarMargin = GANTT_CONSTANTS.TASK_BAR_MARGIN;
  const yOffset = taskBarMargin + taskBarHeight / 2;

  switch (type) {
    case 'finish-to-start':
      startX = predecessorPos.x + predecessorPos.width;
      startY = predecessorPos.y + yOffset;
      endX = successorPos.x;
      endY = successorPos.y + yOffset;
      break;

    case 'start-to-start':
      startX = predecessorPos.x;
      startY = predecessorPos.y + yOffset;
      endX = successorPos.x;
      endY = successorPos.y + yOffset;
      break;

    case 'finish-to-finish':
      startX = predecessorPos.x + predecessorPos.width;
      startY = predecessorPos.y + yOffset;
      endX = successorPos.x + successorPos.width;
      endY = successorPos.y + yOffset;
      break;

    case 'start-to-finish':
      startX = predecessorPos.x;
      startY = predecessorPos.y + yOffset;
      endX = successorPos.x + successorPos.width;
      endY = successorPos.y + yOffset;
      break;

    default:
      startX = startY = endX = endY = 0;
  }

  // Create path with elbow connector
  const midX = startX + (endX - startX) / 2;
  const pathData = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;

  return {
    id: dependency.id,
    points: pathData,
    predecessorId: dependency.predecessorId,
    successorId: dependency.successorId
  };
}

// Calculate all dependency paths
export function calculateAllDependencyPaths(
  dependencies: TaskDependency[],
  taskPositions: TaskPosition[]
): DependencyPath[] {
  return dependencies.map(dep => calculateDependencyPath(dep, taskPositions));
}

// Time markers generation
export function generateTimeMarkers(
  dateRange: DateRange,
  timeScale: TimeScale,
  zoomLevel: number
): Array<{ position: number; label: string; type: 'major' | 'minor' }> {
  const markers: Array<{ position: number; label: string; type: 'major' | 'minor' }> = [];
  const { pixelsPerUnit } = TIME_SCALE_CONFIG[timeScale];

  let current = new Date(dateRange.start);
  let position = 0;

  while (current <= dateRange.end) {
    let label: string;
    let type: 'major' | 'minor' = 'major';

    switch (timeScale) {
      case 'hour':
        label = current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        type = current.getHours() % 12 === 0 ? 'major' : 'minor';
        current.setHours(current.getHours() + 1);
        break;

      case 'day':
        label = current.toLocaleDateString([], { month: 'short', day: 'numeric' });
        type = current.getDay() === 1 ? 'major' : 'minor'; // Monday is major
        current.setDate(current.getDate() + 1);
        break;

      case 'week':
        label = `Week ${getWeekNumber(current)}`;
        type = current.getDate() <= 7 ? 'major' : 'minor'; // First week of month is major
        current.setDate(current.getDate() + 7);
        break;

      case 'month':
        label = current.toLocaleDateString([], { month: 'short', year: 'numeric' });
        type = current.getMonth() % 3 === 0 ? 'major' : 'minor'; // Quarterly major
        current.setMonth(current.getMonth() + 1);
        break;
    }

    markers.push({ position: position * zoomLevel, label, type });
    position += pixelsPerUnit;
  }

  return markers;
}

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Drag and drop calculations
export function calculateDateFromPosition(
  position: number,
  dateRange: DateRange,
  timeScale: TimeScale,
  zoomLevel: number
): Date {
  const { pixelsPerUnit } = TIME_SCALE_CONFIG[timeScale];
  const units = position / (pixelsPerUnit * zoomLevel);

  switch (timeScale) {
    case 'hour':
      return new Date(dateRange.start.getTime() + units * 60 * 60 * 1000);
    case 'day':
      return addDays(dateRange.start, units);
    case 'week':
      return addDays(dateRange.start, units * 7);
    case 'month':
      const result = new Date(dateRange.start);
      result.setMonth(result.getMonth() + units);
      return result;
    default:
      return dateRange.start;
  }
}

export function snapToTimeScale(date: Date, timeScale: TimeScale): Date {
  const snapped = new Date(date);

  switch (timeScale) {
    case 'hour':
      snapped.setMinutes(0, 0, 0);
      break;
    case 'day':
      snapped.setHours(0, 0, 0, 0);
      break;
    case 'week':
      const dayOfWeek = snapped.getDay();
      snapped.setDate(snapped.getDate() - dayOfWeek + 1); // Snap to Monday
      snapped.setHours(0, 0, 0, 0);
      break;
    case 'month':
      snapped.setDate(1);
      snapped.setHours(0, 0, 0, 0);
      break;
  }

  return snapped;
}
import {
  differenceInDays,
  differenceInHours,
  differenceInWeeks,
  differenceInMonths,
  differenceInQuarters,
  differenceInYears,
  addDays,
  addHours,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
  isWeekend,
  isSameDay,
  startOfDay,
  endOfDay,
  format,
} from 'date-fns';
import type { TimeScale } from '../types';

// Calculate working days between two dates (excluding weekends)
export function getWorkingDaysBetween(startDate: Date, endDate: Date): number {
  let workingDays = 0;
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    if (!isWeekend(currentDate)) {
      workingDays++;
    }
    currentDate = addDays(currentDate, 1);
  }
  
  return workingDays;
}

// Add working days to a date (skipping weekends)
export function addWorkingDays(date: Date, days: number): Date {
  let result = new Date(date);
  let daysToAdd = Math.abs(days);
  const direction = days < 0 ? -1 : 1;
  
  while (daysToAdd > 0) {
    result = addDays(result, direction);
    if (!isWeekend(result)) {
      daysToAdd--;
    }
  }
  
  return result;
}

// Calculate task duration based on time scale
export function getTaskDuration(startDate: Date, endDate: Date, scale: TimeScale): number {
  switch (scale) {
    case 'hour':
      return differenceInHours(endDate, startDate);
    case 'day':
      return differenceInDays(endDate, startDate);
    case 'week':
      return differenceInWeeks(endDate, startDate);
    case 'month':
      return differenceInMonths(endDate, startDate);
    case 'quarter':
      return differenceInQuarters(endDate, startDate);
    case 'year':
      return differenceInYears(endDate, startDate);
  }
}

// Format duration for display
export function formatDuration(days: number): string {
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  
  if (weeks === 1 && remainingDays === 0) return '1 week';
  if (remainingDays === 0) return `${weeks} weeks`;
  if (weeks === 1) return `1 week, ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
  
  return `${weeks} weeks, ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
}

// Calculate task progress based on dates
export function calculateProgressFromDates(
  plannedStart: Date,
  plannedEnd: Date,
  actualStart?: Date,
  actualEnd?: Date,
  today: Date = new Date()
): number {
  // If task is completed
  if (actualEnd) {
    return 100;
  }
  
  // If task hasn't started
  if (!actualStart || actualStart > today) {
    return 0;
  }
  
  // Calculate progress based on elapsed time
  const totalDuration = differenceInDays(plannedEnd, plannedStart);
  const elapsedDuration = differenceInDays(today, actualStart);
  
  if (totalDuration === 0) return 100;
  
  const progress = (elapsedDuration / totalDuration) * 100;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

// Apply task constraints
export function applyTaskConstraints(
  task: { plannedStartDate: Date; plannedEndDate: Date },
  constraints?: Array<{ type: string; date: Date }>
): { startDate: Date; endDate: Date } {
  let startDate = new Date(task.plannedStartDate);
  let endDate = new Date(task.plannedEndDate);
  
  if (!constraints) return { startDate, endDate };
  
  for (const constraint of constraints) {
    switch (constraint.type) {
      case 'must-start-on':
        startDate = new Date(constraint.date);
        endDate = addDays(startDate, differenceInDays(task.plannedEndDate, task.plannedStartDate));
        break;
        
      case 'must-finish-on':
        endDate = new Date(constraint.date);
        startDate = addDays(endDate, -differenceInDays(task.plannedEndDate, task.plannedStartDate));
        break;
        
      case 'start-no-earlier-than':
        if (startDate < constraint.date) {
          const shift = differenceInDays(constraint.date, startDate);
          startDate = new Date(constraint.date);
          endDate = addDays(endDate, shift);
        }
        break;
        
      case 'finish-no-later-than':
        if (endDate > constraint.date) {
          const shift = differenceInDays(endDate, constraint.date);
          endDate = new Date(constraint.date);
          startDate = addDays(startDate, -shift);
        }
        break;
    }
  }
  
  return { startDate, endDate };
}

// Format date for display based on scale
export function formatDateForScale(date: Date, scale: TimeScale): string {
  switch (scale) {
    case 'hour':
      return format(date, 'HH:mm');
    case 'day':
      return format(date, 'MMM d');
    case 'week':
      return format(date, 'MMM d');
    case 'month':
      return format(date, 'MMM yyyy');
    case 'quarter':
      return `Q${Math.floor(date.getMonth() / 3) + 1} ${format(date, 'yyyy')}`;
    case 'year':
      return format(date, 'yyyy');
  }
}

// Check if two date ranges overlap
export function dateRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2;
}

// Merge overlapping date ranges
export function mergeDateRanges(
  ranges: Array<{ start: Date; end: Date }>
): Array<{ start: Date; end: Date }> {
  if (ranges.length === 0) return [];
  
  // Sort by start date
  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  
  const merged: Array<{ start: Date; end: Date }> = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    
    if (dateRangesOverlap(last.start, last.end, current.start, current.end)) {
      // Merge ranges
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      // Add new range
      merged.push(current);
    }
  }
  
  return merged;
}
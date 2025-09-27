// VibeGantt - Modern Gantt Chart Component
// Built with Legend State observables and mock data

export { VibeGantt } from './VibeGantt';
export { createVibeGanttCore$ } from './stores/gantt-core';
export { mockData$ } from './stores/mock-data';

// Types
export type {
  VibeGanttProps,
  GanttTask,
  TaskDependency,
  TaskPosition,
  DependencyPath,
  TimeScale,
  DateRange,
  GanttViewState
} from './types';

// Utils
export {
  calculateTimelineWidth,
  calculateAllTaskPositions,
  calculateAllDependencyPaths,
  generateTimeMarkers,
  calculateDateFromPosition,
  snapToTimeScale,
  GANTT_CONSTANTS
} from './utils/calculations';
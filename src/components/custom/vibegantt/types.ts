// VibeGantt Types
export interface GanttTask {
  id: string;
  title: string;
  startDate: string; // ISO string
  dueDate: string;   // ISO string
  progress: number;  // 0-100
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high';
  description?: string;
  parentId?: string; // For subtasks
}

export interface TaskDependency {
  id: string;
  predecessorId: string;
  successorId: string;
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
  lagDays?: number;
}

export type TimeScale = 'hour' | 'day' | 'week' | 'month';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TaskPosition {
  taskId: string;
  x: number;
  width: number;
  y: number;
  title: string;
  progress: number;
}

export interface DependencyPath {
  id: string;
  points: string; // SVG path string
  predecessorId: string;
  successorId: string;
}

export interface VibeGanttProps {
  tableId: string;
  height?: number;
  width?: string;
  className?: string;
  enableDragAndDrop?: boolean;
  enableDependencies?: boolean;
  enableZoom?: boolean;
  onTaskUpdate?: (taskId: string, updates: Partial<GanttTask>) => void;
  onTaskCreate?: (task: Partial<GanttTask>) => void;
  onTaskDelete?: (taskId: string) => void;
  onDependencyCreate?: (dependency: Omit<TaskDependency, 'id'>) => void;
  onDependencyDelete?: (dependencyId: string) => void;
}

export interface GanttViewState {
  zoomLevel: number;
  timeScale: TimeScale;
  dateRange: DateRange;
  scrollLeft: number;
  scrollTop: number;
  selectedTaskId?: string;
  selectedDependencyId?: string;
  hoveredTaskId?: string;
  isDragging: boolean;
  dragTaskId?: string;
}
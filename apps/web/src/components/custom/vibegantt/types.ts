// Core Gantt Types
export interface GanttTask {
  id: string;
  name: string;
  plannedStartDate: Date;
  plannedEndDate: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  progress: number; // 0-100
  assigneeId?: string;
  parentId?: string; // For task hierarchy
  color?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  constraints?: TaskConstraint[];
  customFields?: Record<string, any>;
  rowIndex?: number; // For positioning
  level?: number; // For hierarchy indentation
}

export interface TaskDependency {
  id: string;
  entityType: 'Task';
  predecessorId: string;
  successorId: string;
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
  lagDays?: number; // Days
  metadata?: Record<string, any>;
  description?: string;
}

export interface TaskConstraint {
  type: 'must-start-on' | 'must-finish-on' | 'start-no-earlier-than' | 'finish-no-later-than';
  date: Date;
}

export interface Resource {
  id: string;
  name: string;
  type: 'person' | 'equipment' | 'material';
  availability: number; // Hours per day
  cost?: number; // Per hour
}

export interface ResourceAllocation {
  id: string;
  taskId: string;
  resourceId: string;
  allocation: number; // Percentage
  hours?: number;
}

// View Configuration
export type TimeScale = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface GanttViewConfig {
  timeRange: DateRange;
  zoomLevel: TimeScale;
  zoomFactor: number; // Multiplier for pixels per unit (0.5 to 2.0)
  showWeekends: boolean;
  showDependencies: boolean;
  showCriticalPath: boolean;
  showResources: boolean;
  showProgress: boolean;
  showToday: boolean;
  showBaseline: boolean;
  rowHeight: number;
  timeHeaderHeight: number;
  resourcePanelWidth: number;
  taskLabelWidth: number;
  minTaskWidth: number;
}

// Layout and Positioning
export interface TaskLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  labelX: number;
  progressWidth: number;
  isVisible: boolean;
  rowIndex: number;
}

export interface TimelineLayout {
  totalWidth: number;
  totalHeight: number;
  dayWidth: number;
  headerHeight: number;
  visibleStartX: number;
  visibleEndX: number;
}

// State Management
export interface ViewportState {
  scrollX: number;
  scrollY: number;
  width: number;
  height: number;
  zoom: number;
  visibleDateRange: DateRange;
  visibleTaskIds: Set<string>;
}

export interface SelectionState {
  selectedTaskIds: Set<string>;
  focusedTaskId: string | null;
  selectionMode: 'single' | 'multiple' | 'range';
}

export interface DragState {
  type: 'move' | 'resize-start' | 'resize-end' | 'create-dependency' | 'pan';
  taskId?: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  originalData?: any;
  preview?: DragPreview;
}

export interface HoverState {
  type: 'task' | 'dependency' | 'resize-handle' | 'timeline';
  elementId: string;
  x: number;
  y: number;
}

export interface DragPreview {
  element: HTMLElement;
  offsetX: number;
  offsetY: number;
}

// Rendering
export interface RenderCommand {
  type: 'task' | 'dependency' | 'timeline' | 'selection' | 'overlay';
  action: 'create' | 'update' | 'delete';
  data: any;
  priority: number;
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Machine Context
export interface GanttMachineContext {
  // Data
  tasks: Map<string, GanttTask>;
  dependencies: Map<string, TaskDependency>;
  resources: Map<string, Resource>;
  resourceAllocations: Map<string, ResourceAllocation>;
  
  // View State
  viewConfig: GanttViewConfig;
  viewport: ViewportState;
  timelineLayout: TimelineLayout;
  
  // Interaction State
  selection: SelectionState;
  selectedDependencyIds?: Set<string>; // For tracking selected dependencies
  dragState: DragState | null;
  hoverState: HoverState | null;
  editingTaskId: string | null;
  
  // Computed
  criticalPath: Set<string>;
  taskLayout: Map<string, TaskLayout>;
  dependencyPaths: Map<string, SVGPathElement>;
  
  // Performance
  renderQueue: RenderCommand[];
  dirtyRegions: Set<Region>;
  lastRenderTime: number;
  frameRate: number;
  
  // UI State
  contextMenu: { x: number; y: number; taskId: string } | null;
  tooltip: { x: number; y: number; content: string } | null;
  
  // Actors
  renderer?: any; // Renderer actor
  dataStore?: any; // Data store actor
  storeActor?: any; // Store actor passed from parent
  
  // Domain service
  domainService?: any; // Domain service for write operations
  projectId?: string | null; // Project ID for data store
}

// Events
export type GanttEvent = 
  | { type: 'INITIALIZE'; tasks: GanttTask[]; dependencies: TaskDependency[] }
  | { type: 'TASKS_UPDATED'; tasks: GanttTask[] }
  | { type: 'DEPENDENCIES_UPDATED'; dependencies: TaskDependency[] }
  | { type: 'ZOOM'; level: TimeScale; factor?: number }
  | { type: 'PAN'; deltaX: number; deltaY: number }
  | { type: 'SCROLL'; scrollX: number; scrollY: number }
  | { type: 'TASK_SELECT'; taskId: string; multi?: boolean }
  | { type: 'TASK_DRAG_START'; taskId: string; x: number; y: number }
  | { type: 'TASK_DRAG_MOVE'; taskId?: string; x: number; y: number; deltaX?: number }
  | { type: 'TASK_DRAG_END'; taskId: string; deltaX?: number; newStartDate?: Date; newEndDate?: Date }
  | { type: 'TASK_RESIZE_START'; taskId: string; handle: 'start' | 'end'; x: number }
  | { type: 'TASK_RESIZE_MOVE'; taskId?: string; handle?: 'start' | 'end'; x: number; deltaX?: number }
  | { type: 'TASK_RESIZE_END'; taskId: string; handle: 'start' | 'end' | 'left' | 'right'; deltaX?: number; newStartDate?: Date; newEndDate?: Date }
  | { type: 'DEPENDENCY_CREATE_START'; sourceTaskId: string }
  | { type: 'DEPENDENCY_CREATE_END'; targetTaskId: string }
  | { type: 'DEPENDENCY_DELETE'; dependencyId: string }
  | { type: 'DEPENDENCY_SELECT'; dependencyId: string; multi?: boolean }
  | { type: 'DEPENDENCY_DRAG_START'; dependencyId: string; handleType: 'start' | 'end'; x: number; y: number }
  | { type: 'DEPENDENCY_REASSIGN'; dependencyId: string; handleType: 'start' | 'end'; newTaskId: string; originalPredecessorId: string; originalSuccessorId: string }
  | { type: 'VIEWPORT_RESIZE'; width: number; height: number }
  | { type: 'VIEW_CONFIG_UPDATE'; config: Partial<GanttViewConfig> }
  | { type: 'RENDER_FRAME'; commands?: RenderCommand[] }
  | { type: 'RENDER_COMPLETE'; metrics?: any }
  | { type: 'RENDER_ERROR'; error: Error }
  | { type: 'UPDATE_CONTEXT'; context: Partial<GanttMachineContext> }
  | { type: 'KEYBOARD_SHORTCUT'; key: string; modifiers: string[] }
  | { type: 'INITIALIZE_RENDERER'; options: { container: HTMLElement; width: number; height: number } }
  | { type: 'RENDERER_READY' }
  | { type: 'ESCAPE' }
  | { type: 'TOGGLE_TASK_EXPANDED'; taskId: string }
  | { type: 'SELECT_TASK'; taskId: string }
  | { type: 'MULTI_SELECT_TASK'; taskId: string }
  | { type: 'SET_ZOOM'; zoom: TimeScale }
  | { type: 'SET_VISIBLE_DATE_RANGE'; range: { start: Date; end: Date } };

// Component Props
export interface VibeGanttProps {
  tasks: GanttTask[];
  dependencies?: TaskDependency[];
  resources?: Resource[];
  viewConfig?: Partial<GanttViewConfig>;
  onTaskUpdate?: (task: GanttTask) => void;
  onTaskCreate?: (task: Partial<GanttTask>) => void;
  onTaskDelete?: (taskId: string) => void;
  onDependencyCreate?: (dependency: Partial<TaskDependency>) => void;
  onDependencyDelete?: (dependencyId: string) => void;
  className?: string;
  height?: number;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Milliseconds = number;
export type Pixels = number;

// Performance Metrics
export interface PerformanceMetrics {
  renderTime: Milliseconds;
  frameRate: number;
  taskCount: number;
  visibleTaskCount: number;
  memoryUsage: number;
}

// Export functionality
export interface ExportOptions {
  format: 'png' | 'svg' | 'pdf' | 'excel' | 'mpp';
  includeBaseline?: boolean;
  includeDependencies?: boolean;
  includeResources?: boolean;
  dateRange?: DateRange;
}
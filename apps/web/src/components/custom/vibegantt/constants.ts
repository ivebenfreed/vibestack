import type { TimeScale } from './types';

// Time scale configurations
export const TIME_SCALE_CONFIG = {
  hour: {
    label: 'Hour',
    milliseconds: 60 * 60 * 1000,
    minPixelsPerUnit: 50,
    maxPixelsPerUnit: 200,
    format: 'HH:mm',
    headerFormat: 'MMM dd, yyyy',
  },
  day: {
    label: 'Day',
    milliseconds: 24 * 60 * 60 * 1000,
    minPixelsPerUnit: 30,
    maxPixelsPerUnit: 150,
    format: 'dd', // Just show day numbers "01", "02", etc.
    headerFormat: 'MMMM yyyy', // Header shows "January 2024" once per month
  },
  week: {
    label: 'Week',
    milliseconds: 7 * 24 * 60 * 60 * 1000,
    minPixelsPerUnit: 100,
    maxPixelsPerUnit: 400,
    format: "'W'w",  // Just show "W1", "W2", etc.
    headerFormat: 'MMMM yyyy', // Header shows "January 2024" for each month
  },
  month: {
    label: 'Month',
    milliseconds: 30 * 24 * 60 * 60 * 1000, // Approximate
    minPixelsPerUnit: 80,
    maxPixelsPerUnit: 300,
    format: 'MMM yyyy', // Show "Jan 2024" for main timeline
    headerFormat: 'yyyy', // Show "2024" when month scale is the main scale
  },
  quarter: {
    label: 'Quarter',
    milliseconds: 91 * 24 * 60 * 60 * 1000, // Approximate
    minPixelsPerUnit: 150,
    maxPixelsPerUnit: 500,
    format: "'Q'q",  // Quarter format in date-fns requires quoting the Q
    headerFormat: 'yyyy',
  },
  year: {
    label: 'Year',
    milliseconds: 365 * 24 * 60 * 60 * 1000,
    minPixelsPerUnit: 200,
    maxPixelsPerUnit: 800,
    format: 'yyyy',
    headerFormat: '',
  },
} as const;

// Zoom levels in order from most detailed to least detailed
export const ZOOM_LEVELS: TimeScale[] = ['hour', 'day', 'week', 'month', 'quarter', 'year'];

// Zoom factor constraints
export const ZOOM_FACTOR_CONSTRAINTS = {
  MIN: 0.25,  // Minimum zoom factor (25% of base pixels per unit)
  MAX: 4.0,   // Maximum zoom factor (400% of base pixels per unit)
  STEP: 0.1,  // Step size for zoom factor changes
  TRANSITION_THRESHOLD: 0.5, // When to transition to next/prev time scale
} as const;

// Zoom utility functions
export const ZOOM_UTILS = {
  getNextZoomLevel(current: TimeScale, direction: 'in' | 'out'): TimeScale {
    const currentIndex = ZOOM_LEVELS.indexOf(current);
    if (currentIndex === -1) return 'day'; // fallback
    
    if (direction === 'in') {
      // Zoom in = more detailed (lower index)
      return ZOOM_LEVELS[Math.max(0, currentIndex - 1)];
    } else {
      // Zoom out = less detailed (higher index)
      return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, currentIndex + 1)];
    }
  },
  
  canZoom(current: TimeScale, direction: 'in' | 'out'): boolean {
    const currentIndex = ZOOM_LEVELS.indexOf(current);
    if (currentIndex === -1) return true;
    
    if (direction === 'in') {
      return currentIndex > 0; // Can zoom in if not at most detailed level
    } else {
      return currentIndex < ZOOM_LEVELS.length - 1; // Can zoom out if not at least detailed level
    }
  },
  
  // Calculate next zoom state with intermediate steps
  calculateNextZoom(
    currentLevel: TimeScale, 
    currentFactor: number, 
    direction: 'in' | 'out'
  ): { level: TimeScale; factor: number } {
    const { MIN, MAX, STEP, TRANSITION_THRESHOLD } = ZOOM_FACTOR_CONSTRAINTS;
    
    // Calculate new factor
    let newFactor = currentFactor + (direction === 'in' ? STEP : -STEP);
    let newLevel = currentLevel;
    
    // Use a lower threshold for zoom-in transitions to ensure they happen before MAX
    const ZOOM_IN_THRESHOLD = 3.5; // Transition when factor reaches 3.5 instead of 4.0
    
    // Check if we need to transition to a different time scale
    if (direction === 'in' && newFactor >= ZOOM_IN_THRESHOLD) {
      // Transition to more detailed time scale (zoom in further)
      if (this.canZoom(currentLevel, 'in')) {
        newLevel = this.getNextZoomLevel(currentLevel, 'in');
        newFactor = 1.0; // Start at neutral factor when transitioning to more detailed scale
      } else {
        newFactor = Math.min(MAX, newFactor); // Cap at max if can't transition
      }
    } else if (direction === 'out' && newFactor <= TRANSITION_THRESHOLD) {
      // Transition to less detailed time scale (zoom out further) when getting close to minimum
      if (this.canZoom(currentLevel, 'out')) {
        newLevel = this.getNextZoomLevel(currentLevel, 'out');
        newFactor = 1.0; // Start at neutral factor when transitioning to less detailed scale  
      } else {
        // Can't zoom out further, clamp to minimum
        newFactor = Math.max(MIN, newFactor);
      }
    }
    
    // Clamp factor to valid range (but allow transition logic above to override)
    if (newLevel === currentLevel) {
      newFactor = Math.max(MIN, Math.min(MAX, newFactor));
    }
    
    return { level: newLevel, factor: newFactor };
  },
  
  // Get actual pixels per unit considering zoom factor
  getPixelsPerUnit(level: TimeScale, factor: number): number {
    const config = TIME_SCALE_CONFIG[level];
    return config.minPixelsPerUnit * factor;
  },
  
  // Get pixels per day for any zoom level and factor
  getPixelsPerDay(level: TimeScale, factor: number): number {
    const config = TIME_SCALE_CONFIG[level];
    const pixelsPerUnit = config.minPixelsPerUnit * factor;
    const msPerDay = 24 * 60 * 60 * 1000;
    
    // Convert pixels per unit to pixels per day
    return (pixelsPerUnit * msPerDay) / config.milliseconds;
  }
} as const;

// Default view configuration
export const DEFAULT_VIEW_CONFIG = {
  timeRange: {
    start: new Date(),
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  },
  zoomLevel: 'day' as const,
  zoomFactor: 1.0, // Default zoom factor (no scaling)
  showWeekends: true,
  showDependencies: true,
  showCriticalPath: false,
  showResources: false,
  showProgress: true,
  showToday: true,
  showBaseline: false,
  rowHeight: 36,
  timeHeaderHeight: 60,
  resourcePanelWidth: 200,
  taskLabelWidth: 300,
  minTaskWidth: 20,
};

// Rendering constants
export const RENDER_CONFIG = {
  BUFFER_MULTIPLIER: 2, // Render 2x viewport for smooth scrolling
  VIRTUAL_SCROLL_OVERSCAN: 5, // Extra rows to render
  TASK_PADDING: 4,
  TASK_BORDER_RADIUS: 4,
  PROGRESS_BAR_HEIGHT: 4,
  RESIZE_HANDLE_WIDTH: 8,
  DEPENDENCY_ARROW_SIZE: 8,
  SELECTION_BORDER_WIDTH: 2,
  HIGHLIGHT_OPACITY: 0.2,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 10,
  ZOOM_STEP: 0.1,
  PAN_SPEED: 1,
  ANIMATION_DURATION: 200,
};

// Colors and themes
export const GANTT_COLORS = {
  // Task colors by priority
  priority: {
    low: '#94a3b8',
    medium: '#3b82f6',
    high: '#f59e0b',
    critical: '#ef4444',
  },
  // UI colors
  grid: {
    line: '#e5e7eb',
    weekend: '#f3f4f6',
    today: '#3b82f6',
    header: '#f9fafb',
  },
  task: {
    background: '#3b82f6',
    progress: '#1d4ed8',
    border: '#2563eb',
    text: '#ffffff',
    handle: '#1e40af',
  },
  dependency: {
    line: '#6b7280',
    arrow: '#4b5563',
    critical: '#ef4444',
  },
  selection: {
    border: '#3b82f6',
    background: 'rgba(59, 130, 246, 0.1)',
  },
};

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  MAX_VISIBLE_TASKS: 500,
  MAX_RENDER_TIME: 16, // Target 60fps
  DEBOUNCE_DELAY: 100,
  THROTTLE_DELAY: 16,
  CACHE_DURATION: 5000, // 5 seconds
};

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  // Navigation
  'ArrowUp': 'SELECT_PREVIOUS',
  'ArrowDown': 'SELECT_NEXT',
  'ArrowLeft': 'PAN_LEFT',
  'ArrowRight': 'PAN_RIGHT',
  'Home': 'GO_TO_START',
  'End': 'GO_TO_END',
  'PageUp': 'PAGE_UP',
  'PageDown': 'PAGE_DOWN',
  
  // Zoom
  'Ctrl+Plus': 'ZOOM_IN',
  'Ctrl+Minus': 'ZOOM_OUT',
  'Ctrl+0': 'ZOOM_RESET',
  
  // Selection
  'Ctrl+A': 'SELECT_ALL',
  'Escape': 'CLEAR_SELECTION',
  'Space': 'TOGGLE_SELECTION',
  
  // Actions
  'Enter': 'EDIT_TASK',
  'Delete': 'DELETE_TASK',
  'Ctrl+Z': 'UNDO',
  'Ctrl+Y': 'REDO',
  'Ctrl+C': 'COPY',
  'Ctrl+V': 'PASTE',
  'Ctrl+D': 'DUPLICATE',
  
  // View
  'Ctrl+L': 'TOGGLE_DEPENDENCIES',
  'Ctrl+P': 'TOGGLE_CRITICAL_PATH',
  'Ctrl+W': 'TOGGLE_WEEKENDS',
  'Ctrl+T': 'GO_TO_TODAY',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  INVALID_DATE_RANGE: 'End date must be after start date',
  CIRCULAR_DEPENDENCY: 'Circular dependency detected',
  RESOURCE_OVERALLOCATION: 'Resource is overallocated',
  CONSTRAINT_VIOLATION: 'Task violates constraint',
  INVALID_DEPENDENCY: 'Invalid dependency type',
} as const;

// Event names for analytics
export const GANTT_EVENTS = {
  TASK_CREATED: 'gantt_task_created',
  TASK_UPDATED: 'gantt_task_updated',
  TASK_DELETED: 'gantt_task_deleted',
  DEPENDENCY_CREATED: 'gantt_dependency_created',
  DEPENDENCY_DELETED: 'gantt_dependency_deleted',
  VIEW_CHANGED: 'gantt_view_changed',
  EXPORT_TRIGGERED: 'gantt_export_triggered',
} as const;
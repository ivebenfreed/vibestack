import type { TimeScale } from './types';

// Time scale configurations
export const TIME_SCALE_CONFIG = {
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
export const ZOOM_LEVELS: TimeScale[] = ['day', 'week', 'month', 'quarter', 'year'];

// Zoom scale - continuous scale where higher values = more zoomed in
export const ZOOM_SCALE = {
  MIN: 0.1,   // Minimum zoom (year view)
  MAX: 5.0,   // Maximum zoom (day view zoomed in)
  DEFAULT: 1.0, // Default zoom (week/month view)
  STEP: 0.2,  // Larger steps for more noticeable zooming (20% change)
} as const;

// Zoom utility functions
export const ZOOM_UTILS = {
  // Get timeline display configuration based on zoom level
  // This determines what labels to show but doesn't switch discrete scales
  getTimelineDisplayForZoom(zoom: number): { 
    primaryUnit: 'day' | 'week' | 'month' | 'quarter' | 'year',
    pixelsPerPrimaryUnit: number,
    showSecondaryLabels: boolean 
  } {
    const pixelsPerDay = this.getPixelsPerDayForZoom(zoom);
    
    // Always use day as the base unit but adjust what we show
    if (pixelsPerDay >= 80) {
      // Very zoomed in - show individual days
      return {
        primaryUnit: 'day',
        pixelsPerPrimaryUnit: pixelsPerDay,
        showSecondaryLabels: true
      };
    } else if (pixelsPerDay >= 15) {
      // Medium zoom - show weeks but with smooth scaling
      return {
        primaryUnit: 'week',
        pixelsPerPrimaryUnit: pixelsPerDay * 7,
        showSecondaryLabels: false
      };
    } else if (pixelsPerDay >= 3) {
      // Zoomed out - show months
      return {
        primaryUnit: 'month',
        pixelsPerPrimaryUnit: pixelsPerDay * 30,
        showSecondaryLabels: false
      };
    } else {
      // Very zoomed out - show years
      return {
        primaryUnit: 'year',
        pixelsPerPrimaryUnit: pixelsPerDay * 365,
        showSecondaryLabels: false
      };
    }
  },
  
  // Legacy method for backwards compatibility - always return 'day'
  getTimescaleForZoom(zoom: number): TimeScale {
    // Always return 'day' since we want continuous scaling
    return 'day';
  },
  
  // Calculate next zoom value using percentage-based scaling
  calculateNextZoom(currentZoom: number, direction: 'in' | 'out'): number {
    const { MIN, MAX } = ZOOM_SCALE;
    // Use 30% zoom change for more noticeable steps
    const zoomFactor = direction === 'in' ? 1.3 : 0.769231;
    const newZoom = currentZoom * zoomFactor;
    
    // Round to 2 decimal places to avoid floating point issues
    const rounded = Math.round(newZoom * 100) / 100;
    return Math.max(MIN, Math.min(MAX, rounded));
  },
  
  // Get pixels per day for a given zoom level
  getPixelsPerDayForZoom(zoom: number): number {
    // Use exponential scaling for better zoom feel
    // At zoom 1.0, we want about 30 pixels per day
    // At zoom 0.1, we want about 3 pixels per day  
    // At zoom 5.0, we want about 150 pixels per day
    const pixelsPerDay = 30 * Math.pow(zoom, 1.2);
    
    // Ensure minimum width for readability
    const minPixelsPerDay = 2;
    return Math.max(minPixelsPerDay, pixelsPerDay);
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
  zoom: ZOOM_SCALE.DEFAULT, // Default zoom
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
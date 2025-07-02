/**
 * Default column widths based on cell type
 */
export const DEFAULT_COLUMN_WIDTHS = {
  uuid: 120,
  date: 120,
  number: 100,
  boolean: 80,
  enum: 120,
  text: 250,
  'relationship-single': 180,
  'relationship-multi': 180,
  'relationship-collection': 200,
  json: 220,
  default: 150
} as const

/**
 * Minimum column widths based on cell type
 */
export const MIN_COLUMN_WIDTHS = {
  uuid: 100,
  date: 100,
  number: 80,
  boolean: 70,
  enum: 100,
  text: 120,
  'relationship-single': 140,
  'relationship-multi': 140,
  'relationship-collection': 160,
  json: 140,
  default: 100
} as const

/**
 * CSS class names for consistent styling
 */
export const CSS_CLASSES = {
  container: 'vibegridoptimus-container',
  cell: 'vibegridoptimus-cell',
  editableCell: 'vibegridoptimus-cell-editable',
  systemCell: 'vibegridoptimus-cell-system',
  textOverflow: 'text-overflow-ellipsis',
  badge: 'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium',
  primaryBadge: 'bg-primary/10 text-primary border border-primary/20',
  mutedText: 'text-sm text-muted-foreground',
  emptyState: 'cursor-pointer px-2 hover:bg-muted rounded text-sm flex items-center gap-2 text-muted-foreground',
  // Centralized hover styles for all cell types
  cellHover: 'cursor-pointer hover:bg-muted transition-colors',
  cellHoverOpacity: 'cursor-pointer hover:opacity-80 transition-opacity',
  cellDisplay: 'text-sm rounded',
  cellDisplayRight: 'text-sm rounded text-right'
} as const

/**
 * Performance thresholds
 */
export const PERFORMANCE = {
  TARGET_RENDER_TIME: 45, // ms
  VIRTUALIZATION_THRESHOLD: 100, // rows
  BATCH_SIZE_THRESHOLD: 10 // operations
} as const

/**
 * Grid configuration defaults
 */
export const GRID_DEFAULTS = {
  height: 600,
  theme: 'light' as const,
  enableVirtualization: true,
  enableRowSelection: false,
  enableSorting: true,
  enableFiltering: false
} as const
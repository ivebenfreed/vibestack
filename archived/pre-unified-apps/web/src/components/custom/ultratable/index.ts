/**
 * UltraTable - High-Performance Table with Legend State
 * 
 * Public API exports for the UltraTable component system.
 */

// Main component
export { default as UltraTable } from './UltraTable';

// Core renderer (for advanced usage)
export { UltraTableRenderer } from './core/UltraTableRenderer';
export { UltraCellPipeline } from './core/UltraCellPipeline';

// Utilities
export { generateColumns } from './utils/column-generator';

// Types
export type {
  Column,
  UltraTableProps,
  UltraTableAPI,
  UltraTableState,
  RendererOptions,
  ViewportInfo,
  CellPosition,
  RenderMetrics
} from './types';

// Styles (imported automatically by main component)
import './styles/ultra-table.css';
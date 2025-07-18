// ====================================
// RENDERER EXPORTS
// ====================================

export { TableRenderer } from './core/TableRenderer';


// Re-export cell renderers
export * from './cell-renderers';

// ====================================
// RENDERER FACTORY
// ====================================

import type { RendererOptions } from '../types';
import { TableRenderer } from './core/TableRenderer';

/**
 * Create a table renderer
 */
export function createTableRenderer(options: RendererOptions): TableRenderer {
  return new TableRenderer(options);
}


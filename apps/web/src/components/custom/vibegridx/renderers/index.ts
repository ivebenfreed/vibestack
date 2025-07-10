// ====================================
// RENDERER EXPORTS
// ====================================

export { AtomicTableRenderer } from './AtomicTableRenderer';

// Re-export fast renderers
export * from './fast-renderers';

// ====================================
// RENDERER FACTORY
// ====================================

import type { RendererOptions } from '../types';
import { AtomicTableRenderer } from './AtomicTableRenderer';

/**
 * Create an atomic table renderer
 */
export function createAtomicTableRenderer(options: RendererOptions): AtomicTableRenderer {
  return new AtomicTableRenderer(options);
}
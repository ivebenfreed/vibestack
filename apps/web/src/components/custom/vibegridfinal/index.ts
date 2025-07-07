/**
 * VibeGridFinal - Modularized High-Performance Data Grid
 * 
 * 🔥 PERFORMANCE PRESERVED: 42.54ms universal cell renderer
 * ✅ MODULAR ARCHITECTURE: Clean separation of concerns
 * ✅ ENTITY-SPECIFIC: Optimized grids for each entity type
 * ✅ FLAT SWITCH STATEMENTS: Performance-critical code preserved
 */

// Core components
export { VibeGridFinal } from './core/VibeGridFinal'
export { UniversalCellRenderer } from './core/UniversalCellRenderer'

// Entity-specific grids
export { TaskVibeGrid } from './entities/TaskVibeGrid'
export { ProjectVibeGrid } from './entities/ProjectVibeGrid'
export { UserVibeGrid } from './entities/UserVibeGrid'
export { CommentVibeGrid } from './entities/CommentVibeGrid'

// Feature components
export { VibeGridHeader } from './features/header/VibeGridHeader'
export { VibeGridFooter } from './features/footer/VibeGridFooter'
export { SmartGlobalSearch } from './features/header/SmartGlobalSearch'

// Types
export type * from './types'

// Adapters (for advanced usage)
export { AtomAdapter } from './adapters/AtomAdapter'
export { RelationshipAdapter } from './adapters/RelationshipAdapter'

// Utils (for advanced usage)
export * from './utils/columnUtils' 
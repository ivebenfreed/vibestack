/**
 * Fast cell renderers for high-performance table rendering
 * These functions provide minimal overhead cell formatting
 */

export { renderText } from './renderText';
export { renderNumber } from './renderNumber';
export { renderDate } from './renderDate';
export { renderBoolean } from './renderBoolean';
export { renderEnum } from './renderEnum';
export { renderRelationship } from './renderRelationship';
export { renderRelationshipSingle } from './renderRelationshipSingle';
export { renderRelationshipMulti } from './renderRelationshipMulti';
export type { RelationshipData } from './renderRelationship';

// Re-export the renderer type for convenience
import type { Column } from '../../types';

export type FastRenderer = (value: any, column: Column) => string;

/**
 * Map of column types to their fast renderer functions
 */
export const fastRenderers = {
  text: () => import('./renderText').then(m => m.renderText),
  number: () => import('./renderNumber').then(m => m.renderNumber),
  date: () => import('./renderDate').then(m => m.renderDate),
  boolean: () => import('./renderBoolean').then(m => m.renderBoolean),
  enum: () => import('./renderEnum').then(m => m.renderEnum),
  select: () => import('./renderText').then(m => m.renderText), // Reuse text renderer
  uuid: () => import('./renderText').then(m => m.renderText), // UUID is text-based
  json: () => import('./renderText').then(m => m.renderText), // JSON displayed as text
  relationship: () => import('./renderRelationship').then(m => m.renderRelationship),
  'relationship-single': () => import('./renderRelationship').then(m => m.renderRelationship),
  'relationship-multi': () => import('./renderRelationship').then(m => m.renderRelationship),
  'relationship-collection': () => import('./renderRelationship').then(m => m.renderRelationship),
};
/**
 * Fast cell renderers for high-performance table rendering
 * These functions provide minimal overhead cell formatting
 */

export { text } from './text';
export { number } from './number';
export { date } from './date';
export { boolean } from './boolean';
export { enumValue } from './enum';
export { relationship } from './relationship';
export { relationshipSingle } from './relationship/single';
export { relationshipMulti } from './relationship/multi';
export { referenceSelect, referenceMulti } from './reference';
export type { RelationshipData } from './relationship';

// Re-export the renderer type for convenience
import type { Column } from '../types';

export type FastRenderer = (value: any, column: Column) => string;

/**
 * Map of column types to their fast renderer functions
 */
export const fastRenderers = {
  text: () => import('./text').then(m => m.text),
  number: () => import('./number').then(m => m.number),
  date: () => import('./date').then(m => m.date),
  boolean: () => import('./boolean').then(m => m.boolean),
  enum: () => import('./enum').then(m => m.enumValue),
  select: () => import('./text').then(m => m.text), // Reuse text renderer
  uuid: () => import('./text').then(m => m.text), // UUID is text-based
  json: () => import('./text').then(m => m.text), // JSON displayed as text
  relationship: () => import('./relationship').then(m => m.relationship),
  'relationship-single': () => import('./relationship').then(m => m.relationship),
  'relationship-multi': () => import('./relationship').then(m => m.relationship),
  'relationship-collection': () => import('./relationship').then(m => m.relationship),
  'reference-select': () => import('./reference').then(m => m.referenceSelect),
  'reference-multi': () => import('./reference').then(m => m.referenceMulti),
};
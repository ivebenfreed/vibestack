import type { BasePrimitive } from './types.js';

// Hardcoded base primitives - these never change
export const BASE_PRIMITIVES: Record<string, BasePrimitive> = {
  Project: {
    name: 'Project',
    coreFields: {
      id: 'string',
      name: 'string',
      description: 'string',
      status: 'enum',
      created_at: 'date',
      updated_at: 'date'
    },
    defaultStatus: 'draft',
    statusTransitions: ['draft', 'active', 'on_hold', 'completed', 'cancelled']
  },
  
  Task: {
    name: 'Task',
    coreFields: {
      id: 'string',
      title: 'string',
      description: 'string',
      priority: 'enum',
      status: 'enum',
      due_date: 'date',
      assigned_to: 'string',
      created_at: 'date',
      updated_at: 'date'
    },
    defaultStatus: 'todo',
    statusTransitions: ['todo', 'in_progress', 'review', 'done', 'cancelled']
  },
  
  File: {
    name: 'File',
    coreFields: {
      id: 'string',
      filename: 'string',
      size: 'number',
      type: 'string',
      upload_date: 'date',
      uploaded_by: 'string'
    }
  },
  
  Discussion: {
    name: 'Discussion',
    coreFields: {
      id: 'string',
      title: 'string',
      content: 'string',
      author: 'string',
      created_at: 'date',
      status: 'enum'
    },
    defaultStatus: 'open',
    statusTransitions: ['open', 'closed', 'archived']
  }
};

export function getPrimitive(name: string): BasePrimitive | null {
  return BASE_PRIMITIVES[name] || null;
}

export function getAllPrimitives(): BasePrimitive[] {
  return Object.values(BASE_PRIMITIVES);
}
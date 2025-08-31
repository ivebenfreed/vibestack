import { z } from 'zod';

// Task status enum matching the existing system
export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

// Task schema matching the existing Task entity structure
export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(TaskStatus),
  priority: z.number().int().min(0).max(5).default(3),
  projectId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional(),
  tags: z.array(z.string()).default([]),
});

export type Task = z.infer<typeof TaskSchema>;

// Helper to create a new task
export function createTask(data: Partial<Task>): Task {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: data.title || 'New Task',
    description: data.description || null,
    status: data.status || TaskStatus.TODO,
    priority: data.priority ?? 3,
    projectId: data.projectId || null,
    assigneeId: data.assigneeId || null,
    dueDate: data.dueDate || null,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
    completedAt: data.completedAt || null,
    tags: data.tags || [],
  };
}
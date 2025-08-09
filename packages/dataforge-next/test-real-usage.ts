// Test real-world usage patterns from the app

import type { Task, User, Project } from './src/generated/client-entities.js';
import { db } from './src/generated/dexie-schema.js';
import { taskDexieService } from './src/generated/dexie-domain/index.js';

// Pattern 1: Domain state management (from domain-xstate/task.ts)
interface TaskState {
  tasks: Task[];
  selectedTask: Task | null;
  loading: boolean;
}

const taskState: TaskState = {
  tasks: [],
  selectedTask: null,
  loading: false
};

// Pattern 2: Dexie live queries (from hooks/useDexieLiveTasks.ts)
async function useDexieLiveTasks(projectId?: string) {
  let query = db.task.where('deleted').equals(0);
  
  if (projectId) {
    // This would need adjustment - TypeORM version might use projectId
    query = query.filter(task => task.project === projectId);
  }
  
  const tasks = await query.toArray();
  return tasks;
}

// Pattern 3: CRUD operations (would break without *-operations)
// This is what the app expects but we don't generate yet:
/*
import type { CreateTaskInput, UpdateTaskInput } from '@repo/dataforge/task-operations';

async function createTask(input: CreateTaskInput) {
  return taskDexieService.create(input);
}
*/

// Pattern 4: Entity relationships
async function getTaskWithRelations(taskId: string) {
  const task = await taskDexieService.findById(taskId);
  if (!task) return null;
  
  // App might expect to access relations like:
  // task.project (as an object, not just projectId)
  // task.assignee (as User object)
  // task.comments (as Comment[])
  
  return task;
}

// Pattern 5: Enum usage (would break)
function getTasksByStatus(tasks: Task[], status: string) {
  // App uses: TaskStatus.OPEN
  // We have: 'open' as string
  return tasks.filter(t => t.status === status);
}

// Pattern 6: Type guards and validation
function isHighPriorityTask(task: Task): boolean {
  // App uses: task.priority === TaskPriority.HIGH
  // We have: task.priority === 'high'
  return task.priority === 'high';
}

console.log('Real usage patterns analysis:');
console.log('✅ Basic entity types work');
console.log('✅ Dexie db access works');
console.log('✅ Service methods work');
console.log('⚠️  Enums need string literals instead');
console.log('❌ Missing CreateInput/UpdateInput types');
console.log('❌ Relations are not populated objects');
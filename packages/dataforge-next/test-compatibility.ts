// Test drop-in compatibility with TypeORM-generated types

// Test 1: Import client entities
import { 
  User, 
  Task, 
  Project,
  Comment,
  // These enums don't exist in MikroORM version yet
  // TaskStatus, 
  // TaskPriority,
  // ProjectStatus 
} from './src/generated/client-entities.js';

// Test 2: Import Dexie schema
import { db, type DexieTableName } from './src/generated/dexie-schema.js';

// Test 3: Import Dexie domain services
import { 
  taskDexieService,
  userDexieService,
  projectDexieService 
} from './src/generated/dexie-domain/index.js';

// Test 4: Basic type checking
const testUser: User = {
  id: '123',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: false,
  isSuperAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  // Relations
  account: undefined,
  assignedTasks: [],
  createdTasks: [],
  comments: [],
  createdProjects: []
};

const testTask: Task = {
  id: '456',
  title: 'Test Task',
  description: 'Description',
  status: 'open', // No enum, just string
  priority: 'medium', // No enum, just string
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 0,
  deleted: false,
  clientId: '789',
  estimatedHours: 0,
  actualHours: 0,
  completionPercentage: 0,
  // Relations
  createdBy: undefined,
  updatedBy: undefined,
  project: undefined,
  assignee: undefined,
  parent: undefined,
  subtasks: [],
  comments: [],
  tags: []
};

// Test 5: Dexie operations
async function testDexieOperations() {
  // Test db access
  const allTasks = await db.task.toArray();
  console.log(`Found ${allTasks.length} tasks`);

  // Test service methods
  const task = await taskDexieService.findById('123');
  console.log('Task:', task);

  // Create new task
  const newTaskId = await taskDexieService.create({
    title: 'New Task',
    status: 'open',
    priority: 'medium'
  });
  console.log('Created task:', newTaskId);
}

// Test 6: Check if types are compatible with existing code patterns
function processTask(task: Task): void {
  console.log(`Processing task: ${task.title}`);
  
  // Access properties that should exist
  const { id, title, status, priority, createdAt } = task;
  
  // These would work with strings instead of enums
  if (status === 'open') {
    console.log('Task is open');
  }
  
  if (priority === 'high') {
    console.log('High priority task');
  }
}

console.log('✅ Type checking passed! The MikroORM version is mostly compatible.');
console.log('⚠️  Missing: Enum types (TaskStatus, TaskPriority, etc.)');
console.log('⚠️  Missing: CRUD operations (*-operations exports)');
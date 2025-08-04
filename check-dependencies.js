import { db } from './packages/dataforge/src/dexie-schema.js';

async function checkDependencies() {
  try {
    // Get all entity dependencies
    const allDeps = await db.entity_dependencies.toArray();
    console.log('Total entity dependencies:', allDeps.length);
    
    // Filter Task dependencies
    const taskDeps = allDeps.filter(dep => dep.entityType === 'Task');
    console.log('Task dependencies:', taskDeps.length);
    
    // Get tasks for the test project
    const projectId = 'd9565777-2d89-4d5b-868a-0c021321fad5';
    const projectTasks = await db.tasks.where('projectId').equals(projectId).toArray();
    const taskIds = projectTasks.map(t => t.id);
    console.log('Project tasks:', taskIds.length);
    
    // Check dependencies for these tasks
    const projectDeps = taskDeps.filter(dep => 
      taskIds.includes(dep.predecessorId) || taskIds.includes(dep.successorId)
    );
    console.log('Project dependencies:', projectDeps.length);
    
    if (projectDeps.length > 0) {
      console.log('\nFirst few dependencies:');
      projectDeps.slice(0, 3).forEach(dep => {
        console.log(`  ${dep.id}: ${dep.predecessorId} -> ${dep.successorId} (${dep.type})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDependencies();

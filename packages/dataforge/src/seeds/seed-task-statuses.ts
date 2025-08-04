import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { StatusSet } from '../entities/StatusSet.js';
import { StatusDefinition } from '../entities/StatusDefinition.js';
import serverDataSource from '../datasources/server.js';

// Load environment variables
dotenv.config();

/**
 * Seed Task Status Sets and Definitions
 * 
 * Creates a default task status workflow with common statuses
 */
async function seedTaskStatuses() {
  let dataSource: DataSource | null = null;
  
  try {
    // Initialize the data source
    dataSource = await serverDataSource.initialize();
    console.log('✅ Database connection established');
    
    // Check if task status set already exists
    const statusSetRepo = dataSource.getRepository(StatusSet);
    const existingSet = await statusSetRepo.findOne({
      where: { name: 'task_workflow' }
    });
    
    if (existingSet) {
      console.log('⚠️  Task status set already exists, skipping seed');
      return;
    }
    
    // Create task status set
    const taskStatusSet = statusSetRepo.create({
      name: 'task_workflow',
      description: 'Default workflow for task management',
      entityType: 'task',
      isSystem: true
    });
    
    await statusSetRepo.save(taskStatusSet);
    console.log('✅ Created task status set');
    
    // Define status definitions
    const statusDefinitions = [
      {
        name: 'backlog',
        label: 'Backlog',
        color: '#6B7280', // Gray
        icon: 'archive',
        variant: 'outline',
        sortOrder: 0,
        isDefault: true,
        isFinal: false,
        isActive: true,
        metadata: {
          description: 'Tasks in the backlog waiting to be prioritized'
        }
      },
      {
        name: 'todo',
        label: 'To Do',
        color: '#3B82F6', // Blue
        icon: 'circle',
        variant: 'outline',
        sortOrder: 1,
        isDefault: false,
        isFinal: false,
        isActive: true,
        metadata: {
          description: 'Tasks ready to be worked on'
        }
      },
      {
        name: 'in_progress',
        label: 'In Progress',
        color: '#F59E0B', // Amber
        icon: 'clock',
        variant: 'solid',
        sortOrder: 2,
        isDefault: false,
        isFinal: false,
        isActive: true,
        metadata: {
          description: 'Tasks currently being worked on'
        }
      },
      {
        name: 'in_review',
        label: 'In Review',
        color: '#8B5CF6', // Purple
        icon: 'eye',
        variant: 'solid',
        sortOrder: 3,
        isDefault: false,
        isFinal: false,
        isActive: true,
        metadata: {
          description: 'Tasks waiting for review or approval'
        }
      },
      {
        name: 'completed',
        label: 'Completed',
        color: '#10B981', // Green
        icon: 'check-circle',
        variant: 'solid',
        sortOrder: 4,
        isDefault: false,
        isFinal: true,
        isActive: true,
        metadata: {
          description: 'Tasks that have been completed'
        }
      },
      {
        name: 'cancelled',
        label: 'Cancelled',
        color: '#EF4444', // Red
        icon: 'x-circle',
        variant: 'outline',
        sortOrder: 5,
        isDefault: false,
        isFinal: true,
        isActive: true,
        metadata: {
          description: 'Tasks that have been cancelled'
        }
      },
      {
        name: 'blocked',
        label: 'Blocked',
        color: '#DC2626', // Dark Red
        icon: 'ban',
        variant: 'solid',
        sortOrder: 6,
        isDefault: false,
        isFinal: false,
        isActive: true,
        metadata: {
          description: 'Tasks blocked by dependencies or issues'
        }
      }
    ];
    
    // Create status definitions
    const statusDefRepo = dataSource.getRepository(StatusDefinition);
    
    for (const statusData of statusDefinitions) {
      const statusDef = statusDefRepo.create({
        ...statusData,
        statusSetId: taskStatusSet.id
      });
      
      await statusDefRepo.save(statusDef);
      console.log(`✅ Created status: ${statusDef.label}`);
    }
    
    // Set up allowed transitions (optional - you can customize this)
    // For now, we'll allow any status to transition to any other status
    // In a real application, you might want to restrict certain transitions
    
    console.log('\n🎉 Task status seed completed successfully!');
    console.log(`   - Status Set: ${taskStatusSet.name} (${taskStatusSet.id})`);
    console.log(`   - Statuses: ${statusDefinitions.length} created`);
    
  } catch (error) {
    console.error('❌ Error seeding task statuses:', error);
    throw error;
  } finally {
    // Clean up the connection
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

// Run the seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTaskStatuses()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}

export { seedTaskStatuses };
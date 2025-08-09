#!/usr/bin/env tsx

/**
 * Seed test projects with tasks and dependencies
 * Based on the gantt-test-data.tsx component
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { addDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import serverDataSource from '../packages/dataforge/src/datasources/server-local.js';
import { Project } from '../packages/dataforge/src/entities/Project.js';
import { Task } from '../packages/dataforge/src/entities/Task.js';
import { EntityDependency } from '../packages/dataforge/src/entities/EntityDependency.js';

// Load environment variables
dotenv.config({ path: 'packages/dataforge/.env.local' });

async function seedTestProjects() {
  let dataSource: DataSource | null = null;
  
  try {
    // Initialize the data source (local database)
    dataSource = await serverDataSource.initialize();
    console.log('✅ Database connection established');
    
    const projectRepo = dataSource.getRepository(Project);
    const taskRepo = dataSource.getRepository(Task);
    const dependencyRepo = dataSource.getRepository(EntityDependency);
    
    // Generate 3 test projects
    for (let projectNum = 1; projectNum <= 3; projectNum++) {
      console.log(`\n📦 Creating Project ${projectNum}...`);
      
      // Create a test project
      const project = projectRepo.create({
        name: `Test Project ${projectNum} - ${Date.now()}`,
        description: `Test project ${projectNum} for development with task dependencies`,
        color: ['#3B82F6', '#10B981', '#F59E0B'][projectNum - 1],
        isActive: true,
      });
      
      await projectRepo.save(project);
      console.log(`✅ Created project: ${project.name}`);
      
      // Define our test tasks with proper scheduling
      const startDate = new Date();
      const tasksData = [
        {
          title: `P${projectNum}: Project Planning`,
          description: 'Initial project planning and requirements gathering',
          startDate: startDate,
          dueDate: addDays(startDate, 5),
          priority: 'high' as any,
        },
        {
          title: `P${projectNum}: Design Phase`,
          description: 'Create system architecture and UI/UX designs',
          startDate: addDays(startDate, 6),
          dueDate: addDays(startDate, 15),
          priority: 'high' as any,
        },
        {
          title: `P${projectNum}: Backend Development`,
          description: 'Implement server-side functionality',
          startDate: addDays(startDate, 16),
          dueDate: addDays(startDate, 30),
          priority: 'medium' as any,
        },
        {
          title: `P${projectNum}: Frontend Development`,
          description: 'Build user interface components',
          startDate: addDays(startDate, 16),
          dueDate: addDays(startDate, 28),
          priority: 'medium' as any,
        },
        {
          title: `P${projectNum}: API Integration`,
          description: 'Connect frontend with backend APIs',
          startDate: addDays(startDate, 25),
          dueDate: addDays(startDate, 32),
          priority: 'medium' as any,
        },
        {
          title: `P${projectNum}: Testing Phase`,
          description: 'Comprehensive testing of all features',
          startDate: addDays(startDate, 31),
          dueDate: addDays(startDate, 38),
          priority: 'high' as any,
        },
        {
          title: `P${projectNum}: Bug Fixes`,
          description: 'Fix issues found during testing',
          startDate: addDays(startDate, 35),
          dueDate: addDays(startDate, 40),
          priority: 'high' as any,
        },
        {
          title: `P${projectNum}: Documentation`,
          description: 'Write user and technical documentation',
          startDate: addDays(startDate, 20),
          dueDate: addDays(startDate, 42),
          priority: 'low' as any,
        },
        {
          title: `P${projectNum}: Deployment Preparation`,
          description: 'Prepare production environment',
          startDate: addDays(startDate, 38),
          dueDate: addDays(startDate, 41),
          priority: 'medium' as any,
        },
        {
          title: `P${projectNum}: Production Release`,
          description: 'Deploy to production environment',
          startDate: addDays(startDate, 42),
          dueDate: addDays(startDate, 43),
          priority: 'high' as any,
        },
      ];
      
      // Create tasks
      const createdTasks = [];
      for (const taskData of tasksData) {
        const task = taskRepo.create({
          ...taskData,
          projectId: project.id,
          legacyStatus: 'open',
        });
        
        await taskRepo.save(task);
        createdTasks.push(task);
        console.log(`  ✅ Created task: ${task.title}`);
      }
      
      // Define dependencies
      const dependencies = [
        // Design depends on Planning (Finish-to-Start)
        { predecessor: 0, successor: 1, type: 'finish-to-start', lagDays: 1 },
        
        // Backend and Frontend depend on Design (Finish-to-Start)
        { predecessor: 1, successor: 2, type: 'finish-to-start', lagDays: 1 },
        { predecessor: 1, successor: 3, type: 'finish-to-start', lagDays: 1 },
        
        // API Integration depends on Backend progress (Start-to-Start with lag)
        { predecessor: 2, successor: 4, type: 'start-to-start', lagDays: 9 },
        
        // API Integration also depends on Frontend (Finish-to-Finish)
        { predecessor: 3, successor: 4, type: 'finish-to-finish', lagDays: 4 },
        
        // Testing depends on API Integration (Finish-to-Start)
        { predecessor: 4, successor: 5, type: 'finish-to-start', lagDays: -1 }, // Can overlap by 1 day
        
        // Bug Fixes depends on Testing start (Start-to-Start)
        { predecessor: 5, successor: 6, type: 'start-to-start', lagDays: 4 },
        
        // Deployment Prep depends on Bug Fixes progress (Start-to-Finish)
        { predecessor: 6, successor: 8, type: 'start-to-finish', lagDays: 3 },
        
        // Production Release depends on Testing, Bug Fixes, Documentation, and Deployment Prep
        { predecessor: 5, successor: 9, type: 'finish-to-start', lagDays: 4 },
        { predecessor: 6, successor: 9, type: 'finish-to-start', lagDays: 2 },
        { predecessor: 7, successor: 9, type: 'finish-to-start', lagDays: 0 },
        { predecessor: 8, successor: 9, type: 'finish-to-start', lagDays: 1 },
      ];
      
      // Create dependencies
      let depCount = 0;
      for (const dep of dependencies) {
        const dependency = dependencyRepo.create({
          entityType: 'task',
          predecessorId: createdTasks[dep.predecessor].id,
          successorId: createdTasks[dep.successor].id,
          dependencyType: dep.type as any,
          lagDays: dep.lagDays || 0,
          metadata: {
            predecessorTitle: createdTasks[dep.predecessor].title,
            successorTitle: createdTasks[dep.successor].title,
          },
          description: `${createdTasks[dep.predecessor].title} → ${createdTasks[dep.successor].title}`,
        });
        
        await dependencyRepo.save(dependency);
        depCount++;
      }
      
      console.log(`  ✅ Created ${depCount} dependencies`);
      console.log(`\n🎉 Project ${projectNum} completed: ${project.name}`);
      console.log(`   - Tasks: ${createdTasks.length}`);
      console.log(`   - Dependencies: ${depCount}`);
    }
    
    // Summary
    const projectCount = await projectRepo.count();
    const taskCount = await taskRepo.count();
    const dependencyCount = await dependencyRepo.count();
    
    console.log('\n📊 Database Summary:');
    console.log(`   - Total Projects: ${projectCount}`);
    console.log(`   - Total Tasks: ${taskCount}`);
    console.log(`   - Total Dependencies: ${dependencyCount}`);
    
  } catch (error) {
    console.error('❌ Error seeding test projects:', error);
    throw error;
  } finally {
    // Clean up the connection
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
      console.log('\nDatabase connection closed');
    }
  }
}

// Run the seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestProjects()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}

export { seedTestProjects };
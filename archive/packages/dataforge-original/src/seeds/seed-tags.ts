import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { TagSet } from '../entities/TagSet.js';
import { Tag } from '../entities/Tag.js';
import serverDataSource from '../datasources/server.js';

// Load environment variables
dotenv.config();

/**
 * Seed Tag Sets and Tags
 * 
 * Creates default tag sets with common tags for different entity types
 */
async function seedTags() {
  let dataSource: DataSource | null = null;
  
  try {
    // Initialize the data source
    dataSource = await serverDataSource.initialize();
    console.log('✅ Database connection established');
    
    const tagSetRepo = dataSource.getRepository(TagSet);
    const tagRepo = dataSource.getRepository(Tag);
    
    // Create task tag set
    const existingTaskTagSet = await tagSetRepo.findOne({
      where: { name: 'task_tags' }
    });
    
    if (!existingTaskTagSet) {
      const taskTagSet = tagSetRepo.create({
        name: 'task_tags',
        description: 'Common tags for task categorization',
        category: 'type',
        isSystem: false,
        isActive: true,
        defaultColor: '#94a3b8',
        displayOrder: 0,
        isExclusive: false,
        maxTags: 5,
        metadata: {
          version: '1.0',
          createdBy: 'system-seed',
          label: 'Task Tags',
          entityType: 'Task'
        }
      });
      
      await tagSetRepo.save(taskTagSet);
      console.log('✅ Created task tag set');
      
      // Define task tags
      const taskTags = [
        {
          name: 'bug',
          slug: 'bug',
          label: 'Bug',
          color: '#EF4444', // Red
          icon: 'bug',
          description: 'Software bug or defect',
          sortOrder: 0,
          isActive: true
        },
        {
          name: 'feature',
          slug: 'feature',
          label: 'Feature',
          color: '#10B981', // Green
          icon: 'sparkles',
          description: 'New feature or enhancement',
          sortOrder: 1,
          isActive: true
        },
        {
          name: 'documentation',
          slug: 'documentation',
          label: 'Documentation',
          color: '#3B82F6', // Blue
          icon: 'book-open',
          description: 'Documentation improvements',
          sortOrder: 2,
          isActive: true
        },
        {
          name: 'performance',
          slug: 'performance',
          label: 'Performance',
          color: '#F59E0B', // Amber
          icon: 'zap',
          description: 'Performance optimization',
          sortOrder: 3,
          isActive: true
        },
        {
          name: 'security',
          slug: 'security',
          label: 'Security',
          color: '#8B5CF6', // Purple
          icon: 'shield',
          description: 'Security related',
          sortOrder: 4,
          isActive: true
        },
        {
          name: 'testing',
          slug: 'testing',
          label: 'Testing',
          color: '#06B6D4', // Cyan
          icon: 'beaker',
          description: 'Testing and QA',
          sortOrder: 5,
          isActive: true
        },
        {
          name: 'refactor',
          slug: 'refactor',
          label: 'Refactor',
          color: '#6366F1', // Indigo
          icon: 'wrench',
          description: 'Code refactoring',
          sortOrder: 6,
          isActive: true
        },
        {
          name: 'ui-ux',
          slug: 'ui-ux',
          label: 'UI/UX',
          color: '#EC4899', // Pink
          icon: 'paint-brush',
          description: 'User interface and experience',
          sortOrder: 7,
          isActive: true
        }
      ];
      
      // Create task tags
      for (const tagData of taskTags) {
        const tag = tagRepo.create({
          ...tagData,
          tagSetId: taskTagSet.id,
          metadata: {
            iconSet: 'heroicons',
            category: 'task'
          }
        });
        
        await tagRepo.save(tag);
        console.log(`✅ Created tag: ${tagData.label}`);
      }
    } else {
      console.log('⚠️  Task tag set already exists, skipping task tags');
    }
    
    // Create project tag set
    const existingProjectTagSet = await tagSetRepo.findOne({
      where: { name: 'project_categories' }
    });
    
    if (!existingProjectTagSet) {
      const projectTagSet = tagSetRepo.create({
        name: 'project_categories',
        description: 'Categories for project classification',
        category: 'type',
        isSystem: false,
        isActive: true,
        defaultColor: '#3B82F6',
        displayOrder: 1,
        isExclusive: true,
        maxTags: 1,
        metadata: {
          version: '1.0',
          createdBy: 'system-seed',
          label: 'Project Categories',
          entityType: 'Project'
        }
      });
      
      await tagSetRepo.save(projectTagSet);
      console.log('✅ Created project tag set');
      
      // Define project tags
      const projectTags = [
        {
          name: 'internal',
          slug: 'internal',
          label: 'Internal',
          color: '#6B7280', // Gray
          icon: 'home',
          description: 'Internal company project',
          sortOrder: 0,
          isActive: true
        },
        {
          name: 'client',
          slug: 'client',
          label: 'Client',
          color: '#3B82F6', // Blue
          icon: 'briefcase',
          description: 'Client project',
          sortOrder: 1,
          isActive: true
        },
        {
          name: 'research',
          slug: 'research',
          label: 'Research',
          color: '#8B5CF6', // Purple
          icon: 'academic-cap',
          description: 'Research and development',
          sortOrder: 2,
          isActive: true
        },
        {
          name: 'opensource',
          slug: 'opensource',
          label: 'Open Source',
          color: '#10B981', // Green
          icon: 'globe',
          description: 'Open source project',
          sortOrder: 3,
          isActive: true
        },
        {
          name: 'prototype',
          slug: 'prototype',
          label: 'Prototype',
          color: '#F59E0B', // Amber
          icon: 'light-bulb',
          description: 'Proof of concept or prototype',
          sortOrder: 4,
          isActive: true
        }
      ];
      
      // Create project tags
      for (const tagData of projectTags) {
        const tag = tagRepo.create({
          ...tagData,
          tagSetId: projectTagSet.id,
          metadata: {
            iconSet: 'heroicons',
            category: 'project'
          }
        });
        
        await tagRepo.save(tag);
        console.log(`✅ Created tag: ${tagData.label}`);
      }
    } else {
      console.log('⚠️  Project tag set already exists, skipping project tags');
    }
    
    // Create priority tag set (can be used by multiple entities)
    const existingPriorityTagSet = await tagSetRepo.findOne({
      where: { name: 'priority_levels' }
    });
    
    if (!existingPriorityTagSet) {
      const priorityTagSet = tagSetRepo.create({
        name: 'priority_levels',
        description: 'Priority classification for various entities',
        category: 'priority',
        isSystem: false,
        isActive: true,
        defaultColor: '#F59E0B',
        displayOrder: 2,
        isExclusive: true,
        maxTags: 1,
        metadata: {
          version: '1.0',
          createdBy: 'system-seed',
          label: 'Priority Levels',
          applicableEntities: ['Task', 'Project']
        }
      });
      
      await tagSetRepo.save(priorityTagSet);
      console.log('✅ Created priority tag set');
      
      // Define priority tags
      const priorityTags = [
        {
          name: 'critical',
          slug: 'critical',
          label: 'Critical',
          color: '#DC2626', // Dark Red
          icon: 'exclamation-triangle',
          description: 'Critical priority - immediate attention required',
          sortOrder: 0,
          isActive: true
        },
        {
          name: 'high',
          slug: 'high',
          label: 'High',
          color: '#EF4444', // Red
          icon: 'arrow-up',
          description: 'High priority',
          sortOrder: 1,
          isActive: true
        },
        {
          name: 'medium',
          slug: 'medium',
          label: 'Medium',
          color: '#F59E0B', // Amber
          icon: 'minus',
          description: 'Medium priority',
          sortOrder: 2,
          isActive: true
        },
        {
          name: 'low',
          slug: 'low',
          label: 'Low',
          color: '#3B82F6', // Blue
          icon: 'arrow-down',
          description: 'Low priority',
          sortOrder: 3,
          isActive: true
        },
        {
          name: 'backlog',
          slug: 'backlog',
          label: 'Backlog',
          color: '#6B7280', // Gray
          icon: 'archive',
          description: 'Backlog - no immediate priority',
          sortOrder: 4,
          isActive: true
        }
      ];
      
      // Create priority tags
      for (const tagData of priorityTags) {
        const tag = tagRepo.create({
          ...tagData,
          tagSetId: priorityTagSet.id,
          metadata: {
            iconSet: 'heroicons',
            category: 'priority',
            weight: 5 - tagData.sortOrder // Higher weight for higher priority
          }
        });
        
        await tagRepo.save(tag);
        console.log(`✅ Created tag: ${tagData.label}`);
      }
    } else {
      console.log('⚠️  Priority tag set already exists, skipping priority tags');
    }
    
    console.log('\n🎉 Tag seed completed successfully!');
    
    // Summary
    const tagSetCount = await tagSetRepo.count();
    const tagCount = await tagRepo.count();
    console.log(`   - Tag Sets: ${tagSetCount} total`);
    console.log(`   - Tags: ${tagCount} total`);
    
  } catch (error) {
    console.error('❌ Error seeding tags:', error);
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
  seedTags()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}

export { seedTags };
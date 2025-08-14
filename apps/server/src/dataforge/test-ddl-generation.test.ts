/**
 * Test 3: DDL Generation with UUIDv7 and Proper Constraints
 * 
 * Validates that Project and Task archetypes generate proper DDL with:
 * - UUIDv7 for primary keys
 * - Foreign key constraints
 * - Check constraints
 * - Default values
 * - Proper data types
 */

import { describe, it, expect } from 'vitest';
import { ProjectArchetype } from './entities/foundation/archetypes/Project';
import { TaskArchetype } from './entities/foundation/archetypes/Task';

describe('Test 3: DDL Generation with UUIDv7 and Constraints', () => {
  describe('ProjectArchetype DDL Generation', () => {
    it('should generate DDL with UUIDv7 primary key', () => {
      const ddl = ProjectArchetype.getProjectDDL();
      
      // Should contain UUIDv7 generation
      expect(ddl).toContain('generate_uuidv7()');
      expect(ddl).toContain('id UUID PRIMARY KEY DEFAULT generate_uuidv7()');
    });

    it('should include proper foreign key constraints', () => {
      const ddl = ProjectArchetype.getProjectDDL();
      
      // Organization foreign key
      expect(ddl).toContain('CONSTRAINT fk_{tableName}_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE');
      
      // Owner foreign key
      expect(ddl).toContain('CONSTRAINT fk_{tableName}_owner FOREIGN KEY (owner_id) REFERENCES "user"(id) ON DELETE SET NULL');
    });

    it('should include proper check constraints', () => {
      const ddl = ProjectArchetype.getProjectDDL();
      
      // Progress percentage check
      expect(ddl).toContain('CHECK (progress_percentage >= 0 AND progress_percentage <= 100)');
    });

    it('should include proper default values', () => {
      const ddl = ProjectArchetype.getProjectDDL();
      
      // Default values from field definitions
      expect(ddl).toContain("priority VARCHAR(50) DEFAULT 'medium'");
      expect(ddl).toContain("status VARCHAR(50) DEFAULT 'active'");
      expect(ddl).toContain('progress_percentage INTEGER DEFAULT 0');
      expect(ddl).toContain("project_type VARCHAR(50) DEFAULT 'operational'");
      expect(ddl).toContain('created_at TIMESTAMPTZ DEFAULT NOW()');
      expect(ddl).toContain('updated_at TIMESTAMPTZ DEFAULT NOW()');
    });

    it('should have proper data types', () => {
      const ddl = ProjectArchetype.getProjectDDL();
      
      expect(ddl).toContain('organization_id UUID NOT NULL');
      expect(ddl).toContain('name VARCHAR(255) NOT NULL');
      expect(ddl).toContain('description TEXT');
      expect(ddl).toContain('budget DECIMAL(15,2)');
      expect(ddl).toContain('start_date DATE');
      expect(ddl).toContain('end_date DATE');
    });

    it('should use template placeholders correctly', () => {
      const ddl = ProjectArchetype.getProjectDDL();
      
      // Should have table name placeholder
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS {tableName}');
      expect(ddl).toContain('CONSTRAINT fk_{tableName}_organization');
      expect(ddl).toContain('CONSTRAINT fk_{tableName}_owner');
    });
  });

  describe('TaskArchetype DDL Generation', () => {
    it('should generate DDL with UUIDv7 primary key', () => {
      const ddl = TaskArchetype.getTaskDDL();
      
      // Should contain UUIDv7 generation
      expect(ddl).toContain('generate_uuidv7()');
      expect(ddl).toContain('id UUID PRIMARY KEY DEFAULT generate_uuidv7()');
    });

    it('should include proper foreign key constraints', () => {
      const ddl = TaskArchetype.getTaskDDL();
      
      // Organization foreign key
      expect(ddl).toContain('CONSTRAINT fk_{tableName}_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE');
      
      // User foreign keys
      expect(ddl).toContain('CONSTRAINT fk_{tableName}_assignee FOREIGN KEY (assignee_id) REFERENCES "user"(id) ON DELETE SET NULL');
      expect(ddl).toContain('CONSTRAINT fk_{tableName}_reporter FOREIGN KEY (reporter_id) REFERENCES "user"(id) ON DELETE SET NULL');
      
      // Self-referential foreign key for parent tasks
      expect(ddl).toContain('CONSTRAINT fk_{tableName}_parent FOREIGN KEY (parent_task_id) REFERENCES {tableName}(id) ON DELETE SET NULL');
    });

    it('should include proper check constraints', () => {
      const ddl = TaskArchetype.getTaskDDL();
      
      // Story points check
      expect(ddl).toContain('CHECK (story_points >= 0 AND story_points <= 100)');
    });

    it('should include proper default values', () => {
      const ddl = TaskArchetype.getTaskDDL();
      
      // Default values from field definitions
      expect(ddl).toContain("priority VARCHAR(50) DEFAULT 'medium'");
      expect(ddl).toContain("status VARCHAR(50) DEFAULT 'todo'");
      expect(ddl).toContain("task_type VARCHAR(50) DEFAULT 'feature'");
      expect(ddl).toContain('created_at TIMESTAMPTZ DEFAULT NOW()');
      expect(ddl).toContain('updated_at TIMESTAMPTZ DEFAULT NOW()');
    });

    it('should have proper data types', () => {
      const ddl = TaskArchetype.getTaskDDL();
      
      expect(ddl).toContain('organization_id UUID NOT NULL');
      expect(ddl).toContain('title VARCHAR(500) NOT NULL');
      expect(ddl).toContain('description TEXT');
      expect(ddl).toContain('estimated_hours DECIMAL(10,2)');
      expect(ddl).toContain('actual_hours DECIMAL(10,2)');
      expect(ddl).toContain('due_date DATE');
      expect(ddl).toContain('assignee_id UUID');
      expect(ddl).toContain('reporter_id UUID');
    });

    it('should use template placeholders correctly', () => {
      const ddl = TaskArchetype.getTaskDDL();
      
      // Should have table name placeholder
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS {tableName}');
      expect(ddl).toContain('CONSTRAINT fk_{tableName}_organization');
      expect(ddl).toContain('CONSTRAINT fk_{tableName}_assignee');
      expect(ddl).toContain('CONSTRAINT fk_{tableName}_reporter');
      expect(ddl).toContain('CONSTRAINT fk_{tableName}_parent');
    });
  });

  describe('DDL Constraint Validation', () => {
    it('should ensure all required fields are NOT NULL', () => {
      const projectDDL = ProjectArchetype.getProjectDDL();
      const taskDDL = TaskArchetype.getTaskDDL();
      
      // Project required fields
      expect(projectDDL).toContain('organization_id UUID NOT NULL');
      expect(projectDDL).toContain('name VARCHAR(255) NOT NULL');
      
      // Task required fields
      expect(taskDDL).toContain('organization_id UUID NOT NULL');
      expect(taskDDL).toContain('title VARCHAR(500) NOT NULL');
    });

    it('should ensure optional fields are nullable', () => {
      const projectDDL = ProjectArchetype.getProjectDDL();
      const taskDDL = TaskArchetype.getTaskDDL();
      
      // Project optional fields (no NOT NULL)
      expect(projectDDL).toContain('description TEXT');
      expect(projectDDL).toContain('owner_id UUID');
      expect(projectDDL).toContain('budget DECIMAL(15,2)');
      
      // Task optional fields (no NOT NULL)
      expect(taskDDL).toContain('description TEXT');
      expect(taskDDL).toContain('assignee_id UUID');
      expect(taskDDL).toContain('due_date DATE');
    });

    it('should have proper timestamptz usage', () => {
      const projectDDL = ProjectArchetype.getProjectDDL();
      const taskDDL = TaskArchetype.getTaskDDL();
      
      // Both should use TIMESTAMPTZ for timestamps
      expect(projectDDL).toContain('created_at TIMESTAMPTZ DEFAULT NOW()');
      expect(projectDDL).toContain('updated_at TIMESTAMPTZ DEFAULT NOW()');
      expect(taskDDL).toContain('created_at TIMESTAMPTZ DEFAULT NOW()');
      expect(taskDDL).toContain('updated_at TIMESTAMPTZ DEFAULT NOW()');
    });
  });

  describe('Index Generation', () => {
    it('should generate appropriate indexes for Project archetype', () => {
      const indexes = ProjectArchetype.getProjectIndexes();
      
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_project_org_status ON "project"(organization_id, status);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_project_owner ON "project"(owner_id);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_project_priority ON "project"(priority);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_project_dates ON "project"(start_date, end_date);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_project_progress ON "project"(progress_percentage);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_project_created_at ON "project"(created_at);');
    });

    it('should generate appropriate indexes for Task archetype', () => {
      const indexes = TaskArchetype.getTaskIndexes();
      
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_task_org_status ON "task"(organization_id, status);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_task_assignee ON "task"(assignee_id);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_task_reporter ON "task"(reporter_id);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_task_priority ON "task"(priority);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_task_due_date ON "task"(due_date);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_task_project ON "task"(project_id);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_task_sprint ON "task"(sprint_id);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_task_parent ON "task"(parent_task_id);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_task_type_status ON "task"(task_type, status);');
      expect(indexes).toContain('CREATE INDEX IF NOT EXISTS idx_task_created_at ON "task"(created_at);');
    });
  });

  describe('DDL Template Processing', () => {
    it('should replace table name placeholders correctly', () => {
      const projectDDL = ProjectArchetype.getProjectDDL();
      const taskDDL = TaskArchetype.getTaskDDL();
      
      // Both should have the placeholder pattern
      expect(projectDDL).toMatch(/\{tableName\}/g);
      expect(taskDDL).toMatch(/\{tableName\}/g);
      
      // Test replacement
      const projectProcessed = projectDDL.replace(/\{tableName\}/g, 'test_project');
      const taskProcessed = taskDDL.replace(/\{tableName\}/g, 'test_task');
      
      expect(projectProcessed).toContain('CREATE TABLE IF NOT EXISTS test_project');
      expect(projectProcessed).toContain('CONSTRAINT fk_test_project_organization');
      expect(taskProcessed).toContain('CREATE TABLE IF NOT EXISTS test_task');
      expect(taskProcessed).toContain('CONSTRAINT fk_test_task_organization');
    });
  });
});
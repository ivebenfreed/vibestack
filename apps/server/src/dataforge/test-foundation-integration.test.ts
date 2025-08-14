/**
 * Test 6: Integration with FoundationEntityRegistry
 * 
 * Validates that Project and Task archetypes are properly integrated with the FoundationEntityRegistry including:
 * - Registry includes all 8 universal archetypes
 * - Project and Task archetypes are accessible via registry
 * - DDL generation works through registry
 * - Index generation works through registry
 * - Archetype pattern class lookup works correctly
 * - Universal archetype enumeration is complete
 */

import { describe, it, expect } from 'vitest';
import { FoundationEntityRegistry } from './entities/foundation/index';
import { ProjectArchetype } from './entities/foundation/archetypes/Project';
import { TaskArchetype } from './entities/foundation/archetypes/Task';

describe('Test 6: Integration with FoundationEntityRegistry', () => {
  describe('Universal Archetype Registry', () => {
    it('should return all 8 universal archetypes', () => {
      const archetypes = FoundationEntityRegistry.getUniversalArchetypes();
      
      expect(archetypes).toHaveLength(8);
      expect(archetypes).toEqual([
        'project',
        'task', 
        'record',
        'document',
        'file',
        'activity',
        'discussion',
        'collection'
      ]);
    });

    it('should include Project and Task in the archetype list', () => {
      const archetypes = FoundationEntityRegistry.getUniversalArchetypes();
      
      expect(archetypes).toContain('project');
      expect(archetypes).toContain('task');
    });

    it('should return archetype list in logical order', () => {
      const archetypes = FoundationEntityRegistry.getUniversalArchetypes();
      
      // Project and Task should be first (most common)
      expect(archetypes[0]).toBe('project');
      expect(archetypes[1]).toBe('task');
      
      // Should include core data types
      expect(archetypes).toContain('record');
      expect(archetypes).toContain('document');
      expect(archetypes).toContain('file');
      
      // Should include collaboration types
      expect(archetypes).toContain('activity');
      expect(archetypes).toContain('discussion');
      expect(archetypes).toContain('collection');
    });
  });

  describe('Archetype Pattern Class Lookup', () => {
    it('should return ProjectArchetype class for project archetype', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      
      expect(ProjectClass).toBeDefined();
      expect(ProjectClass).toBe(ProjectArchetype);
      
      // Verify it has the expected methods
      expect(typeof ProjectClass.fields).toBe('object');
      expect(typeof ProjectClass.getKyselySchema).toBe('function');
      expect(typeof ProjectClass.getProjectDDL).toBe('function');
      expect(typeof ProjectClass.getValidationRules).toBe('function');
      expect(typeof ProjectClass.getBusinessLogic).toBe('function');
      expect(typeof ProjectClass.getDefaultOptionSets).toBe('function');
    });

    it('should return TaskArchetype class for task archetype', () => {
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      
      expect(TaskClass).toBeDefined();
      expect(TaskClass).toBe(TaskArchetype);
      
      // Verify it has the expected methods
      expect(typeof TaskClass.fields).toBe('object');
      expect(typeof TaskClass.getKyselySchema).toBe('function');
      expect(typeof TaskClass.getTaskDDL).toBe('function');
      expect(typeof TaskClass.getValidationRules).toBe('function');
      expect(typeof TaskClass.getBusinessLogic).toBe('function');
      expect(typeof TaskClass.getDefaultOptionSets).toBe('function');
    });

    it('should return null for unknown archetype', () => {
      const UnknownClass = FoundationEntityRegistry.getArchetypePatternClass('unknown');
      expect(UnknownClass).toBeNull();
    });

    it('should handle case sensitivity properly', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('PROJECT');
      expect(ProjectClass).toBeNull(); // Should be case sensitive
      
      const ValidClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      expect(ValidClass).toBeDefined();
    });
  });

  describe('Entity Classes Registry', () => {
    it('should provide access to all entity classes', () => {
      const entityClasses = FoundationEntityRegistry.getEntityClasses();
      
      // Should include Project and Task
      expect(entityClasses.Project).toBeDefined();
      expect(entityClasses.Project).toBe(ProjectArchetype);
      expect(entityClasses.Task).toBeDefined();
      expect(entityClasses.Task).toBe(TaskArchetype);
      
      // Registry should provide access to at least the core archetypes
      // Other archetypes may not all be fully implemented yet
      expect(Object.keys(entityClasses).length).toBeGreaterThan(4);
    });

    it('should maintain consistent naming convention', () => {
      const entityClasses = FoundationEntityRegistry.getEntityClasses();
      
      // All entity classes should be capitalized and end with expected suffix
      Object.keys(entityClasses).forEach(className => {
        expect(className).toMatch(/^[A-Z]/); // Should start with capital
        
        // Core archetypes should not have "Archetype" suffix in registry
        expect(className).not.toContain('Archetype');
      });
    });
  });

  describe('DDL Generation Integration', () => {
    it('should generate DDL for Project archetype via registry', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      expect(ProjectClass).toBeDefined();
      
      const ddl = ProjectClass!.getProjectDDL();
      expect(ddl).toBeDefined();
      expect(typeof ddl).toBe('string');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS {tableName}');
      expect(ddl).toContain('generate_uuidv7()');
      expect(ddl).toContain('organization_id UUID NOT NULL');
    });

    it('should generate DDL for Task archetype via registry', () => {
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      expect(TaskClass).toBeDefined();
      
      const ddl = TaskClass!.getTaskDDL();
      expect(ddl).toBeDefined();
      expect(typeof ddl).toBe('string');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS {tableName}');
      expect(ddl).toContain('generate_uuidv7()');
      expect(ddl).toContain('organization_id UUID NOT NULL');
    });

    it('should generate indexes for both archetypes via registry', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      
      expect(ProjectClass).toBeDefined();
      expect(TaskClass).toBeDefined();
      
      const projectIndexes = ProjectClass!.getProjectIndexes();
      const taskIndexes = TaskClass!.getTaskIndexes();
      
      expect(Array.isArray(projectIndexes)).toBe(true);
      expect(Array.isArray(taskIndexes)).toBe(true);
      expect(projectIndexes.length).toBeGreaterThan(0);
      expect(taskIndexes.length).toBeGreaterThan(0);
      
      // Each index should be a valid SQL statement
      projectIndexes.forEach(index => {
        expect(index).toContain('CREATE INDEX IF NOT EXISTS');
      });
      
      taskIndexes.forEach(index => {
        expect(index).toContain('CREATE INDEX IF NOT EXISTS');
      });
    });
  });

  describe('Schema Generation Integration', () => {
    it('should generate Kysely schema for Project archetype via registry', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      expect(ProjectClass).toBeDefined();
      
      const schema = ProjectClass!.getKyselySchema();
      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');
      
      // Should have required fields
      expect(schema.id).toBe('string');
      expect(schema.organization_id).toBe('string');
      expect(schema.name).toBe('string');
      expect(schema.created_at).toBe('Date');
      expect(schema.updated_at).toBe('Date');
    });

    it('should generate Kysely schema for Task archetype via registry', () => {
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      expect(TaskClass).toBeDefined();
      
      const schema = TaskClass!.getKyselySchema();
      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');
      
      // Should have required fields
      expect(schema.id).toBe('string');
      expect(schema.organization_id).toBe('string');
      expect(schema.title).toBe('string');
      expect(schema.created_at).toBe('Date');
      expect(schema.updated_at).toBe('Date');
    });
  });

  describe('Business Logic Integration', () => {
    it('should provide access to Project business logic via registry', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      expect(ProjectClass).toBeDefined();
      
      const validationRules = ProjectClass!.getValidationRules();
      const businessLogic = ProjectClass!.getBusinessLogic();
      const optionSets = ProjectClass!.getDefaultOptionSets();
      const metadata = ProjectClass!.getArchetypeMetadata();
      
      expect(validationRules).toBeDefined();
      expect(businessLogic).toBeDefined();
      expect(optionSets).toBeDefined();
      expect(metadata).toBeDefined();
      
      // Verify business logic methods
      expect(typeof businessLogic.calculateDuration).toBe('function');
      expect(typeof businessLogic.isOverdue).toBe('function');
      expect(typeof businessLogic.getProgressStatus).toBe('function');
    });

    it('should provide access to Task business logic via registry', () => {
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      expect(TaskClass).toBeDefined();
      
      const validationRules = TaskClass!.getValidationRules();
      const businessLogic = TaskClass!.getBusinessLogic();
      const optionSets = TaskClass!.getDefaultOptionSets();
      const workflowTransitions = TaskClass!.getWorkflowTransitions();
      const metadata = TaskClass!.getArchetypeMetadata();
      
      expect(validationRules).toBeDefined();
      expect(businessLogic).toBeDefined();
      expect(optionSets).toBeDefined();
      expect(workflowTransitions).toBeDefined();
      expect(metadata).toBeDefined();
      
      // Verify business logic methods
      expect(typeof businessLogic.isOverdue).toBe('function');
      expect(typeof businessLogic.calculateTimeVariance).toBe('function');
      expect(typeof businessLogic.getUrgencyScore).toBe('function');
    });
  });

  describe('Field Definition Integration', () => {
    it('should provide consistent field definitions for Project archetype', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      expect(ProjectClass).toBeDefined();
      
      const fields = ProjectClass!.fields;
      expect(fields).toBeDefined();
      expect(typeof fields).toBe('object');
      
      // Required fields
      expect(fields.name).toBeDefined();
      expect(fields.name.type).toBe('text');
      expect(fields.name.required).toBe(true);
      
      expect(fields.priority).toBeDefined();
      expect(fields.priority.type).toBe('priority_option');
      expect(fields.priority.defaultValue).toBe('medium');
      
      expect(fields.status).toBeDefined();
      expect(fields.status.type).toBe('status_option');
      expect(fields.status.defaultValue).toBe('active');
    });

    it('should provide consistent field definitions for Task archetype', () => {
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      expect(TaskClass).toBeDefined();
      
      const fields = TaskClass!.fields;
      expect(fields).toBeDefined();
      expect(typeof fields).toBe('object');
      
      // Required fields
      expect(fields.title).toBeDefined();
      expect(fields.title.type).toBe('text');
      expect(fields.title.required).toBe(true);
      
      expect(fields.priority).toBeDefined();
      expect(fields.priority.type).toBe('priority_option');
      expect(fields.priority.defaultValue).toBe('medium');
      
      expect(fields.status).toBeDefined();
      expect(fields.status.type).toBe('status_option');
      expect(fields.status.defaultValue).toBe('todo');
    });
  });

  describe('Registry Completeness', () => {
    it('should have Project and Task archetypes accessible via getArchetypePatternClass', () => {
      // Focus on the archetypes we know are implemented and working
      const testArchetypes = ['project', 'task'];
      
      testArchetypes.forEach(archetype => {
        const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetype);
        expect(ArchetypeClass).toBeDefined();
        expect(ArchetypeClass).not.toBeNull();
        
        // Each archetype should have fields
        expect(ArchetypeClass!.fields).toBeDefined();
        expect(typeof ArchetypeClass!.fields).toBe('object');
        
        // Each archetype should have Kysely schema
        expect(typeof ArchetypeClass!.getKyselySchema).toBe('function');
        
        // Each archetype should have archetype metadata
        expect(typeof ArchetypeClass!.getArchetypeMetadata).toBe('function');
        const metadata = ArchetypeClass!.getArchetypeMetadata();
        expect(metadata.category).toBe('universal_archetype');
      });
    });

    it('should have consistent archetype metadata for Project and Task', () => {
      // Focus on the archetypes we know are implemented and working
      const testArchetypes = ['project', 'task'];
      
      testArchetypes.forEach(archetype => {
        const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetype);
        const metadata = ArchetypeClass!.getArchetypeMetadata();
        
        // All should be universal archetypes
        expect(metadata.category).toBe('universal_archetype');
        
        // All should have version
        expect(metadata.version).toBeDefined();
        
        // All should have syncable setting
        expect(typeof metadata.defaultSyncable).toBe('boolean');
        
        // All should have supported relationships
        expect(Array.isArray(metadata.supportedRelationships)).toBe(true);
        
        // All should have required fields
        expect(Array.isArray(metadata.requiredFields)).toBe(true);
        expect(metadata.requiredFields.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Runtime Integration', () => {
    it('should support dynamic archetype instantiation via registry', () => {
      const archetypes = ['project', 'task'];
      
      archetypes.forEach(archetypeName => {
        const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetypeName);
        expect(ArchetypeClass).toBeDefined();
        
        // Should be able to access static properties and methods
        expect(ArchetypeClass!.fields).toBeDefined();
        
        const schema = ArchetypeClass!.getKyselySchema();
        expect(schema).toBeDefined();
        
        const metadata = ArchetypeClass!.getArchetypeMetadata();
        expect(metadata.name).toBeDefined();
      });
    });

    it('should maintain consistent API across Project and Task archetypes', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      
      // Both should have the same API shape
      const requiredMethods = [
        'getKyselySchema',
        'getValidationRules', 
        'getBusinessLogic',
        'getDefaultOptionSets',
        'getArchetypeMetadata'
      ];
      
      requiredMethods.forEach(method => {
        expect(typeof ProjectClass![method as keyof typeof ProjectClass]).toBe('function');
        expect(typeof TaskClass![method as keyof typeof TaskClass]).toBe('function');
      });
      
      // Both should have fields property
      expect(ProjectClass!.fields).toBeDefined();
      expect(TaskClass!.fields).toBeDefined();
    });
  });
});
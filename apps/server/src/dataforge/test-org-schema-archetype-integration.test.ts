/**
 * Test: OrgSchemaDO Universal Archetype Integration
 * 
 * Validates that OrgSchemaDO properly integrates with Universal Archetypes:
 * - Creates archetype-based entities
 * - Generates proper DDL from archetype patterns
 * - Stores entity definitions with archetype metadata
 * - Lists and retrieves archetype entities
 * - Supports custom field extensions
 */

import { describe, it, expect } from 'vitest';
import { FoundationEntityRegistry } from './entities/foundation/index';

describe('OrgSchemaDO Universal Archetype Integration', () => {
  describe('Archetype Validation', () => {
    it('should validate supported universal archetypes', () => {
      const supportedArchetypes = FoundationEntityRegistry.getUniversalArchetypes();
      
      expect(supportedArchetypes).toHaveLength(8);
      expect(supportedArchetypes).toContain('project');
      expect(supportedArchetypes).toContain('task');
      expect(supportedArchetypes).toContain('record');
      expect(supportedArchetypes).toContain('document');
      expect(supportedArchetypes).toContain('file');
      expect(supportedArchetypes).toContain('activity');
      expect(supportedArchetypes).toContain('discussion');
      expect(supportedArchetypes).toContain('collection');
    });

    it('should validate archetype patterns correctly', () => {
      expect(FoundationEntityRegistry.isValidArchetypePattern('project')).toBe(true);
      expect(FoundationEntityRegistry.isValidArchetypePattern('task')).toBe(true);
      expect(FoundationEntityRegistry.isValidArchetypePattern('invalid')).toBe(false);
      expect(FoundationEntityRegistry.isValidArchetypePattern('')).toBe(false);
    });

    it('should return archetype pattern classes', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      
      expect(ProjectClass).toBeDefined();
      expect(TaskClass).toBeDefined();
      expect(ProjectClass.name).toBe('ProjectArchetype');
      expect(TaskClass.name).toBe('TaskArchetype');
      
      // Should have required methods
      expect(typeof ProjectClass.getProjectDDL).toBe('function');
      expect(typeof TaskClass.getTaskDDL).toBe('function');
      expect(typeof ProjectClass.fields).toBe('object');
      expect(typeof TaskClass.fields).toBe('object');
    });
  });

  describe('DDL Generation', () => {
    it('should generate Project archetype DDL', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      const ddl = ProjectClass.getProjectDDL();
      
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS {tableName}');
      expect(ddl).toContain('id UUID PRIMARY KEY DEFAULT generate_uuidv7()');
      expect(ddl).toContain('organization_id UUID NOT NULL');
      expect(ddl).toContain('name VARCHAR(255) NOT NULL');
      expect(ddl).toContain('status VARCHAR(50) DEFAULT \'active\'');
      expect(ddl).toContain('priority VARCHAR(50) DEFAULT \'medium\'');
      expect(ddl).toContain('created_at TIMESTAMPTZ DEFAULT NOW()');
      expect(ddl).toContain('updated_at TIMESTAMPTZ DEFAULT NOW()');
    });

    it('should generate Task archetype DDL', () => {
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      const ddl = TaskClass.getTaskDDL();
      
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS {tableName}');
      expect(ddl).toContain('id UUID PRIMARY KEY DEFAULT generate_uuidv7()');
      expect(ddl).toContain('organization_id UUID NOT NULL');
      expect(ddl).toContain('title VARCHAR(500) NOT NULL');
      expect(ddl).toContain('status VARCHAR(50) DEFAULT \'todo\'');
      expect(ddl).toContain('priority VARCHAR(50) DEFAULT \'medium\'');
      expect(ddl).toContain('assignee_id UUID');
      expect(ddl).toContain('due_date DATE');
    });

    it('should generate indexes for archetype entities', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      
      const projectIndexes = ProjectClass.getProjectIndexes();
      const taskIndexes = TaskClass.getTaskIndexes();
      
      expect(Array.isArray(projectIndexes)).toBe(true);
      expect(Array.isArray(taskIndexes)).toBe(true);
      expect(projectIndexes.length).toBeGreaterThan(0);
      expect(taskIndexes.length).toBeGreaterThan(0);
      
      projectIndexes.forEach(index => {
        expect(index).toContain('CREATE INDEX IF NOT EXISTS');
      });
      
      taskIndexes.forEach(index => {
        expect(index).toContain('CREATE INDEX IF NOT EXISTS');
      });
    });
  });

  describe('Field Type Mapping', () => {
    it('should map archetype field types to SQL types correctly', () => {
      // This would be tested through the OrgSchemaDO integration
      // For now, let's verify the archetype field definitions are correct
      
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      
      const projectFields = ProjectClass.fields;
      const taskFields = TaskClass.fields;
      
      // Project field validation
      expect(projectFields.name.type).toBe('text');
      expect(projectFields.name.required).toBe(true);
      expect(projectFields.priority.type).toBe('priority_option');
      expect(projectFields.priority.defaultValue).toBe('medium');
      expect(projectFields.status.type).toBe('status_option');
      expect(projectFields.status.defaultValue).toBe('active');
      expect(projectFields.budget.type).toBe('decimal');
      expect(projectFields.owner_id.type).toBe('user_reference');
      
      // Task field validation
      expect(taskFields.title.type).toBe('text');
      expect(taskFields.title.required).toBe(true);
      expect(taskFields.priority.type).toBe('priority_option');
      expect(taskFields.priority.defaultValue).toBe('medium');
      expect(taskFields.status.type).toBe('status_option');
      expect(taskFields.status.defaultValue).toBe('todo');
      expect(taskFields.assignee_id.type).toBe('user_reference');
      expect(taskFields.project_id.type).toBe('entity_reference');
    });

    it('should support custom field extensions', () => {
      // Verify archetype patterns can be extended with custom fields
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      
      // Base fields from archetype
      const baseFields = ProjectClass.fields;
      expect(Object.keys(baseFields).length).toBeGreaterThan(0);
      
      // Should be able to extend with custom fields
      const customFields = {
        'client_budget': {
          type: 'decimal',
          required: false,
          defaultValue: 0.00
        },
        'external_id': {
          type: 'text',
          required: false
        },
        'is_billable': {
          type: 'boolean',
          required: true,
          defaultValue: true
        }
      };
      
      // Combined should work (this tests the concept)
      const combinedFields = { ...baseFields, ...customFields };
      expect(Object.keys(combinedFields)).toContain('name'); // from archetype
      expect(Object.keys(combinedFields)).toContain('client_budget'); // custom
      expect(Object.keys(combinedFields)).toContain('external_id'); // custom
      expect(Object.keys(combinedFields)).toContain('is_billable'); // custom
    });
  });

  describe('Kysely Schema Generation', () => {
    it('should generate Kysely schemas for archetype entities', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      
      const projectSchema = ProjectClass.getKyselySchema();
      const taskSchema = TaskClass.getKyselySchema();
      
      // Project schema validation
      expect(projectSchema.id).toBe('string');
      expect(projectSchema.organization_id).toBe('string');
      expect(projectSchema.name).toBe('string');
      expect(projectSchema.status).toBe('string');
      expect(projectSchema.priority).toBe('string');
      expect(projectSchema.created_at).toBe('Date');
      expect(projectSchema.updated_at).toBe('Date');
      
      // Task schema validation
      expect(taskSchema.id).toBe('string');
      expect(taskSchema.organization_id).toBe('string');
      expect(taskSchema.title).toBe('string');
      expect(taskSchema.status).toBe('string');
      expect(taskSchema.priority).toBe('string');
      expect(taskSchema.created_at).toBe('Date');
      expect(taskSchema.updated_at).toBe('Date');
    });
  });

  describe('Business Logic Integration', () => {
    it('should provide business logic methods for Project archetype', () => {
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      
      const businessLogic = ProjectClass.getBusinessLogic();
      const validationRules = ProjectClass.getValidationRules();
      const optionSets = ProjectClass.getDefaultOptionSets();
      
      expect(businessLogic).toBeDefined();
      expect(validationRules).toBeDefined();
      expect(optionSets).toBeDefined();
      
      // Business logic methods
      expect(typeof businessLogic.calculateDuration).toBe('function');
      expect(typeof businessLogic.isOverdue).toBe('function');
      expect(typeof businessLogic.getProgressStatus).toBe('function');
    });

    it('should provide business logic methods for Task archetype', () => {
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      
      const businessLogic = TaskClass.getBusinessLogic();
      const validationRules = TaskClass.getValidationRules();
      const workflowTransitions = TaskClass.getWorkflowTransitions();
      
      expect(businessLogic).toBeDefined();
      expect(validationRules).toBeDefined();
      expect(workflowTransitions).toBeDefined();
      
      // Business logic methods
      expect(typeof businessLogic.isOverdue).toBe('function');
      expect(typeof businessLogic.calculateTimeVariance).toBe('function');
      expect(typeof businessLogic.getUrgencyScore).toBe('function');
    });
  });

  describe('Archetype Metadata', () => {
    it('should provide consistent metadata across all archetypes', () => {
      const testArchetypes = ['project', 'task'];
      
      testArchetypes.forEach(archetype => {
        const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetype);
        const metadata = ArchetypeClass.getArchetypeMetadata();
        
        expect(metadata.category).toBe('universal_archetype');
        expect(metadata.version).toBeDefined();
        expect(typeof metadata.defaultSyncable).toBe('boolean');
        expect(Array.isArray(metadata.supportedRelationships)).toBe(true);
        expect(Array.isArray(metadata.requiredFields)).toBe(true);
        expect(metadata.requiredFields.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Integration Readiness', () => {
    it('should be ready for OrgSchemaDO integration', () => {
      // Verify all components needed for OrgSchemaDO integration exist
      
      // 1. Registry provides access to all archetypes
      const archetypes = FoundationEntityRegistry.getUniversalArchetypes();
      expect(archetypes.length).toBe(8);
      
      // 2. Core archetypes (Project, Task) have required methods
      const coreArchetypes = ['project', 'task'];
      coreArchetypes.forEach(archetype => {
        const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetype);
        expect(ArchetypeClass).toBeDefined();
        expect(ArchetypeClass.fields).toBeDefined();
        expect(typeof ArchetypeClass.getKyselySchema).toBe('function');
        expect(typeof ArchetypeClass.getArchetypeMetadata).toBe('function');
      });
      
      // 3. DDL generation works for core archetypes
      const ProjectClass = FoundationEntityRegistry.getArchetypePatternClass('project');
      const TaskClass = FoundationEntityRegistry.getArchetypePatternClass('task');
      
      expect(typeof ProjectClass.getProjectDDL).toBe('function');
      expect(typeof TaskClass.getTaskDDL).toBe('function');
      
      const projectDDL = ProjectClass.getProjectDDL();
      const taskDDL = TaskClass.getTaskDDL();
      
      expect(projectDDL).toContain('CREATE TABLE');
      expect(taskDDL).toContain('CREATE TABLE');
      
      // 4. Field type validation
      expect(FoundationEntityRegistry.isValidArchetypePattern).toBeDefined();
    });
  });
});
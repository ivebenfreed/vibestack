/**
 * Test 4: Business Logic Validation Methods
 * 
 * Validates that Project and Task archetypes have comprehensive business logic including:
 * - Validation rules
 * - Business calculation methods
 * - Status and workflow logic
 * - Utility functions
 * - Data formatting and transformation
 */

import { describe, it, expect } from 'vitest';
import { ProjectArchetype, ProjectUtilities } from './entities/foundation/archetypes/Project';
import { TaskArchetype, TaskUtilities } from './entities/foundation/archetypes/Task';

describe('Test 4: Business Logic Validation Methods', () => {
  describe('ProjectArchetype Business Logic', () => {
    it('should provide comprehensive validation rules', () => {
      const rules = ProjectArchetype.getValidationRules();
      
      // Name validation
      expect(rules.name).toEqual({
        required: true,
        minLength: 2,
        maxLength: 255,
        pattern: /^[a-zA-Z0-9\s\-_\.]+$/
      });
      
      // Priority validation
      expect(rules.priority).toEqual({
        enum: ['low', 'medium', 'high', 'critical']
      });
      
      // Progress validation
      expect(rules.progress_percentage).toEqual({
        type: 'integer',
        min: 0,
        max: 100
      });
      
      // Date validation
      expect(rules.end_date).toEqual({
        type: 'date',
        afterField: 'start_date'
      });
    });

    it('should provide business calculation methods', () => {
      const logic = ProjectArchetype.getBusinessLogic();
      
      // Test duration calculation
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-10');
      const duration = logic.calculateDuration(startDate, endDate);
      expect(duration).toBe(9);
      
      // Test overdue check
      const pastDate = new Date('2023-12-31');
      const futureDate = new Date('2025-12-31');
      expect(logic.isOverdue(pastDate, 'active')).toBe(true);
      expect(logic.isOverdue(futureDate, 'active')).toBe(false);
      expect(logic.isOverdue(pastDate, 'completed')).toBe(false);
      
      // Test progress status
      expect(logic.getProgressStatus(0)).toBe('not_started');
      expect(logic.getProgressStatus(25)).toBe('early_progress');
      expect(logic.getProgressStatus(50)).toBe('halfway');
      expect(logic.getProgressStatus(75)).toBe('nearly_complete');
      expect(logic.getProgressStatus(100)).toBe('completed');
      
      // Test priority urgency
      expect(logic.getPriorityUrgency('low')).toBe(1);
      expect(logic.getPriorityUrgency('medium')).toBe(2);
      expect(logic.getPriorityUrgency('high')).toBe(3);
      expect(logic.getPriorityUrgency('critical')).toBe(4);
    });

    it('should provide archetype metadata', () => {
      const metadata = ProjectArchetype.getArchetypeMetadata();
      
      expect(metadata.name).toBe('Project');
      expect(metadata.category).toBe('universal_archetype');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.defaultSyncable).toBe(true);
      expect(metadata.requiredFields).toEqual(['name', 'priority']);
      expect(metadata.recommendedFields).toEqual(['description', 'start_date', 'end_date', 'owner_id']);
      expect(metadata.supportedRelationships).toContain('contains');
      expect(metadata.supportedRelationships).toContain('depends_on');
    });
  });

  describe('ProjectUtilities Business Logic', () => {
    it('should generate project codes correctly', () => {
      const code1 = ProjectUtilities.generateProjectCode('My Test Project', 'ABC');
      expect(code1).toMatch(/^ABC-MYTEST-\d{4}$/);
      
      const code2 = ProjectUtilities.generateProjectCode('Simple');
      expect(code2).toMatch(/^ORG-SIMPLE-\d{4}$/);
    });

    it('should calculate health scores accurately', () => {
      // Healthy project
      const healthyProject = {
        priority: 'medium',
        end_date: new Date('2025-12-31'),
        start_date: new Date('2024-01-01'),
        progress_percentage: 50
      };
      const healthScore = ProjectUtilities.calculateHealthScore(healthyProject);
      expect(healthScore).toBeGreaterThan(70);
      
      // Overdue project
      const overdueProject = {
        priority: 'high',
        end_date: new Date('2023-12-31'),
        progress_percentage: 30
      };
      const overdueScore = ProjectUtilities.calculateHealthScore(overdueProject);
      expect(overdueScore).toBeLessThan(80);
    });

    it('should determine project phases correctly', () => {
      expect(ProjectUtilities.getProjectPhase(0)).toBe('initiation');
      expect(ProjectUtilities.getProjectPhase(20)).toBe('planning');
      expect(ProjectUtilities.getProjectPhase(50)).toBe('execution');
      expect(ProjectUtilities.getProjectPhase(85)).toBe('monitoring');
      expect(ProjectUtilities.getProjectPhase(100)).toBe('closure');
    });

    it('should format project data for API responses', () => {
      const mockProject = {
        id: 'test-id',
        name: 'Test Project',
        description: 'Test description',
        priority: 'high',
        status: 'active',
        progress_percentage: 75,
        start_date: new Date('2024-01-01'),
        end_date: new Date('2025-12-31'),
        budget: 50000,
        owner_id: 'owner-id',
        project_type: 'software',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const formatted = ProjectUtilities.toPublicFormat(mockProject);
      
      expect(formatted.id).toBe('test-id');
      expect(formatted.name).toBe('Test Project');
      expect(formatted.progress.percentage).toBe(75);
      expect(formatted.progress.phase).toBe('monitoring');
      expect(formatted.timeline.duration).toBeGreaterThan(300);
      expect(formatted.timeline.isOverdue).toBe(false);
    });
  });

  describe('TaskArchetype Business Logic', () => {
    it('should provide comprehensive validation rules', () => {
      const rules = TaskArchetype.getValidationRules();
      
      // Title validation
      expect(rules.title).toEqual({
        required: true,
        minLength: 3,
        maxLength: 500,
        pattern: /^[a-zA-Z0-9\s\-_\.\,\!\?\:]+$/
      });
      
      // Priority validation
      expect(rules.priority).toEqual({
        enum: ['low', 'medium', 'high', 'critical']
      });
      
      // Status validation
      expect(rules.status).toEqual({
        enum: ['todo', 'in_progress', 'review', 'blocked', 'completed', 'cancelled']
      });
      
      // Story points validation
      expect(rules.story_points).toEqual({
        type: 'integer',
        min: 0,
        max: 100
      });
    });

    it('should provide business calculation methods', () => {
      const logic = TaskArchetype.getBusinessLogic();
      
      // Test overdue check
      const pastDate = new Date('2023-12-31');
      const futureDate = new Date('2025-12-31');
      expect(logic.isOverdue(pastDate, 'todo')).toBe(true);
      expect(logic.isOverdue(futureDate, 'todo')).toBe(false);
      expect(logic.isOverdue(pastDate, 'completed')).toBe(false);
      
      // Test time variance calculation
      expect(logic.calculateTimeVariance(10, 12)).toBe(20); // 20% over
      expect(logic.calculateTimeVariance(10, 8)).toBe(-20); // 20% under
      
      // Test complexity determination
      expect(logic.getComplexity(1)).toBe('trivial');
      expect(logic.getComplexity(3)).toBe('simple');
      expect(logic.getComplexity(6)).toBe('medium');
      expect(logic.getComplexity(10)).toBe('complex');
      expect(logic.getComplexity(20)).toBe('epic');
      
      // Test urgency score
      const urgencyScore = logic.getUrgencyScore('high', pastDate, 'in_progress');
      expect(urgencyScore).toBeGreaterThan(5);
    });

    it('should provide workflow transitions', () => {
      const transitions = TaskArchetype.getWorkflowTransitions();
      
      expect(transitions.todo).toEqual(['in_progress', 'cancelled']);
      expect(transitions.in_progress).toEqual(['review', 'blocked', 'completed', 'todo', 'cancelled']);
      expect(transitions.review).toEqual(['completed', 'in_progress', 'todo']);
      expect(transitions.blocked).toEqual(['todo', 'in_progress', 'cancelled']);
      expect(transitions.completed).toEqual([]);
      expect(transitions.cancelled).toEqual(['todo']);
    });

    it('should calculate progress percentage correctly', () => {
      const logic = TaskArchetype.getBusinessLogic();
      
      expect(logic.getProgressPercentage('todo')).toBe(0);
      expect(logic.getProgressPercentage('in_progress')).toBe(25);
      expect(logic.getProgressPercentage('review')).toBe(90);
      expect(logic.getProgressPercentage('completed')).toBe(100);
      expect(logic.getProgressPercentage('cancelled')).toBe(0);
      
      // With actual hours
      expect(logic.getProgressPercentage('in_progress', 5, 10)).toBe(40);
    });

    it('should provide archetype metadata', () => {
      const metadata = TaskArchetype.getArchetypeMetadata();
      
      expect(metadata.name).toBe('Task');
      expect(metadata.category).toBe('universal_archetype');
      expect(metadata.workflowEnabled).toBe(true);
      expect(metadata.requiredFields).toEqual(['title', 'priority', 'status']);
      expect(metadata.recommendedFields).toEqual(['description', 'assignee_id', 'due_date', 'task_type']);
      expect(metadata.supportedRelationships).toContain('depends_on');
      expect(metadata.supportedRelationships).toContain('child_of');
    });
  });

  describe('TaskUtilities Business Logic', () => {
    it('should generate task codes correctly', () => {
      const code1 = TaskUtilities.generateTaskCode('Fix bug in auth', 'bug', 'PRJ');
      expect(code1).toMatch(/^PRJ-BUG-\d{4}$/);
      
      const code2 = TaskUtilities.generateTaskCode('New feature');
      expect(code2).toMatch(/^GEN-TSK-\d{4}$/);
    });

    it('should calculate health scores accurately', () => {
      // Healthy task
      const healthyTask = {
        status: 'in_progress',
        priority: 'medium',
        due_date: new Date('2025-12-31'),
        estimated_hours: 10,
        actual_hours: 8
      };
      const healthScore = TaskUtilities.calculateHealthScore(healthyTask);
      expect(healthScore).toBeGreaterThan(80);
      
      // Problematic task
      const problematicTask = {
        status: 'blocked',
        priority: 'critical',
        due_date: new Date('2023-12-31'),
        estimated_hours: 10,
        actual_hours: 20
      };
      const problemScore = TaskUtilities.calculateHealthScore(problematicTask);
      expect(problemScore).toBeLessThan(50);
    });

    it('should validate status transitions correctly', () => {
      expect(TaskUtilities.isValidStatusTransition('todo', 'in_progress')).toBe(true);
      expect(TaskUtilities.isValidStatusTransition('in_progress', 'completed')).toBe(true);
      expect(TaskUtilities.isValidStatusTransition('completed', 'todo')).toBe(false);
      expect(TaskUtilities.isValidStatusTransition('todo', 'review')).toBe(false);
    });

    it('should get next valid statuses correctly', () => {
      expect(TaskUtilities.getNextValidStatuses('todo')).toEqual(['in_progress', 'cancelled']);
      expect(TaskUtilities.getNextValidStatuses('in_progress')).toEqual(['review', 'blocked', 'completed', 'todo', 'cancelled']);
      expect(TaskUtilities.getNextValidStatuses('completed')).toEqual([]);
    });

    it('should calculate burndown data correctly', () => {
      const tasks = [
        { status: 'completed', story_points: 5 },
        { status: 'completed', story_points: 3 },
        { status: 'in_progress', story_points: 8 },
        { status: 'todo', story_points: 2 }
      ];
      
      const burndown = TaskUtilities.calculateBurndown(tasks);
      
      expect(burndown.totalStoryPoints).toBe(18);
      expect(burndown.completedStoryPoints).toBe(8);
      expect(burndown.remainingStoryPoints).toBe(10);
      expect(burndown.completionPercentage).toBeCloseTo(44.44, 1);
    });

    it('should format task data for API responses', () => {
      const mockTask = {
        id: 'task-id',
        title: 'Test Task',
        description: 'Test description',
        priority: 'high',
        status: 'in_progress',
        assignee_id: 'assignee-id',
        reporter_id: 'reporter-id',
        due_date: new Date('2025-12-31'),
        estimated_hours: 10,
        actual_hours: 6,
        story_points: 5,
        parent_task_id: 'parent-id',
        project_id: 'project-id',
        sprint_id: 'sprint-id',
        task_type: 'feature',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const formatted = TaskUtilities.toPublicFormat(mockTask);
      
      expect(formatted.id).toBe('task-id');
      expect(formatted.title).toBe('Test Task');
      expect(formatted.workflow.nextValidStatuses).toContain('review');
      expect(formatted.workflow.nextValidStatuses).toContain('completed');
      expect(formatted.effort.complexity).toBe('simple');
      expect(formatted.effort.variance).toBe(-40); // 6/10 = 60%, -40% variance
      expect(formatted.timeline.isOverdue).toBe(false);
      expect(formatted.health.score).toBeGreaterThan(50);
    });
  });

  describe('Option Sets and Default Configurations', () => {
    it('should provide comprehensive option sets for Project archetype', () => {
      const optionSets = ProjectArchetype.getDefaultOptionSets();
      
      // Priority options
      expect(optionSets.priority.name).toBe('Project Priority');
      expect(optionSets.priority.options).toHaveLength(4);
      expect(optionSets.priority.options[0]).toEqual({
        value: 'low',
        label: 'Low',
        color: '#10B981',
        sortOrder: 1
      });
      
      // Status options
      expect(optionSets.status.name).toBe('Project Status');
      expect(optionSets.status.options).toHaveLength(5);
      expect(optionSets.status.options.find(opt => opt.value === 'active')).toBeDefined();
      
      // Project type options
      expect(optionSets.project_type.name).toBe('Project Type');
      expect(optionSets.project_type.options).toHaveLength(5);
      expect(optionSets.project_type.options.find(opt => opt.value === 'software')).toBeDefined();
    });

    it('should provide comprehensive option sets for Task archetype', () => {
      const optionSets = TaskArchetype.getDefaultOptionSets();
      
      // Priority options
      expect(optionSets.priority.name).toBe('Task Priority');
      expect(optionSets.priority.options).toHaveLength(4);
      
      // Status options
      expect(optionSets.status.name).toBe('Task Status');
      expect(optionSets.status.options).toHaveLength(6);
      expect(optionSets.status.options.find(opt => opt.value === 'blocked')).toBeDefined();
      
      // Task type options
      expect(optionSets.task_type.name).toBe('Task Type');
      expect(optionSets.task_type.options).toHaveLength(5);
      expect(optionSets.task_type.options.find(opt => opt.value === 'bug')).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined values gracefully', () => {
      const projectLogic = ProjectArchetype.getBusinessLogic();
      const taskLogic = TaskArchetype.getBusinessLogic();
      
      // Project logic with null dates
      expect(projectLogic.calculateDuration(null as any, null as any)).toBe(0);
      expect(projectLogic.isOverdue(null as any, 'active')).toBe(false);
      
      // Task logic with null values
      expect(taskLogic.calculateTimeVariance(null as any, null as any)).toBe(0);
      expect(taskLogic.getComplexity(null as any)).toBe('unknown');
      expect(taskLogic.getProgressPercentage('in_progress', null, null)).toBe(25);
    });

    it('should handle invalid input values', () => {
      const projectLogic = ProjectArchetype.getBusinessLogic();
      const taskLogic = TaskArchetype.getBusinessLogic();
      
      // Invalid priority should return default
      expect(projectLogic.getPriorityUrgency('invalid' as any)).toBe(1);
      expect(taskLogic.getUrgencyScore('invalid' as any, new Date(), 'todo')).toBeGreaterThan(0);
    });

    it('should validate edge cases in health calculations', () => {
      // Project with no dates
      const projectNoData = {};
      const projectHealth = ProjectUtilities.calculateHealthScore(projectNoData);
      expect(projectHealth).toBe(100); // Should start at max
      
      // Task with extreme values
      const taskExtreme = {
        status: 'blocked',
        priority: 'critical',
        estimated_hours: 1,
        actual_hours: 100
      };
      const taskHealth = TaskUtilities.calculateHealthScore(taskExtreme);
      expect(taskHealth).toBeLessThan(50);
    });
  });
});
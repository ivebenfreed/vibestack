/**
 * Test 5: Option Sets and Default Configurations
 * 
 * Validates that Project and Task archetypes provide comprehensive option sets including:
 * - Priority option sets with proper values and colors
 * - Status option sets with workflow logic
 * - Category/type option sets with business context
 * - Proper color coding and sort ordering
 * - Complete option metadata
 */

import { describe, it, expect } from 'vitest';
import { ProjectArchetype } from './entities/foundation/archetypes/Project';
import { TaskArchetype } from './entities/foundation/archetypes/Task';

describe('Test 5: Option Sets and Default Configurations', () => {
  describe('Project Archetype Option Sets', () => {
    it('should provide comprehensive priority option set', () => {
      const optionSets = ProjectArchetype.getDefaultOptionSets();
      const priorityOptions = optionSets.priority;
      
      // Basic structure
      expect(priorityOptions.name).toBe('Project Priority');
      expect(priorityOptions.options).toHaveLength(4);
      
      // Validate each priority option
      const priorities = priorityOptions.options;
      
      // Low priority
      const low = priorities.find(p => p.value === 'low');
      expect(low).toEqual({
        value: 'low',
        label: 'Low',
        color: '#10B981',
        sortOrder: 1
      });
      
      // Medium priority
      const medium = priorities.find(p => p.value === 'medium');
      expect(medium).toEqual({
        value: 'medium',
        label: 'Medium',
        color: '#F59E0B',
        sortOrder: 2
      });
      
      // High priority
      const high = priorities.find(p => p.value === 'high');
      expect(high).toEqual({
        value: 'high',
        label: 'High',
        color: '#EF4444',
        sortOrder: 3
      });
      
      // Critical priority
      const critical = priorities.find(p => p.value === 'critical');
      expect(critical).toEqual({
        value: 'critical',
        label: 'Critical',
        color: '#991B1B',
        sortOrder: 4
      });
    });

    it('should provide comprehensive status option set', () => {
      const optionSets = ProjectArchetype.getDefaultOptionSets();
      const statusOptions = optionSets.status;
      
      // Basic structure
      expect(statusOptions.name).toBe('Project Status');
      expect(statusOptions.options).toHaveLength(5);
      
      // Validate status options
      const statuses = statusOptions.options;
      
      // Planning status
      const planning = statuses.find(s => s.value === 'planning');
      expect(planning).toEqual({
        value: 'planning',
        label: 'Planning',
        color: '#6B7280',
        sortOrder: 1
      });
      
      // Active status
      const active = statuses.find(s => s.value === 'active');
      expect(active).toEqual({
        value: 'active',
        label: 'Active',
        color: '#3B82F6',
        sortOrder: 2
      });
      
      // On Hold status
      const onHold = statuses.find(s => s.value === 'on_hold');
      expect(onHold).toEqual({
        value: 'on_hold',
        label: 'On Hold',
        color: '#F59E0B',
        sortOrder: 3
      });
      
      // Completed status
      const completed = statuses.find(s => s.value === 'completed');
      expect(completed).toEqual({
        value: 'completed',
        label: 'Completed',
        color: '#10B981',
        sortOrder: 4
      });
      
      // Cancelled status
      const cancelled = statuses.find(s => s.value === 'cancelled');
      expect(cancelled).toEqual({
        value: 'cancelled',
        label: 'Cancelled',
        color: '#EF4444',
        sortOrder: 5
      });
    });

    it('should provide comprehensive project type option set', () => {
      const optionSets = ProjectArchetype.getDefaultOptionSets();
      const typeOptions = optionSets.project_type;
      
      // Basic structure
      expect(typeOptions.name).toBe('Project Type');
      expect(typeOptions.options).toHaveLength(5);
      
      // Validate project type options
      const types = typeOptions.options;
      
      // Software Development
      const software = types.find(t => t.value === 'software');
      expect(software).toEqual({
        value: 'software',
        label: 'Software Development',
        color: '#8B5CF6',
        sortOrder: 1
      });
      
      // Research & Development
      const research = types.find(t => t.value === 'research');
      expect(research).toEqual({
        value: 'research',
        label: 'Research & Development',
        color: '#06B6D4',
        sortOrder: 2
      });
      
      // Marketing Campaign
      const marketing = types.find(t => t.value === 'marketing');
      expect(marketing).toEqual({
        value: 'marketing',
        label: 'Marketing Campaign',
        color: '#EC4899',
        sortOrder: 3
      });
      
      // Operational
      const operational = types.find(t => t.value === 'operational');
      expect(operational).toEqual({
        value: 'operational',
        label: 'Operational',
        color: '#84CC16',
        sortOrder: 4
      });
      
      // Strategic Initiative
      const strategic = types.find(t => t.value === 'strategic');
      expect(strategic).toEqual({
        value: 'strategic',
        label: 'Strategic Initiative',
        color: '#F97316',
        sortOrder: 5
      });
    });

    it('should have consistent color schemes across option sets', () => {
      const optionSets = ProjectArchetype.getDefaultOptionSets();
      
      // All options should have valid hex colors
      Object.values(optionSets).forEach(optionSet => {
        optionSet.options.forEach(option => {
          expect(option.color).toMatch(/^#[0-9A-F]{6}$/i);
        });
      });
      
      // Status colors should progress from gray to green/red appropriately
      const statusColors = optionSets.status.options.map(s => s.color);
      expect(statusColors).toContain('#6B7280'); // Gray for planning
      expect(statusColors).toContain('#3B82F6'); // Blue for active
      expect(statusColors).toContain('#10B981'); // Green for completed
      expect(statusColors).toContain('#EF4444'); // Red for cancelled
    });
  });

  describe('Task Archetype Option Sets', () => {
    it('should provide comprehensive priority option set', () => {
      const optionSets = TaskArchetype.getDefaultOptionSets();
      const priorityOptions = optionSets.priority;
      
      // Basic structure
      expect(priorityOptions.name).toBe('Task Priority');
      expect(priorityOptions.options).toHaveLength(4);
      
      // Should have same priority values as Project but with Task-specific naming
      const priorities = priorityOptions.options;
      const values = priorities.map(p => p.value);
      expect(values).toEqual(['low', 'medium', 'high', 'critical']);
      
      // Color scheme should be consistent with projects
      const critical = priorities.find(p => p.value === 'critical');
      expect(critical?.color).toBe('#991B1B');
    });

    it('should provide comprehensive status option set with workflow support', () => {
      const optionSets = TaskArchetype.getDefaultOptionSets();
      const statusOptions = optionSets.status;
      
      // Basic structure
      expect(statusOptions.name).toBe('Task Status');
      expect(statusOptions.options).toHaveLength(6);
      
      // Validate task-specific status options
      const statuses = statusOptions.options;
      
      // To Do status
      const todo = statuses.find(s => s.value === 'todo');
      expect(todo).toEqual({
        value: 'todo',
        label: 'To Do',
        color: '#6B7280',
        sortOrder: 1
      });
      
      // In Progress status
      const inProgress = statuses.find(s => s.value === 'in_progress');
      expect(inProgress).toEqual({
        value: 'in_progress',
        label: 'In Progress',
        color: '#3B82F6',
        sortOrder: 2
      });
      
      // Review status
      const review = statuses.find(s => s.value === 'review');
      expect(review).toEqual({
        value: 'review',
        label: 'Review',
        color: '#8B5CF6',
        sortOrder: 3
      });
      
      // Blocked status
      const blocked = statuses.find(s => s.value === 'blocked');
      expect(blocked).toEqual({
        value: 'blocked',
        label: 'Blocked',
        color: '#EF4444',
        sortOrder: 4
      });
      
      // Completed status
      const completed = statuses.find(s => s.value === 'completed');
      expect(completed).toEqual({
        value: 'completed',
        label: 'Completed',
        color: '#10B981',
        sortOrder: 5
      });
      
      // Cancelled status
      const cancelled = statuses.find(s => s.value === 'cancelled');
      expect(cancelled).toEqual({
        value: 'cancelled',
        label: 'Cancelled',
        color: '#6B7280',
        sortOrder: 6
      });
    });

    it('should provide comprehensive task type option set', () => {
      const optionSets = TaskArchetype.getDefaultOptionSets();
      const typeOptions = optionSets.task_type;
      
      // Basic structure
      expect(typeOptions.name).toBe('Task Type');
      expect(typeOptions.options).toHaveLength(5);
      
      // Validate task type options
      const types = typeOptions.options;
      
      // Bug Fix
      const bug = types.find(t => t.value === 'bug');
      expect(bug).toEqual({
        value: 'bug',
        label: 'Bug Fix',
        color: '#EF4444',
        sortOrder: 1
      });
      
      // New Feature
      const feature = types.find(t => t.value === 'feature');
      expect(feature).toEqual({
        value: 'feature',
        label: 'New Feature',
        color: '#10B981',
        sortOrder: 2
      });
      
      // Improvement
      const improvement = types.find(t => t.value === 'improvement');
      expect(improvement).toEqual({
        value: 'improvement',
        label: 'Improvement',
        color: '#3B82F6',
        sortOrder: 3
      });
      
      // Documentation
      const documentation = types.find(t => t.value === 'documentation');
      expect(documentation).toEqual({
        value: 'documentation',
        label: 'Documentation',
        color: '#8B5CF6',
        sortOrder: 4
      });
      
      // Maintenance
      const maintenance = types.find(t => t.value === 'maintenance');
      expect(maintenance).toEqual({
        value: 'maintenance',
        label: 'Maintenance',
        color: '#F59E0B',
        sortOrder: 5
      });
    });

    it('should have task-specific color coding that makes logical sense', () => {
      const optionSets = TaskArchetype.getDefaultOptionSets();
      
      // Bug should be red (urgent/error)
      const bugColor = optionSets.task_type.options.find(t => t.value === 'bug')?.color;
      expect(bugColor).toBe('#EF4444');
      
      // Feature should be green (positive/addition)
      const featureColor = optionSets.task_type.options.find(t => t.value === 'feature')?.color;
      expect(featureColor).toBe('#10B981');
      
      // Blocked should be red (problem)
      const blockedColor = optionSets.status.options.find(s => s.value === 'blocked')?.color;
      expect(blockedColor).toBe('#EF4444');
      
      // Completed should be green (success)
      const completedColor = optionSets.status.options.find(s => s.value === 'completed')?.color;
      expect(completedColor).toBe('#10B981');
    });
  });

  describe('Option Set Structure and Consistency', () => {
    it('should have consistent structure across all option sets', () => {
      const projectOptions = ProjectArchetype.getDefaultOptionSets();
      const taskOptions = TaskArchetype.getDefaultOptionSets();
      
      // Test structure consistency
      const allOptionSets = [
        ...Object.values(projectOptions),
        ...Object.values(taskOptions)
      ];
      
      allOptionSets.forEach(optionSet => {
        // Each option set should have a name
        expect(optionSet.name).toBeDefined();
        expect(typeof optionSet.name).toBe('string');
        expect(optionSet.name.length).toBeGreaterThan(0);
        
        // Each option set should have options array
        expect(Array.isArray(optionSet.options)).toBe(true);
        expect(optionSet.options.length).toBeGreaterThan(0);
        
        // Each option should have required fields
        optionSet.options.forEach(option => {
          expect(option.value).toBeDefined();
          expect(option.label).toBeDefined();
          expect(option.color).toBeDefined();
          expect(option.sortOrder).toBeDefined();
          
          expect(typeof option.value).toBe('string');
          expect(typeof option.label).toBe('string');
          expect(typeof option.color).toBe('string');
          expect(typeof option.sortOrder).toBe('number');
        });
      });
    });

    it('should have proper sort ordering in all option sets', () => {
      const projectOptions = ProjectArchetype.getDefaultOptionSets();
      const taskOptions = TaskArchetype.getDefaultOptionSets();
      
      const allOptionSets = [
        ...Object.values(projectOptions),
        ...Object.values(taskOptions)
      ];
      
      allOptionSets.forEach(optionSet => {
        const sortOrders = optionSet.options.map(o => o.sortOrder);
        
        // Sort orders should be unique
        const uniqueSortOrders = [...new Set(sortOrders)];
        expect(uniqueSortOrders.length).toBe(sortOrders.length);
        
        // Sort orders should start from 1 and be consecutive
        const expectedOrders = Array.from({ length: sortOrders.length }, (_, i) => i + 1);
        expect([...sortOrders].sort((a, b) => a - b)).toEqual(expectedOrders);
      });
    });

    it('should have unique values within each option set', () => {
      const projectOptions = ProjectArchetype.getDefaultOptionSets();
      const taskOptions = TaskArchetype.getDefaultOptionSets();
      
      const allOptionSets = [
        ...Object.values(projectOptions),
        ...Object.values(taskOptions)
      ];
      
      allOptionSets.forEach(optionSet => {
        const values = optionSet.options.map(o => o.value);
        const uniqueValues = [...new Set(values)];
        expect(uniqueValues.length).toBe(values.length);
        
        const labels = optionSet.options.map(o => o.label);
        const uniqueLabels = [...new Set(labels)];
        expect(uniqueLabels.length).toBe(labels.length);
      });
    });

    it('should provide meaningful and professional labels', () => {
      const projectOptions = ProjectArchetype.getDefaultOptionSets();
      const taskOptions = TaskArchetype.getDefaultOptionSets();
      
      const allOptionSets = [
        ...Object.values(projectOptions),
        ...Object.values(taskOptions)
      ];
      
      allOptionSets.forEach(optionSet => {
        optionSet.options.forEach(option => {
          // Labels should be properly capitalized
          expect(option.label).toMatch(/^[A-Z]/);
          
          // Labels should be meaningful (allow simple cases like "Low" for "low")
          // But complex labels should be more descriptive than just the value
          if (option.value.includes('_')) {
            // For complex values like "on_hold", label should be different
            expect(option.label.toLowerCase()).not.toBe(option.value.toLowerCase());
          }
          
          // Labels should be descriptive (more than 2 characters)
          expect(option.label.length).toBeGreaterThan(2);
        });
      });
    });
  });

  describe('Field Definition Integration', () => {
    it('should have option sets that match field definitions', () => {
      const projectFields = ProjectArchetype.fields;
      const projectOptions = ProjectArchetype.getDefaultOptionSets();
      
      // Priority field should have matching option set
      expect(projectFields.priority.type).toBe('priority_option');
      expect(projectOptions.priority).toBeDefined();
      
      // Status field should have matching option set
      expect(projectFields.status.type).toBe('status_option');
      expect(projectOptions.status).toBeDefined();
      
      // Project type field should have matching option set
      expect(projectFields.project_type.type).toBe('category_option');
      expect(projectOptions.project_type).toBeDefined();
      
      // Default values should exist in option sets
      const priorityValues = projectOptions.priority.options.map(o => o.value);
      expect(priorityValues).toContain(projectFields.priority.defaultValue);
      
      const statusValues = projectOptions.status.options.map(o => o.value);
      expect(statusValues).toContain(projectFields.status.defaultValue);
      
      const typeValues = projectOptions.project_type.options.map(o => o.value);
      expect(typeValues).toContain(projectFields.project_type.defaultValue);
    });

    it('should have task option sets that match task field definitions', () => {
      const taskFields = TaskArchetype.fields;
      const taskOptions = TaskArchetype.getDefaultOptionSets();
      
      // Priority field should have matching option set
      expect(taskFields.priority.type).toBe('priority_option');
      expect(taskOptions.priority).toBeDefined();
      
      // Status field should have matching option set
      expect(taskFields.status.type).toBe('status_option');
      expect(taskOptions.status).toBeDefined();
      
      // Task type field should have matching option set
      expect(taskFields.task_type.type).toBe('category_option');
      expect(taskOptions.task_type).toBeDefined();
      
      // Default values should exist in option sets
      const priorityValues = taskOptions.priority.options.map(o => o.value);
      expect(priorityValues).toContain(taskFields.priority.defaultValue);
      
      const statusValues = taskOptions.status.options.map(o => o.value);
      expect(statusValues).toContain(taskFields.status.defaultValue);
      
      const typeValues = taskOptions.task_type.options.map(o => o.value);
      expect(typeValues).toContain(taskFields.task_type.defaultValue);
    });
  });

  describe('Business Logic Integration', () => {
    it('should have priority option values that match business logic', () => {
      const projectLogic = ProjectArchetype.getBusinessLogic();
      const taskLogic = TaskArchetype.getBusinessLogic();
      
      const projectPriorities = ProjectArchetype.getDefaultOptionSets().priority.options;
      const taskPriorities = TaskArchetype.getDefaultOptionSets().task_type.options;
      
      // Test priority urgency mapping for projects
      projectPriorities.forEach(priority => {
        const urgency = projectLogic.getPriorityUrgency(priority.value);
        expect(urgency).toBeGreaterThan(0);
        expect(urgency).toBeLessThanOrEqual(4);
      });
      
      // Priority values should be valid in validation rules
      const projectRules = ProjectArchetype.getValidationRules();
      const taskRules = TaskArchetype.getValidationRules();
      
      const projectPriorityValues = projectPriorities.map(p => p.value);
      expect(projectRules.priority.enum).toEqual(projectPriorityValues);
      
      const taskPriorityValues = TaskArchetype.getDefaultOptionSets().priority.options.map(p => p.value);
      expect(taskRules.priority.enum).toEqual(taskPriorityValues);
    });

    it('should have status option values that match workflow transitions', () => {
      const taskStatuses = TaskArchetype.getDefaultOptionSets().status.options;
      const workflowTransitions = TaskArchetype.getWorkflowTransitions();
      
      // All status values should have workflow transitions defined
      taskStatuses.forEach(status => {
        expect(workflowTransitions[status.value as keyof typeof workflowTransitions]).toBeDefined();
      });
      
      // All workflow states should have corresponding option definitions
      Object.keys(workflowTransitions).forEach(statusValue => {
        const hasOption = taskStatuses.some(s => s.value === statusValue);
        expect(hasOption).toBe(true);
      });
    });
  });
});
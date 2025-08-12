#!/usr/bin/env node

/**
 * Test for StatusOptionService business logic validation
 */

import { StatusOptionService } from '../../../../packages/dataforge/src/services/StatusOptionService.js';

async function testStatusOptionService() {
  console.log('🧪 Testing StatusOptionService');

  const service = new StatusOptionService();

  try {
    // Test 1: Validate status transition logic
    console.log('\n🧪 Test 1: Status transition validation');
    
    const projectTransitions = ['active', 'cancelled'];
    const validTransition = service.validateStatusTransition('planning', 'active', projectTransitions);
    const invalidTransition = service.validateStatusTransition('planning', 'completed', projectTransitions);
    
    console.log(`  Planning → Active: ${validTransition ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`  Planning → Completed: ${invalidTransition ? '❌ Should be invalid' : '✅ Correctly invalid'}`);

    if (!validTransition) {
      console.log('❌ Valid transition was rejected');
      process.exit(1);
    }

    if (invalidTransition) {
      console.log('❌ Invalid transition was allowed');
      process.exit(1);
    }

    // Test 2: Validate status option data
    console.log('\n🧪 Test 2: Status option data validation');

    const validStatusData = {
      value: 'active',
      label: 'Active',
      optionType: 'status',
      allowedTransitions: ['completed', 'cancelled'],
      isCompletionState: false
    };

    const invalidStatusData = {
      value: 'terminal',
      label: 'Terminal',
      optionType: 'status',
      isTerminalState: true,
      allowedTransitions: ['should-not-exist'] // Invalid: terminal with transitions
    };

    const validErrors = service.validateStatusOptionData(validStatusData);
    const invalidErrors = service.validateStatusOptionData(invalidStatusData);

    console.log(`  Valid status data errors: ${validErrors.length === 0 ? '✅ None' : '❌ ' + validErrors.join(', ')}`);
    console.log(`  Invalid status data errors: ${invalidErrors.length > 0 ? '✅ Found errors' : '❌ Should have errors'}`);
    console.log(`    Errors: ${invalidErrors.join(', ')}`);

    if (validErrors.length > 0) {
      console.log('❌ Valid status data was rejected');
      process.exit(1);
    }

    if (invalidErrors.length === 0) {
      console.log('❌ Invalid status data was accepted');
      process.exit(1);
    }

    // Test 3: Get default status options for different archetypes
    console.log('\n🧪 Test 3: Default status options for archetypes');

    const projectStatuses = service.getDefaultStatusOptions('project');
    const taskStatuses = service.getDefaultStatusOptions('task');
    const recordStatuses = service.getDefaultStatusOptions('record');

    console.log(`  Project statuses: ${projectStatuses.length} options`);
    console.log(`    ${projectStatuses.map(s => s.value).join(' → ')}`);
    
    console.log(`  Task statuses: ${taskStatuses.length} options`);
    console.log(`    ${taskStatuses.map(s => s.value).join(' → ')}`);
    
    console.log(`  Record statuses: ${recordStatuses.length} options`);
    console.log(`    ${recordStatuses.map(s => s.value).join(' → ')}`);

    // Validate that each archetype has proper status flows
    const hasCompletionStates = {
      project: projectStatuses.some(s => s.isCompletionState),
      task: taskStatuses.some(s => s.isCompletionState),
      record: recordStatuses.some(s => s.isCompletionState)
    };

    console.log(`  Project has completion states: ${hasCompletionStates.project ? '✅ Yes' : '❌ No'}`);
    console.log(`  Task has completion states: ${hasCompletionStates.task ? '✅ Yes' : '❌ No'}`);
    console.log(`  Record has completion states: ${hasCompletionStates.record ? '✅ Yes' : '❌ No'}`);

    // Test 4: Validate transition flows
    console.log('\n🧪 Test 4: Validate status workflow integrity');

    function validateWorkflow(statuses, workflowName) {
      const statusMap = new Map(statuses.map(s => [s.value, s]));
      let errors = [];

      for (const status of statuses) {
        if (status.allowedTransitions) {
          for (const transition of status.allowedTransitions) {
            if (!statusMap.has(transition)) {
              errors.push(`${workflowName}: ${status.value} → ${transition} (target not found)`);
            }
          }
        }
      }

      return errors;
    }

    const projectWorkflowErrors = validateWorkflow(projectStatuses, 'Project');
    const taskWorkflowErrors = validateWorkflow(taskStatuses, 'Task');
    
    console.log(`  Project workflow errors: ${projectWorkflowErrors.length === 0 ? '✅ None' : '❌ ' + projectWorkflowErrors.length}`);
    console.log(`  Task workflow errors: ${taskWorkflowErrors.length === 0 ? '✅ None' : '❌ ' + taskWorkflowErrors.length}`);

    if (projectWorkflowErrors.length > 0) {
      console.log('    Project errors:', projectWorkflowErrors);
      process.exit(1);
    }

    if (taskWorkflowErrors.length > 0) {
      console.log('    Task errors:', taskWorkflowErrors);
      process.exit(1);
    }

    console.log('\n🎉 All StatusOptionService tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testStatusOptionService();
#!/usr/bin/env tsx

/**
 * Seed Demo Processes for Process Studio
 * Creates comprehensive business process examples with all BPMN node types
 */

import { withKysely } from '../lib/database-manager';
import { processManager } from '../services/ProcessManager';

const ORG_ID = '01920000-1000-7000-8000-000000000001'; // Wide Corp

async function seedDemoProcesses() {
  await withKysely(async (kysely) => {

    // ==================== Process 1: Customer Onboarding ====================

    console.log('Creating Customer Onboarding process...');

    const onboarding = await processManager.createProcess(kysely, ORG_ID, {
      name: 'Customer Onboarding',
      description: 'End-to-end client onboarding with contract value routing',
      category: 'operational'
    });

    // Nodes
    const start1 = await processManager.createNode(kysely, ORG_ID, onboarding.id, {
      node_key: 'start_inquiry',
      node_type: 'start_event',
      label: 'New Client Inquiry',
      position_x: 100,
      position_y: 200
    });

    const createClient = await processManager.createNode(kysely, ORG_ID, onboarding.id, {
      node_key: 'create_client',
      node_type: 'user_task',
      label: 'Create Client Record',
      description: 'Sales rep enters client info',
      position_x: 250,
      position_y: 200,
      linked_entity_type: 'Client'
    });

    const assignManager = await processManager.createNode(kysely, ORG_ID, onboarding.id, {
      node_key: 'assign_manager',
      node_type: 'user_task',
      label: 'Assign Account Manager',
      position_x: 450,
      position_y: 200,
      linked_entity_type: 'User'
    });

    const checkValue = await processManager.createNode(kysely, ORG_ID, onboarding.id, {
      node_key: 'check_contract',
      node_type: 'exclusive_gateway',
      label: 'Contract > $100k?',
      position_x: 650,
      position_y: 200
    });

    const scheduleKickoff = await processManager.createNode(kysely, ORG_ID, onboarding.id, {
      node_key: 'schedule_kickoff',
      node_type: 'user_task',
      label: 'Schedule Kickoff',
      description: 'For high-value clients',
      position_x: 800,
      position_y: 100,
      linked_entity_type: 'ClientMeeting'
    });

    const createProject = await processManager.createNode(kysely, ORG_ID, onboarding.id, {
      node_key: 'create_project',
      node_type: 'service_task',
      label: 'Create Project',
      position_x: 950,
      position_y: 100,
      linked_entity_type: 'ProjectPortfolio'
    });

    const sendWelcome = await processManager.createNode(kysely, ORG_ID, onboarding.id, {
      node_key: 'send_welcome',
      node_type: 'send_task',
      label: 'Send Welcome Email',
      position_x: 800,
      position_y: 300
    });

    const endHigh = await processManager.createNode(kysely, ORG_ID, onboarding.id, {
      node_key: 'end_high',
      node_type: 'end_event',
      label: 'VIP Onboarding Complete',
      position_x: 1100,
      position_y: 100
    });

    const endStandard = await processManager.createNode(kysely, ORG_ID, onboarding.id, {
      node_key: 'end_standard',
      node_type: 'end_event',
      label: 'Standard Onboarding Complete',
      position_x: 950,
      position_y: 300
    });

    // Connections
    await processManager.createConnection(kysely, ORG_ID, onboarding.id, {
      connection_key: 'flow_1',
      source_node_id: start1.id,
      target_node_id: createClient.id
    });

    await processManager.createConnection(kysely, ORG_ID, onboarding.id, {
      connection_key: 'flow_2',
      source_node_id: createClient.id,
      target_node_id: assignManager.id
    });

    await processManager.createConnection(kysely, ORG_ID, onboarding.id, {
      connection_key: 'flow_3',
      source_node_id: assignManager.id,
      target_node_id: checkValue.id
    });

    await processManager.createConnection(kysely, ORG_ID, onboarding.id, {
      connection_key: 'flow_high',
      source_node_id: checkValue.id,
      target_node_id: scheduleKickoff.id,
      label: 'Yes',
      condition_expression: 'contract_value > 100000'
    });

    await processManager.createConnection(kysely, ORG_ID, onboarding.id, {
      connection_key: 'flow_standard',
      source_node_id: checkValue.id,
      target_node_id: sendWelcome.id,
      label: 'No',
      is_default: true
    });

    await processManager.createConnection(kysely, ORG_ID, onboarding.id, {
      connection_key: 'flow_4',
      source_node_id: scheduleKickoff.id,
      target_node_id: createProject.id
    });

    await processManager.createConnection(kysely, ORG_ID, onboarding.id, {
      connection_key: 'flow_5',
      source_node_id: createProject.id,
      target_node_id: endHigh.id
    });

    await processManager.createConnection(kysely, ORG_ID, onboarding.id, {
      connection_key: 'flow_6',
      source_node_id: sendWelcome.id,
      target_node_id: endStandard.id
    });

    console.log('✅ Customer Onboarding process created with 9 nodes and 8 connections');

    // ==================== Process 2: Invoice Processing ====================

    console.log('Creating Invoice Processing workflow...');

    const invoice = await processManager.createProcess(kysely, ORG_ID, {
      name: 'Invoice Processing',
      description: 'Automated invoice validation and approval workflow',
      category: 'operational'
    });

    const startInv = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'start_invoice',
      node_type: 'start_event',
      label: 'Invoice Received',
      position_x: 100,
      position_y: 200
    });

    const validateInv = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'validate',
      node_type: 'user_task',
      label: 'Validate Invoice',
      position_x: 250,
      position_y: 200,
      linked_entity_type: 'Invoice'
    });

    const isValid = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'check_valid',
      node_type: 'exclusive_gateway',
      label: 'Valid?',
      position_x: 400,
      position_y: 200
    });

    const extractData = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'extract',
      node_type: 'service_task',
      label: 'Extract Invoice Data',
      position_x: 550,
      position_y: 150
    });

    const checkAmount = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'check_amount',
      node_type: 'exclusive_gateway',
      label: 'Amount > $10k?',
      position_x: 700,
      position_y: 150
    });

    const parallelApproval = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'parallel_split',
      node_type: 'parallel_gateway',
      label: 'Dual Approval',
      position_x: 850,
      position_y: 100
    });

    const managerApproval = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'manager_approve',
      node_type: 'user_task',
      label: 'Manager Approval',
      position_x: 1000,
      position_y: 50
    });

    const financeReview = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'finance_review',
      node_type: 'user_task',
      label: 'Finance Review',
      position_x: 1000,
      position_y: 150
    });

    const parallelJoin = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'parallel_join',
      node_type: 'parallel_gateway',
      label: 'Approvals Complete',
      position_x: 1150,
      position_y: 100
    });

    const processPayment = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'process_payment',
      node_type: 'service_task',
      label: 'Process Payment',
      position_x: 1300,
      position_y: 150,
      linked_entity_type: 'Invoice'
    });

    const returnVendor = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'return_vendor',
      node_type: 'send_task',
      label: 'Return to Vendor',
      position_x: 550,
      position_y: 300
    });

    const endProcessed = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'end_processed',
      node_type: 'end_event',
      label: 'Invoice Processed',
      position_x: 1450,
      position_y: 150
    });

    const endReturned = await processManager.createNode(kysely, ORG_ID, invoice.id, {
      node_key: 'end_returned',
      node_type: 'end_event',
      label: 'Invoice Returned',
      position_x: 700,
      position_y: 300
    });

    // Connections
    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_1',
      source_node_id: startInv.id,
      target_node_id: validateInv.id
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_2',
      source_node_id: validateInv.id,
      target_node_id: isValid.id
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_valid',
      source_node_id: isValid.id,
      target_node_id: extractData.id,
      label: 'Valid'
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_invalid',
      source_node_id: isValid.id,
      target_node_id: returnVendor.id,
      label: 'Invalid'
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_3',
      source_node_id: extractData.id,
      target_node_id: checkAmount.id
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_high',
      source_node_id: checkAmount.id,
      target_node_id: parallelApproval.id,
      label: 'High Value'
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_low',
      source_node_id: checkAmount.id,
      target_node_id: processPayment.id,
      label: 'Auto-approve',
      is_default: true
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_4',
      source_node_id: parallelApproval.id,
      target_node_id: managerApproval.id
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_5',
      source_node_id: parallelApproval.id,
      target_node_id: financeReview.id
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_6',
      source_node_id: managerApproval.id,
      target_node_id: parallelJoin.id
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_7',
      source_node_id: financeReview.id,
      target_node_id: parallelJoin.id
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_8',
      source_node_id: parallelJoin.id,
      target_node_id: processPayment.id
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_9',
      source_node_id: processPayment.id,
      target_node_id: endProcessed.id
    });

    await processManager.createConnection(kysely, ORG_ID, invoice.id, {
      connection_key: 'inv_10',
      source_node_id: returnVendor.id,
      target_node_id: endReturned.id
    });

    console.log('✅ Invoice Processing workflow created with 13 nodes and 10 connections');

    // ==================== Process 3: Milestone Delivery ====================

    console.log('Creating Milestone Delivery process...');

    const milestone = await processManager.createProcess(kysely, ORG_ID, {
      name: 'Milestone Delivery & Approval',
      description: 'Client milestone review and acceptance workflow',
      category: 'management'
    });

    const startMilestone = await processManager.createNode(kysely, ORG_ID, milestone.id, {
      node_key: 'start_due',
      node_type: 'start_event',
      label: 'Milestone Due',
      position_x: 100,
      position_y: 200
    });

    const reviewDel = await processManager.createNode(kysely, ORG_ID, milestone.id, {
      node_key: 'review_del',
      node_type: 'user_task',
      label: 'Review Deliverables',
      position_x: 250,
      position_y: 200,
      linked_entity_type: 'ProjectMilestone'
    });

    const createDel = await processManager.createNode(kysely, ORG_ID, milestone.id, {
      node_key: 'create_del',
      node_type: 'user_task',
      label: 'Create Deliverable Records',
      position_x: 450,
      position_y: 200,
      linked_entity_type: 'Deliverable'
    });

    const clientReview = await processManager.createNode(kysely, ORG_ID, milestone.id, {
      node_key: 'client_review',
      node_type: 'user_task',
      label: 'Client Review Meeting',
      position_x: 650,
      position_y: 200,
      linked_entity_type: 'ClientMeeting'
    });

    const checkApproval = await processManager.createNode(kysely, ORG_ID, milestone.id, {
      node_key: 'check_approval',
      node_type: 'exclusive_gateway',
      label: 'Approved?',
      position_x: 850,
      position_y: 200
    });

    const markComplete = await processManager.createNode(kysely, ORG_ID, milestone.id, {
      node_key: 'mark_complete',
      node_type: 'user_task',
      label: 'Mark Milestone Complete',
      position_x: 1000,
      position_y: 150,
      linked_entity_type: 'ProjectMilestone'
    });

    const updateTasks = await processManager.createNode(kysely, ORG_ID, milestone.id, {
      node_key: 'update_tasks',
      node_type: 'user_task',
      label: 'Update Task Assignments',
      position_x: 1000,
      position_y: 300,
      linked_entity_type: 'WorkTask'
    });

    const notifyTeam = await processManager.createNode(kysely, ORG_ID, milestone.id, {
      node_key: 'notify',
      node_type: 'send_task',
      label: 'Notify Team',
      position_x: 1150,
      position_y: 300
    });

    const endMilestone = await processManager.createNode(kysely, ORG_ID, milestone.id, {
      node_key: 'end_complete',
      node_type: 'end_event',
      label: 'Milestone Closed',
      position_x: 1300,
      position_y: 200
    });

    // Connections
    await processManager.createConnection(kysely, ORG_ID, milestone.id, {
      connection_key: 'mil_1',
      source_node_id: startMilestone.id,
      target_node_id: reviewDel.id
    });

    await processManager.createConnection(kysely, ORG_ID, milestone.id, {
      connection_key: 'mil_2',
      source_node_id: reviewDel.id,
      target_node_id: createDel.id
    });

    await processManager.createConnection(kysely, ORG_ID, milestone.id, {
      connection_key: 'mil_3',
      source_node_id: createDel.id,
      target_node_id: clientReview.id
    });

    await processManager.createConnection(kysely, ORG_ID, milestone.id, {
      connection_key: 'mil_4',
      source_node_id: clientReview.id,
      target_node_id: checkApproval.id
    });

    await processManager.createConnection(kysely, ORG_ID, milestone.id, {
      connection_key: 'mil_approved',
      source_node_id: checkApproval.id,
      target_node_id: markComplete.id,
      label: 'Approved'
    });

    await processManager.createConnection(kysely, ORG_ID, milestone.id, {
      connection_key: 'mil_changes',
      source_node_id: checkApproval.id,
      target_node_id: updateTasks.id,
      label: 'Changes Requested'
    });

    await processManager.createConnection(kysely, ORG_ID, milestone.id, {
      connection_key: 'mil_5',
      source_node_id: markComplete.id,
      target_node_id: endMilestone.id
    });

    await processManager.createConnection(kysely, ORG_ID, milestone.id, {
      connection_key: 'mil_6',
      source_node_id: updateTasks.id,
      target_node_id: notifyTeam.id
    });

    await processManager.createConnection(kysely, ORG_ID, milestone.id, {
      connection_key: 'mil_7',
      source_node_id: notifyTeam.id,
      target_node_id: endMilestone.id
    });

    console.log('✅ Milestone Delivery process created with 9 nodes and 9 connections');

    console.log('\n🎉 All demo processes created successfully!');
    console.log('Navigate to Process Studio to view them:');
    console.log('http://localhost:4000/org/01920000-1000-7000-8000-000000000001/process-studio');
  });
}

// Execute
seedDemoProcesses()
  .then(() => {
    console.log('✅ Seeding complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error seeding processes:', error);
    process.exit(1);
  });

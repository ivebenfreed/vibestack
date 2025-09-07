#!/usr/bin/env tsx
/**
 * Clean up organization entities and seed with realistic data
 * This script will:
 * 1. Remove test/unnecessary entities
 * 2. Keep meaningful business entities
 * 3. Convert all to v2.0 format
 * 4. Seed with realistic data including relationships
 */

import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { DataForgeEntityManager } from '../apps/worker/src/server/dataforge/entity-operations/EntityManager';
import { JsonRulesEngine } from '../apps/worker/src/server/dataforge/json-rules-engine';
import { sql } from 'kysely';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .dev.vars file
const devVarsPath = path.resolve(__dirname, '../apps/worker/.dev.vars');
const devVars = fs.readFileSync(devVarsPath, 'utf-8');
devVars.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key] = value;
  }
});

const ORG_ID = '01920000-1000-7000-8000-000000000001';

// Entities to keep (meaningful business entities)
const ENTITIES_TO_KEEP = [
  'Client',       // Customer/client management
  'Project',      // Project management
  'Task',         // Task management  
  'Invoice',      // Billing and invoicing
  'Expense',      // Expense tracking
  'Meeting',      // Meeting/activity tracking
  'Contract',     // Contract management
  'Discussion',   // Team discussions/communications
];

// Entities to remove (test entities and meaningless ones)
const ENTITIES_TO_REMOVE = [
  'CapitolBuilding',
  'EmergencyContact', 
  'TimeSheet',
  'Replicatestentity1757175687',
  'SecurityBadge',
  'TeamTask',
  'Reptest76123',
  'AccessControlList',
  'File',
  'TestProduct',
  'UserPermissionGroup',
  'DataAnalyticsReport',
  'InventoryItem'
];

async function cleanupAndSeedOrg() {
  console.log('🧹 Starting organization cleanup and seeding...\n');
  
  // Create Kysely instance directly with correct connection string
  const connectionString = 'postgresql://postgres:postgres@localhost:5432/vibestack_dev';
  console.log('🔗 Connecting to database...');
  
  const kysely = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
        max: 10
      })
    })
  });
  
  const rulesEngine = new JsonRulesEngine();
  const entityManager = new DataForgeEntityManager({ 
    kysely, 
    rulesEngine, 
    env: {} as any 
  });

  try {
    // Step 1: Get current entities
    console.log('📋 Current entities in organization:');
    const schemaResult = await entityManager.getSchema(ORG_ID);
    if (!schemaResult.success) {
      throw new Error('Failed to get schema');
    }

    const currentEntities = schemaResult.data.map((e: any) => e.entityName);
    console.log(`Found ${currentEntities.length} entities:`, currentEntities.join(', '));

    // Step 2: Remove unnecessary entities
    console.log('\n🗑️ Removing test/unnecessary entities...');
    for (const entityName of ENTITIES_TO_REMOVE) {
      if (currentEntities.includes(entityName)) {
        console.log(`  Removing ${entityName}...`);
        const result = await entityManager.deleteEntity(ORG_ID, entityName);
        if (!result.success) {
          console.warn(`  ⚠️ Failed to delete ${entityName}: ${result.error}`);
        } else {
          console.log(`  ✅ Removed ${entityName}`);
        }
      }
    }

    // Step 3: Get users for relationship references
    console.log('\n👥 Getting users for relationships...');
    const users = await kysely
      .selectFrom('user')
      .select(['id', 'email', 'name'])
      .where('email', 'in', [
        'ceo@widecorp.com',
        'cto@widecorp.com', 
        'pm1@widecorp.com',
        'dev1@widecorp.com'
      ])
      .execute();

    const userMap = Object.fromEntries(users.map(u => [u.email, u.id]));
    console.log(`Found ${users.length} users`);

    // Step 4: Update entities to v2.0 format with enhanced fields
    console.log('\n🔄 Updating entities to v2.0 format...');
    
    // Define enhanced field configurations for each entity
    const entityEnhancements = {
      Client: {
        customFields: [
          { name: 'company_size', type: 'select', enum: ['1-10', '11-50', '51-200', '201-500', '500+'], defaultValue: '11-50' },
          { name: 'annual_revenue', type: 'decimal' },
          { name: 'account_manager_id', type: 'user_reference' },
          { name: 'last_contact_date', type: 'date' },
          { name: 'satisfaction_score', type: 'integer', defaultValue: 0 }
        ]
      },
      Project: {
        customFields: [
          { name: 'client_id', type: 'entity_reference', targetEntity: 'Client' },
          { name: 'project_manager_id', type: 'user_reference' },
          { name: 'estimated_hours', type: 'decimal' },
          { name: 'actual_hours', type: 'decimal', defaultValue: 0 },
          { name: 'completion_percentage', type: 'integer', defaultValue: 0 }
        ]
      },
      Task: {
        customFields: [
          { name: 'story_points', type: 'integer', defaultValue: 1 },
          { name: 'blocked', type: 'boolean', defaultValue: false },
          { name: 'blocked_reason', type: 'text' },
          { name: 'reviewer_id', type: 'user_reference' },
          { name: 'labels', type: 'json', defaultValue: [] }
        ]
      },
      Invoice: {
        customFields: [
          { name: 'invoice_number', type: 'text', required: true },
          { name: 'client_id', type: 'entity_reference', targetEntity: 'Client' },
          { name: 'project_id', type: 'entity_reference', targetEntity: 'Project' },
          { name: 'amount', type: 'decimal', required: true },
          { name: 'tax_rate', type: 'decimal', defaultValue: 0.1 },
          { name: 'due_date', type: 'date', required: true },
          { name: 'paid_date', type: 'date' },
          { name: 'payment_status', type: 'select', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'], defaultValue: 'draft' }
        ]
      },
      Expense: {
        customFields: [
          { name: 'expense_category', type: 'select', enum: ['travel', 'meals', 'supplies', 'equipment', 'software', 'other'], defaultValue: 'other' },
          { name: 'project_id', type: 'entity_reference', targetEntity: 'Project' },
          { name: 'approved_by_id', type: 'user_reference' },
          { name: 'approval_date', type: 'date' },
          { name: 'receipt_uploaded', type: 'boolean', defaultValue: false }
        ]
      },
      Meeting: {
        customFields: [
          { name: 'client_id', type: 'entity_reference', targetEntity: 'Client' },
          { name: 'project_id', type: 'entity_reference', targetEntity: 'Project' },
          { name: 'organizer_id', type: 'user_reference' },
          { name: 'meeting_link', type: 'url' },
          { name: 'recording_url', type: 'url' },
          { name: 'agenda', type: 'text' },
          { name: 'minutes', type: 'text' }
        ]
      },
      Contract: {
        customFields: [
          { name: 'contract_number', type: 'text', required: true },
          { name: 'client_id', type: 'entity_reference', targetEntity: 'Client', required: true },
          { name: 'contract_value', type: 'decimal', required: true },
          { name: 'payment_terms', type: 'select', enum: ['net15', 'net30', 'net45', 'net60', 'immediate'], defaultValue: 'net30' },
          { name: 'auto_renew', type: 'boolean', defaultValue: false },
          { name: 'signed_date', type: 'date' },
          { name: 'renewal_date', type: 'date' }
        ]
      },
      Discussion: {
        customFields: [
          { name: 'project_id', type: 'entity_reference', targetEntity: 'Project' },
          { name: 'participants', type: 'json', defaultValue: [] },
          { name: 'is_pinned', type: 'boolean', defaultValue: false },
          { name: 'tags', type: 'json', defaultValue: [] },
          { name: 'resolved', type: 'boolean', defaultValue: false },
          { name: 'resolved_by_id', type: 'user_reference' }
        ]
      }
    };

    // Add custom fields to each entity
    for (const [entityName, config] of Object.entries(entityEnhancements)) {
      if (ENTITIES_TO_KEEP.includes(entityName)) {
        console.log(`\n  Enhancing ${entityName}...`);
        const result = await entityManager.addFields(ORG_ID, entityName, config.customFields);
        if (result.success) {
          console.log(`  ✅ Enhanced ${entityName} with ${config.customFields.length} custom fields`);
        } else {
          console.warn(`  ⚠️ Failed to enhance ${entityName}: ${result.error}`);
        }
      }
    }

    console.log('\n✨ Organization cleanup and enhancement complete!');
    console.log(`  - Removed ${ENTITIES_TO_REMOVE.length} test entities`);
    console.log(`  - Enhanced ${ENTITIES_TO_KEEP.length} business entities`);
    console.log('\n📊 Next step: Run seed data script to populate with realistic data');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await kysely.destroy();
  }
}

// Run the cleanup
cleanupAndSeedOrg();
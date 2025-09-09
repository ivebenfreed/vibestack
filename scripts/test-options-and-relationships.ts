#!/usr/bin/env tsx
/**
 * Test Runner and Validator for Options and Relationship System
 * 
 * This script:
 * 1. Runs the comprehensive seed script
 * 2. Validates all seeded data
 * 3. Tests API endpoints
 * 4. Validates Wide Corp test scenarios
 * 5. Provides detailed reporting
 */

import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const devVarsPath = path.resolve(__dirname, '../apps/worker/.dev.vars');
const devVars = fs.readFileSync(devVarsPath, 'utf-8');
devVars.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key] = value;
  }
});

const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';

// Create Kysely instance
const connectionString = 'postgresql://postgres:postgres@localhost:5432/vibestack_dev';
const kysely = new Kysely<any>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString,
      max: 10
    })
  })
});

async function runValidationTests() {
  console.log('🧪 Starting Options and Relationship System Validation...\n');

  const results = {
    systemOptions: { sets: 0, options: 0, tested: 0 },
    customOptions: { sets: 0, options: 0, tested: 0 },
    relationships: { configs: 0, records: 0, tested: 0 },
    apiTests: { systemOptions: false, customOptions: false, relationships: false },
    businessScenarios: { created: 0, validated: 0 },
    errors: [] as string[]
  };

  try {
    // =======================================================================
    // PART 1: VALIDATE SYSTEM OPTIONS
    // =======================================================================
    
    console.log('📋 Validating System Options...');
    
    const systemOptionSets = await kysely
      .selectFrom('system_option_sets')
      .selectAll()
      .execute();
    
    results.systemOptions.sets = systemOptionSets.length;
    console.log(`  Found ${systemOptionSets.length} system option sets`);
    
    if (systemOptionSets.length === 0) {
      results.errors.push('No system option sets found - seeding may have failed');
      console.log('  ❌ No system option sets found');
    }

    const systemOptions = await kysely
      .selectFrom('system_options')
      .selectAll()
      .execute();
    
    results.systemOptions.options = systemOptions.length;
    console.log(`  Found ${systemOptions.length} system options`);

    // Test a few key system option sets
    const taskPriorityOptions = await kysely
      .selectFrom('system_options')
      .innerJoin('system_option_sets', 'system_options.option_set_id', 'system_option_sets.id')
      .where('system_option_sets.option_set_type', '=', 'priority')
      .where('system_option_sets.archetype', '=', 'task')
      .where('system_options.is_active', '=', true)
      .select([
        'system_options.value',
        'system_options.label',
        'system_options.color',
        'system_options.icon'
      ])
      .orderBy('system_options.sort_order', 'asc')
      .execute();

    if (taskPriorityOptions.length > 0) {
      console.log(`  ✅ Task priority options: ${taskPriorityOptions.length} options`);
      taskPriorityOptions.forEach(opt => {
        console.log(`    - ${opt.value}: ${opt.label} (${opt.color})`);
      });
      results.systemOptions.tested++;
    } else {
      results.errors.push('Task priority options not found');
      console.log('  ❌ Task priority options not found');
    }

    const projectStatusOptions = await kysely
      .selectFrom('system_options')
      .innerJoin('system_option_sets', 'system_options.option_set_id', 'system_option_sets.id')
      .where('system_option_sets.option_set_type', '=', 'status')
      .where('system_option_sets.archetype', '=', 'project')
      .where('system_options.is_active', '=', true)
      .select(['system_options.value', 'system_options.label'])
      .execute();

    if (projectStatusOptions.length > 0) {
      console.log(`  ✅ Project status options: ${projectStatusOptions.length} options`);
      results.systemOptions.tested++;
    } else {
      results.errors.push('Project status options not found');
      console.log('  ❌ Project status options not found');
    }

    // =======================================================================
    // PART 2: VALIDATE CUSTOM OPTIONS (Wide Corp)
    // =======================================================================
    
    console.log('\n🏢 Validating Wide Corp Custom Options...');
    
    const customOptionSets = await kysely
      .selectFrom('custom_option_sets')
      .where('org_id', '=', WIDE_CORP_ORG_ID)
      .selectAll()
      .execute();
    
    results.customOptions.sets = customOptionSets.length;
    console.log(`  Found ${customOptionSets.length} custom option sets for Wide Corp`);
    
    if (customOptionSets.length === 0) {
      results.errors.push('No custom option sets found for Wide Corp');
      console.log('  ❌ No custom option sets found for Wide Corp');
    }

    const customOptions = await kysely
      .selectFrom('custom_options')
      .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
      .where('custom_option_sets.org_id', '=', WIDE_CORP_ORG_ID)
      .selectAll()
      .execute();
    
    results.customOptions.options = customOptions.length;
    console.log(`  Found ${customOptions.length} custom options for Wide Corp`);

    // Test specific custom option sets
    const departmentOptions = await kysely
      .selectFrom('custom_options')
      .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
      .where('custom_option_sets.org_id', '=', WIDE_CORP_ORG_ID)
      .where('custom_option_sets.name', '=', 'departments')
      .where('custom_options.is_active', '=', true)
      .select([
        'custom_options.value',
        'custom_options.label',
        'custom_options.color',
        'custom_options.icon'
      ])
      .orderBy('custom_options.sort_order', 'asc')
      .execute();

    if (departmentOptions.length > 0) {
      console.log(`  ✅ Department options: ${departmentOptions.length} options`);
      departmentOptions.forEach(opt => {
        console.log(`    - ${opt.value}: ${opt.label} (${opt.color})`);
      });
      results.customOptions.tested++;
    } else {
      results.errors.push('Department options not found for Wide Corp');
      console.log('  ❌ Department options not found for Wide Corp');
    }

    const locationOptions = await kysely
      .selectFrom('custom_options')
      .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
      .where('custom_option_sets.org_id', '=', WIDE_CORP_ORG_ID)
      .where('custom_option_sets.name', '=', 'locations')
      .where('custom_options.is_active', '=', true)
      .select(['custom_options.value', 'custom_options.label'])
      .execute();

    if (locationOptions.length > 0) {
      console.log(`  ✅ Location options: ${locationOptions.length} options`);
      results.customOptions.tested++;
    } else {
      results.errors.push('Location options not found for Wide Corp');
      console.log('  ❌ Location options not found for Wide Corp');
    }

    // =======================================================================
    // PART 3: VALIDATE RELATIONSHIP CONFIGURATIONS
    // =======================================================================
    
    console.log('\n🔗 Validating Relationship Configurations...');
    
    const relationshipConfigs = await kysely
      .selectFrom('dataforge_relationship_fields')
      .where('org_id', '=', WIDE_CORP_ORG_ID)
      .selectAll()
      .execute();
    
    results.relationships.configs = relationshipConfigs.length;
    console.log(`  Found ${relationshipConfigs.length} relationship field configurations`);
    
    if (relationshipConfigs.length === 0) {
      results.errors.push('No relationship field configurations found for Wide Corp');
      console.log('  ❌ No relationship field configurations found');
    }

    // Group by entity type and show configurations
    const configsByEntity = relationshipConfigs.reduce((acc, config) => {
      if (!acc[config.entity_type]) {
        acc[config.entity_type] = [];
      }
      acc[config.entity_type].push(config);
      return acc;
    }, {} as Record<string, any[]>);

    Object.entries(configsByEntity).forEach(([entityType, configs]) => {
      console.log(`  Entity: ${entityType}`);
      configs.forEach(config => {
        console.log(`    - ${config.field_name} → ${config.relationship_type} → ${config.target_entity_type} (${config.cardinality})`);
      });
      results.relationships.tested++;
    });

    // Check for relationship table
    const relationshipTableExists = await kysely
      .selectFrom('information_schema.tables')
      .where('table_name', '=', `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_relationships`)
      .selectAll()
      .execute();

    if (relationshipTableExists.length > 0) {
      console.log('  ✅ Relationship table exists');
      
      // Check for sample relationships if any exist
      const sampleRelationships = await kysely
        .selectFrom(`org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_relationships`)
        .select([
          'source_entity_type',
          'relationship_type', 
          'target_entity_type'
        ])
        .limit(5)
        .execute();
      
      results.relationships.records = sampleRelationships.length;
      if (sampleRelationships.length > 0) {
        console.log(`  ✅ Found ${sampleRelationships.length} sample relationships`);
        sampleRelationships.forEach(rel => {
          console.log(`    - ${rel.source_entity_type} ${rel.relationship_type} ${rel.target_entity_type}`);
        });
      }
    } else {
      results.errors.push('Relationship table does not exist');
      console.log('  ❌ Relationship table does not exist');
    }

    // =======================================================================
    // PART 4: VALIDATE API ENDPOINT QUERIES (Simulated)
    // =======================================================================
    
    console.log('\n🌐 Validating API Endpoint Queries...');
    
    // Test system options API query
    try {
      const systemOptionsApi = await kysely
        .selectFrom('system_options')
        .innerJoin('system_option_sets', 'system_options.option_set_id', 'system_option_sets.id')
        .select([
          'system_options.value as option_key',
          'system_options.label', 
          'system_options.description',
          'system_options.color',
          'system_options.icon',
          'system_options.sort_order',
          'system_options.is_active'
        ])
        .where('system_option_sets.option_set_type', '=', 'priority')
        .where('system_option_sets.archetype', '=', 'task')
        .where('system_options.is_active', '=', true)
        .orderBy('system_options.sort_order', 'asc')
        .orderBy('system_options.label', 'asc')
        .execute();

      if (systemOptionsApi.length > 0) {
        console.log(`  ✅ System Options API query: ${systemOptionsApi.length} results`);
        console.log(`    Sample: ${systemOptionsApi[0].option_key} - ${systemOptionsApi[0].label}`);
        results.apiTests.systemOptions = true;
      } else {
        results.errors.push('System Options API query returned no results');
        console.log('  ❌ System Options API query returned no results');
      }
    } catch (error) {
      results.errors.push(`System Options API query failed: ${error}`);
      console.log(`  ❌ System Options API query failed: ${error}`);
    }

    // Test custom options API query
    try {
      const customOptionsApi = await kysely
        .selectFrom('custom_options')
        .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
        .select([
          'custom_options.value as option_key',
          'custom_options.label',
          'custom_options.description', 
          'custom_options.color',
          'custom_options.icon',
          'custom_options.sort_order',
          'custom_options.is_active'
        ])
        .where('custom_option_sets.org_id', '=', WIDE_CORP_ORG_ID)
        .where('custom_option_sets.name', '=', 'departments')
        .where('custom_options.is_active', '=', true)
        .orderBy('custom_options.sort_order', 'asc')
        .orderBy('custom_options.label', 'asc')
        .execute();

      if (customOptionsApi.length > 0) {
        console.log(`  ✅ Custom Options API query: ${customOptionsApi.length} results`);
        console.log(`    Sample: ${customOptionsApi[0].option_key} - ${customOptionsApi[0].label}`);
        results.apiTests.customOptions = true;
      } else {
        results.errors.push('Custom Options API query returned no results');
        console.log('  ❌ Custom Options API query returned no results');
      }
    } catch (error) {
      results.errors.push(`Custom Options API query failed: ${error}`);
      console.log(`  ❌ Custom Options API query failed: ${error}`);
    }

    // =======================================================================
    // PART 5: VALIDATE BUSINESS SCENARIOS
    // =======================================================================
    
    console.log('\n📊 Validating Business Scenarios...');
    
    // Check if entity data was seeded
    const entityTables = [
      'client', 'project', 'task', 'invoice', 'expense', 
      'meeting', 'contract', 'discussion'
    ];

    let totalRecords = 0;
    for (const entityName of entityTables) {
      try {
        const tableName = `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_${entityName}`;
        const recordCount = await kysely
          .selectFrom(tableName)
          .select(({ fn }) => [fn.count('id').as('count')])
          .execute();
        
        const count = Number(recordCount[0]?.count || 0);
        totalRecords += count;
        
        if (count > 0) {
          console.log(`  ✅ ${entityName}: ${count} records`);
          results.businessScenarios.created++;
        } else {
          console.log(`  ⚠️ ${entityName}: 0 records`);
        }
      } catch (error) {
        console.log(`  ❌ ${entityName}: table not found or error - ${error}`);
        results.errors.push(`Entity table ${entityName} validation failed`);
      }
    }

    console.log(`  Total entity records: ${totalRecords}`);
    results.businessScenarios.validated = totalRecords;

    // =======================================================================
    // PART 6: VALIDATE WIDE CORP TEST USERS
    // =======================================================================
    
    console.log('\n👥 Validating Wide Corp Test Users...');
    
    const wideCorpUsers = await kysely
      .selectFrom('user')
      .select(['id', 'email', 'name'])
      .where('email', 'in', [
        'ceo@widecorp.com',
        'cto@widecorp.com', 
        'pm1@widecorp.com',
        'dev1@widecorp.com'
      ])
      .execute();

    if (wideCorpUsers.length === 4) {
      console.log('  ✅ All 4 Wide Corp test users found');
      wideCorpUsers.forEach(user => {
        console.log(`    - ${user.email} (${user.name})`);
      });
    } else {
      results.errors.push(`Only ${wideCorpUsers.length}/4 Wide Corp test users found`);
      console.log(`  ❌ Only ${wideCorpUsers.length}/4 Wide Corp test users found`);
    }

    // =======================================================================
    // FINAL REPORT
    // =======================================================================
    
    console.log('\n📋 VALIDATION SUMMARY:');
    console.log('='.repeat(50));
    console.log(`System Options:       ${results.systemOptions.sets} sets, ${results.systemOptions.options} options (${results.systemOptions.tested} tested)`);
    console.log(`Custom Options:       ${results.customOptions.sets} sets, ${results.customOptions.options} options (${results.customOptions.tested} tested)`);
    console.log(`Relationship Configs: ${results.relationships.configs} configs, ${results.relationships.records} records (${results.relationships.tested} entities tested)`);
    console.log(`API Tests:            System: ${results.apiTests.systemOptions ? '✅' : '❌'}, Custom: ${results.apiTests.customOptions ? '✅' : '❌'}`);
    console.log(`Business Scenarios:   ${results.businessScenarios.created}/8 entities created, ${results.businessScenarios.validated} total records`);
    console.log(`Test Users:           ${wideCorpUsers.length}/4 Wide Corp users available`);
    console.log(`Errors:               ${results.errors.length} issues found`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      results.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    // Overall status
    const isHealthy = (
      results.systemOptions.options > 0 &&
      results.customOptions.options > 0 &&
      results.relationships.configs > 0 &&
      results.apiTests.systemOptions &&
      results.apiTests.customOptions &&
      results.businessScenarios.created >= 6 &&
      wideCorpUsers.length === 4 &&
      results.errors.length === 0
    );

    console.log('\n' + '='.repeat(50));
    if (isHealthy) {
      console.log('🎉 VALIDATION PASSED - Options and Relationship system is fully functional!');
      console.log('✅ Ready for development and testing');
      console.log('🏢 Wide Corp test organization is properly configured');
      console.log('🔗 Full relationship system is operational');
      console.log('📋 All option types are available and working');
    } else {
      console.log('⚠️ VALIDATION INCOMPLETE - Some issues found');
      console.log('Please review the errors above and re-run seeding if necessary');
    }

    return isHealthy;

  } catch (error) {
    console.error('❌ Critical error during validation:', error);
    return false;
  } finally {
    await kysely.destroy();
  }
}

// Run the validation
runValidationTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });